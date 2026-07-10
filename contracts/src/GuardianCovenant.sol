// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "./lib/ERC20.sol";
import {ActionType, GuardianStatus, CovenantTerms, VestingTranche, ICovenantHook} from "./interfaces/ICovenant.sol";
import {IScheduler, RitualPrecompiles} from "./interfaces/IRitual.sol";

/**
 * The covenant: one per launch, custodian of everything the creator
 * committed to at launch.
 *
 * It holds the vesting allocation and the locked LP under its own
 * balance. Its guardian — a sovereign agent on Ritual Chain whose keys
 * exist only inside a TEE via DKMS — is the only party that can release
 * tranches on schedule, freeze violating wallets, and write the
 * attested enforcement log. Neither the creator nor Vestal holds an
 * admin key; there is nothing here to rug with.
 *
 * Terms are committed once at launch (termsHash) and never change.
 * Enforcement history is the EnforcementAction event stream — the
 * frontend's Enforcement Log is a straight read of it.
 *
 * Liveness is layered:
 *  1. The guardian schedules its own wake-ups via the native Scheduler.
 *  2. Consensus revives it from checkpoint if it misses heartbeats.
 *  3. As a final, trustless backstop, vesting releases become
 *     permissionless FAILSAFE_GRACE_BLOCKS after they are due — even if
 *     Ritual's revival machinery and Vestal both vanished, no tranche
 *     can be stranded, and early release stays impossible.
 */
contract GuardianCovenant is ICovenantHook {
    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------
    error NotGuardian();
    error NotFactory();
    error NotCreator();
    error NotToken();
    error GuardianAlreadyBound();
    error ZeroAddress();
    error TrancheNotDue();
    error TrancheAlreadyReleased();
    error FailsafeNotReached();
    error WalletFrozen(address wallet);
    error SellCapExceeded(address wallet, uint256 attempted, uint256 remaining);
    error LpStillLocked(uint64 unlockBlock);
    error LpTokenMismatch();
    error InvalidTranche();

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    /// The enforcement log. One entry per guardian action; `attestation`
    /// is the TEE attestation hash for the action (zero for the
    /// permissionless failsafe path, which needs no TEE).
    event EnforcementAction(ActionType indexed action, uint64 atBlock, bytes32 attestation, string detail);

    event GuardianBound(address indexed guardian, bytes32 termsHash);
    event Heartbeat(uint64 atBlock, bytes32 checkpointHash);
    event WalletTracked(address indexed wallet);
    event WalletFreezeSet(address indexed wallet, bool frozen);
    event TrancheReleased(uint256 indexed index, address indexed recipient, uint256 amount, bool failsafe);
    event LpLocked(address indexed lpToken, uint256 amount, uint64 lockedUntilBlock);
    event LpWithdrawn(address indexed lpToken, address indexed to, uint256 amount);
    event SchedulerRegistered(uint256 taskId);
    event SchedulerRegistrationDeferred();

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    /// Blocks past a tranche's release block after which anyone may
    /// execute it. ~7 days at 2s blocks; the guardian is normally
    /// hundreds of thousands of blocks faster.
    uint64 public constant FAILSAFE_GRACE_BLOCKS = 302_400;

    /// A guardian whose last heartbeat is older than this many monitor
    /// intervals reads as Reviving (consensus restore in progress).
    uint64 public constant REVIVING_AFTER_INTERVALS = 3;

    uint16 internal constant BPS = 10_000;

    ERC20 public immutable token;
    address public immutable factory;
    address public immutable creator;
    uint64 public immutable deployedBlock;

    /// keccak256 commitment to the exact terms + tranches handed to the
    /// guardian at provisioning. What the agent enforces is what was
    /// committed — verifiable by anyone re-hashing the public terms.
    bytes32 public termsHash;

    address public guardian;
    CovenantTerms public terms;
    VestingTranche[] internal _vesting;

    uint64 public lastHeartbeatBlock;
    uint32 public revivals;

    /// LP custody: a single LP token locked until terms.lpLockUntilBlock.
    ERC20 public lpToken;
    uint256 public lpAmount;

    struct TrackedWallet {
        bool tracked;
        bool frozen;
        uint64 windowStart;
        uint256 holdingsAtWindowStart;
        uint256 soldInWindow;
    }

    mapping(address => TrackedWallet) public trackedWallets;
    uint32 public frozenCount;

    modifier onlyGuardian() {
        if (msg.sender != guardian) revert NotGuardian();
        _;
    }

    // ------------------------------------------------------------------
    // Construction & binding (factory-orchestrated, one launch tx)
    // ------------------------------------------------------------------

    constructor(
        address token_,
        address creator_,
        CovenantTerms memory terms_,
        VestingTranche[] memory tranches
    ) {
        if (token_ == address(0) || creator_ == address(0)) revert ZeroAddress();
        token = ERC20(token_);
        factory = msg.sender;
        creator = creator_;
        deployedBlock = uint64(block.number);
        lastHeartbeatBlock = uint64(block.number);
        terms = terms_;
        for (uint256 i = 0; i < tranches.length; i++) {
            if (tranches[i].recipient == address(0) || tranches[i].released) revert InvalidTranche();
            _vesting.push(tranches[i]);
        }
        termsHash = keccak256(abi.encode(terms_, tranches));
        // The creator's wallet is under audit from block one.
        _track(creator_);
    }

    /// Factory binds the freshly provisioned sovereign agent. Once.
    function bindGuardian(address guardian_) external {
        if (msg.sender != factory) revert NotFactory();
        if (guardian != address(0)) revert GuardianAlreadyBound();
        if (guardian_ == address(0)) revert ZeroAddress();
        guardian = guardian_;
        emit GuardianBound(guardian_, termsHash);
    }

    /// Register the recurring wake-up with Ritual's native Scheduler.
    /// On environments where the precompile slot is empty (local tests,
    /// pre-release testnets) registration is deferred — the guardian
    /// can self-schedule from inside the TEE instead.
    function registerWithScheduler() external payable onlyGuardian returns (uint256 taskId) {
        address sched = RitualPrecompiles.SCHEDULER;
        if (sched.code.length == 0) {
            emit SchedulerRegistrationDeferred();
            return 0;
        }
        taskId = IScheduler(sched).scheduleRecurring{value: msg.value}(address(this), terms.monitorEveryBlocks);
        emit SchedulerRegistered(taskId);
    }

    // ------------------------------------------------------------------
    // Guardian actions — the attested enforcement log
    // ------------------------------------------------------------------

    /// Scheduler-driven wake: the guardian re-verifies covenant state.
    /// Callable by the guardian itself or delivered natively by the
    /// Scheduler precompile via the block proposer.
    function onScheduledWake(bytes32 attestation, string calldata detail) external {
        if (msg.sender != guardian && msg.sender != RitualPrecompiles.SCHEDULER) revert NotGuardian();
        emit EnforcementAction(ActionType.Wake, uint64(block.number), attestation, detail);
    }

    /// Result of a wallet audit sweep. `ok=false` logs a Flag without
    /// freezing — the guardian tightens monitoring first, freezes on
    /// actual violation.
    function recordAudit(bool ok, bytes32 attestation, string calldata detail) external onlyGuardian {
        emit EnforcementAction(ok ? ActionType.CheckOk : ActionType.Flag, uint64(block.number), attestation, detail);
    }

    /// Heartbeat + state checkpoint, mirrored to the persistent-agent
    /// precompile by the agent itself.
    function heartbeat(bytes32 checkpointHash, bytes32 attestation) external onlyGuardian {
        lastHeartbeatBlock = uint64(block.number);
        emit Heartbeat(uint64(block.number), checkpointHash);
        emit EnforcementAction(ActionType.Checkpoint, uint64(block.number), attestation, "");
    }

    /// Logged by the agent after consensus restores it from checkpoint.
    function recordRevival(bytes32 attestation, string calldata detail) external onlyGuardian {
        revivals += 1;
        lastHeartbeatBlock = uint64(block.number);
        emit EnforcementAction(ActionType.Revival, uint64(block.number), attestation, detail);
    }

    /// Put an insider wallet under sell-cap audit.
    function trackWallet(address wallet) external onlyGuardian {
        _track(wallet);
    }

    /// Freeze / unfreeze a wallet that violated committed terms. All its
    /// outgoing transfers revert while frozen.
    function setWalletFrozen(address wallet, bool frozen, bytes32 attestation, string calldata detail)
        external
        onlyGuardian
    {
        TrackedWallet storage w = trackedWallets[wallet];
        if (!w.tracked) _track(wallet);
        if (w.frozen == frozen) return;
        w.frozen = frozen;
        frozen ? frozenCount++ : frozenCount--;
        emit WalletFreezeSet(wallet, frozen);
        emit EnforcementAction(
            frozen ? ActionType.Freeze : ActionType.CheckOk, uint64(block.number), attestation, detail
        );
    }

    /// Release a due tranche. Guardian path: any time after the tranche
    /// block, with attestation. Failsafe path: anyone, but only after
    /// FAILSAFE_GRACE_BLOCKS past due — funds can never be stranded,
    /// and never released early.
    function executeVestingRelease(uint256 index, bytes32 attestation, string calldata detail) external {
        VestingTranche storage t = _vesting[index];
        if (t.released) revert TrancheAlreadyReleased();
        if (block.number < t.releaseAtBlock) revert TrancheNotDue();

        bool isFailsafe = msg.sender != guardian;
        if (isFailsafe && block.number < uint256(t.releaseAtBlock) + FAILSAFE_GRACE_BLOCKS) {
            revert FailsafeNotReached();
        }

        t.released = true;
        uint256 amount = (token.totalSupply() * t.supplyBps) / BPS;
        token.transfer(t.recipient, amount);

        emit TrancheReleased(index, t.recipient, amount, isFailsafe);
        emit EnforcementAction(
            ActionType.Release,
            uint64(block.number),
            isFailsafe ? bytes32(0) : attestation,
            isFailsafe ? "Failsafe release: tranche past grace period, executed permissionlessly" : detail
        );
    }

    // ------------------------------------------------------------------
    // Token hook — where enforcement bites
    // ------------------------------------------------------------------

    /// Called by VestalToken before every transfer. Reverts are the
    /// enforcement mechanism: a frozen wallet cannot move, a tracked
    /// wallet cannot exceed its rolling sell cap.
    function beforeTokenTransfer(address from, address, uint256 amount) external {
        if (msg.sender != address(token)) revert NotToken();
        if (from == address(0)) return; // mint

        TrackedWallet storage w = trackedWallets[from];
        if (!w.tracked) return;
        if (w.frozen) revert WalletFrozen(from);

        uint16 capBps = terms.devWalletCapBps;
        if (capBps >= BPS) return; // no cap committed

        // Roll the window forward when it has elapsed; the cap re-bases
        // on current holdings so it stays a share of what the wallet
        // actually holds.
        if (block.number >= uint256(w.windowStart) + terms.sellWindowBlocks) {
            w.windowStart = uint64(block.number);
            w.holdingsAtWindowStart = token.balanceOf(from);
            w.soldInWindow = 0;
        }

        uint256 cap = (w.holdingsAtWindowStart * capBps) / BPS;
        uint256 sold = w.soldInWindow;
        if (sold + amount > cap) {
            revert SellCapExceeded(from, amount, cap > sold ? cap - sold : 0);
        }
        w.soldInWindow = sold + amount;
    }

    // ------------------------------------------------------------------
    // LP custody
    // ------------------------------------------------------------------

    /// Creator deposits LP tokens into guardian custody (approve first).
    /// One LP token per covenant; deposits can only add to the lock.
    function lockLp(address lpToken_, uint256 amount) external {
        if (msg.sender != creator) revert NotCreator();
        if (lpToken_ == address(0)) revert ZeroAddress();
        if (address(lpToken) == address(0)) {
            lpToken = ERC20(lpToken_);
        } else if (lpToken_ != address(lpToken)) {
            revert LpTokenMismatch();
        }
        require(ERC20(lpToken_).transferFrom(msg.sender, address(this), amount), "LP transfer failed");
        lpAmount += amount;
        emit LpLocked(lpToken_, amount, terms.lpLockUntilBlock);
    }

    /// After the committed unlock block — and not one block sooner —
    /// the creator can reclaim the LP.
    function withdrawLp(address to) external {
        if (msg.sender != creator) revert NotCreator();
        if (block.number < terms.lpLockUntilBlock) revert LpStillLocked(terms.lpLockUntilBlock);
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = lpAmount;
        lpAmount = 0;
        require(lpToken.transfer(to, amount), "LP transfer failed");
        emit LpWithdrawn(address(lpToken), to, amount);
    }

    // ------------------------------------------------------------------
    // Views (shapes mirror the frontend's Guardian / CovenantTerms)
    // ------------------------------------------------------------------

    function vesting() external view returns (VestingTranche[] memory) {
        return _vesting;
    }

    function vestingCount() external view returns (uint256) {
        return _vesting.length;
    }

    /// Derived exactly like the frontend badge: Enforcing if any wallet
    /// is frozen, Reviving if heartbeats have gone quiet, else Active.
    function guardianStatus() public view returns (GuardianStatus) {
        if (frozenCount > 0) return GuardianStatus.Enforcing;
        uint256 gap = uint256(terms.monitorEveryBlocks) * REVIVING_AFTER_INTERVALS;
        if (gap > 0 && block.number > uint256(lastHeartbeatBlock) + gap) return GuardianStatus.Reviving;
        return GuardianStatus.Active;
    }

    /// Everything the token detail page's Guardian Panel needs, one call.
    function guardianSummary()
        external
        view
        returns (
            address agent,
            uint64 deployedAt,
            uint64 lastHeartbeat,
            uint32 revivalCount,
            GuardianStatus status
        )
    {
        return (guardian, deployedBlock, lastHeartbeatBlock, revivals, guardianStatus());
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    function _track(address wallet) internal {
        TrackedWallet storage w = trackedWallets[wallet];
        if (w.tracked) return;
        w.tracked = true;
        w.windowStart = uint64(block.number);
        w.holdingsAtWindowStart = token.balanceOf(wallet);
        emit WalletTracked(wallet);
    }
}

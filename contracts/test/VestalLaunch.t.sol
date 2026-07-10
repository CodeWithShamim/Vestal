// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {VestalToken} from "../src/VestalToken.sol";
import {GuardianCovenant} from "../src/GuardianCovenant.sol";
import {VestalLaunchFactory} from "../src/VestalLaunchFactory.sol";
import {CovenantRegistry} from "../src/CovenantRegistry.sol";
import {MockGuardianProvider} from "../src/providers/MockGuardianProvider.sol";
import {CovenantTerms, VestingTranche, GuardianStatus, ActionType} from "../src/interfaces/ICovenant.sol";
import {ERC20} from "../src/lib/ERC20.sol";

contract TestLP is ERC20 {
    constructor() ERC20("Test LP", "TLP") {
        _mint(msg.sender, 1_000_000e18);
    }
}

contract VestalLaunchTest is Test {
    CovenantRegistry registry;
    MockGuardianProvider provider;
    VestalLaunchFactory factory;

    address creator = makeAddr("creator");
    address guardian = makeAddr("guardian");
    address treasury = makeAddr("treasury");
    address buyer = makeAddr("buyer");

    VestalToken token;
    GuardianCovenant covenant;

    uint256 constant SUPPLY = 1_000_000_000e18;
    uint64 constant LP_UNLOCK = 5_000_000;
    uint16 constant DEV_CAP_BPS = 200; // 2% per window
    uint32 constant SELL_WINDOW = 1_296_000; // ~30d @ 2s
    uint32 constant MONITOR_EVERY = 300;

    function setUp() public {
        vm.roll(100);
        registry = new CovenantRegistry();
        provider = new MockGuardianProvider(guardian);
        factory = new VestalLaunchFactory(address(registry), address(provider));
        registry.setFactory(address(factory));

        (address t, address c,) = _launch();
        token = VestalToken(t);
        covenant = GuardianCovenant(c);
    }

    function _terms() internal pure returns (CovenantTerms memory) {
        return CovenantTerms({
            lpLockUntilBlock: LP_UNLOCK,
            lpLockedBps: 10_000,
            devWalletCapBps: DEV_CAP_BPS,
            sellWindowBlocks: SELL_WINDOW,
            monitorEveryBlocks: MONITOR_EVERY
        });
    }

    function _tranches() internal view returns (VestingTranche[] memory tr) {
        tr = new VestingTranche[](3);
        tr[0] = VestingTranche("Treasury tranche 1 of 3", 500, 700_000, treasury, false);
        tr[1] = VestingTranche("Treasury tranche 2 of 3", 500, 1_300_000, treasury, false);
        tr[2] = VestingTranche("Treasury tranche 3 of 3", 500, 1_900_000, treasury, false);
    }

    function _launch() internal returns (address, address, address) {
        vm.prank(creator);
        return
            factory.createLaunch(
                VestalLaunchFactory.TokenParams("Aurum", "AUR", SUPPLY), _terms(), _tranches()
            );
    }

    // ------------------------------------------------------------------
    // Launch wiring
    // ------------------------------------------------------------------

    function test_launchWiring() public view {
        // 15% (3 x 500 bps) in covenant custody, remainder with creator.
        uint256 vested = (SUPPLY * 1500) / 10_000;
        assertEq(token.balanceOf(address(covenant)), vested);
        assertEq(token.balanceOf(creator), SUPPLY - vested);
        assertEq(token.totalSupply(), SUPPLY);

        assertEq(address(token.covenant()), address(covenant));
        assertEq(covenant.guardian(), guardian);
        assertEq(covenant.creator(), creator);

        // Terms commitment is reproducible from the public inputs.
        assertEq(covenant.termsHash(), keccak256(abi.encode(_terms(), _tranches())));

        // Registry resolves both directions.
        assertEq(registry.launchCount(), 1);
        CovenantRegistry.Launch memory l = registry.getLaunchByToken(address(token));
        assertEq(l.covenant, address(covenant));
        assertEq(l.guardian, guardian);
        assertEq(l.creator, creator);
    }

    function test_covenantAndGuardianBindOnce() public {
        vm.expectRevert("VestalToken: covenant already bound");
        vm.prank(address(factory));
        token.bindCovenant(address(this));

        vm.expectRevert(GuardianCovenant.GuardianAlreadyBound.selector);
        vm.prank(address(factory));
        covenant.bindGuardian(address(this));
    }

    function test_factoryRejectsBadTerms() public {
        CovenantTerms memory bad = _terms();
        bad.lpLockUntilBlock = uint64(block.number); // not in the future
        vm.expectRevert(VestalLaunchFactory.InvalidTerms.selector);
        vm.prank(creator);
        factory.createLaunch(VestalLaunchFactory.TokenParams("X", "X", SUPPLY), bad, _tranches());

        // 100%+ vested leaves nothing to launch with.
        VestingTranche[] memory tr = new VestingTranche[](1);
        tr[0] = VestingTranche("all", 10_000, 700_000, treasury, false);
        vm.expectRevert(VestalLaunchFactory.VestingOverflow.selector);
        vm.prank(creator);
        factory.createLaunch(VestalLaunchFactory.TokenParams("X", "X", SUPPLY), _terms(), tr);
    }

    function test_factoryRejectsDegenerateTranches() public {
        // A tranche already due at launch is "vesting" in name only.
        VestingTranche[] memory past = _tranches();
        past[0].releaseAtBlock = uint64(block.number);
        vm.expectRevert(VestalLaunchFactory.InvalidTranche.selector);
        vm.prank(creator);
        factory.createLaunch(VestalLaunchFactory.TokenParams("X", "X", SUPPLY), _terms(), past);

        // Zero-bps tranches are no-op commitments.
        VestingTranche[] memory zero = _tranches();
        zero[1].supplyBps = 0;
        vm.expectRevert(VestalLaunchFactory.InvalidTranche.selector);
        vm.prank(creator);
        factory.createLaunch(VestalLaunchFactory.TokenParams("X", "X", SUPPLY), _terms(), zero);
    }

    // ------------------------------------------------------------------
    // Vesting: schedule is physics
    // ------------------------------------------------------------------

    function test_releaseRevertsBeforeSchedule() public {
        vm.expectRevert(GuardianCovenant.TrancheNotDue.selector);
        vm.prank(guardian);
        covenant.executeVestingRelease(0, bytes32(uint256(1)), "early");
    }

    function test_guardianReleasesOnSchedule() public {
        vm.roll(700_000);
        vm.prank(guardian);
        covenant.executeVestingRelease(0, bytes32(uint256(1)), "Vesting release executed per schedule");

        assertEq(token.balanceOf(treasury), (SUPPLY * 500) / 10_000);

        vm.expectRevert(GuardianCovenant.TrancheAlreadyReleased.selector);
        vm.prank(guardian);
        covenant.executeVestingRelease(0, bytes32(uint256(2)), "again");
    }

    function test_strangerCannotReleaseUntilFailsafe() public {
        vm.roll(700_000);
        vm.expectRevert(GuardianCovenant.FailsafeNotReached.selector);
        covenant.executeVestingRelease(0, bytes32(0), "");

        // Guardian (and Vestal, and Ritual) presumed gone: past the grace
        // window anyone can execute — to the committed recipient only.
        vm.roll(700_000 + covenant.FAILSAFE_GRACE_BLOCKS());
        covenant.executeVestingRelease(0, bytes32(0), "");
        assertEq(token.balanceOf(treasury), (SUPPLY * 500) / 10_000);
    }

    // ------------------------------------------------------------------
    // Dev-wallet sell cap
    // ------------------------------------------------------------------

    function test_sellCapEnforcedOnCreator() public {
        uint256 holdings = token.balanceOf(creator);
        uint256 cap = (holdings * DEV_CAP_BPS) / 10_000;

        // Within cap: fine.
        vm.prank(creator);
        token.transfer(buyer, cap);

        // One more wei over the cap in the same window: reverts.
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(GuardianCovenant.SellCapExceeded.selector, creator, 1, 0));
        token.transfer(buyer, 1);
    }

    function test_sellCapWindowRolls() public {
        uint256 holdings = token.balanceOf(creator);
        uint256 cap = (holdings * DEV_CAP_BPS) / 10_000;

        vm.prank(creator);
        token.transfer(buyer, cap);

        vm.roll(block.number + SELL_WINDOW);

        // New window re-bases on current (reduced) holdings.
        uint256 newCap = (token.balanceOf(creator) * DEV_CAP_BPS) / 10_000;
        vm.prank(creator);
        token.transfer(buyer, newCap);
        assertEq(token.balanceOf(buyer), cap + newCap);
    }

    function test_untrackedWalletsUnaffected() public {
        vm.prank(creator);
        token.transfer(buyer, 1000e18);
        // Buyer is not tracked — can move everything at once.
        vm.prank(buyer);
        token.transfer(makeAddr("other"), 1000e18);
    }

    function test_guardianTracksInsiderWallet() public {
        vm.prank(creator);
        token.transfer(buyer, 1_000_000e18);

        vm.prank(guardian);
        covenant.trackWallet(buyer);

        uint256 cap = (1_000_000e18 * uint256(DEV_CAP_BPS)) / 10_000;
        vm.prank(buyer);
        vm.expectRevert();
        token.transfer(makeAddr("other"), cap + 1);
    }

    // ------------------------------------------------------------------
    // Freeze
    // ------------------------------------------------------------------

    function test_freezeStopsWalletAndSetsEnforcing() public {
        vm.prank(guardian);
        covenant.setWalletFrozen(creator, true, bytes32(uint256(9)), "30-day cap exceeded; excess frozen");

        assertEq(uint8(covenant.guardianStatus()), uint8(GuardianStatus.Enforcing));

        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(GuardianCovenant.WalletFrozen.selector, creator));
        token.transfer(buyer, 1);

        vm.prank(guardian);
        covenant.setWalletFrozen(creator, false, bytes32(uint256(10)), "resolved per covenant");
        vm.prank(creator);
        token.transfer(buyer, 1);
        assertEq(uint8(covenant.guardianStatus()), uint8(GuardianStatus.Active));
    }

    // ------------------------------------------------------------------
    // LP custody
    // ------------------------------------------------------------------

    function test_lpLockLifecycle() public {
        TestLP lp = new TestLP();
        lp.transfer(creator, 500e18);

        vm.startPrank(creator);
        lp.approve(address(covenant), 500e18);
        covenant.lockLp(address(lp), 500e18);

        vm.expectRevert(abi.encodeWithSelector(GuardianCovenant.LpStillLocked.selector, LP_UNLOCK));
        covenant.withdrawLp(creator);

        vm.roll(LP_UNLOCK);
        covenant.withdrawLp(creator);
        vm.stopPrank();

        assertEq(lp.balanceOf(creator), 500e18);
        assertEq(covenant.lpAmount(), 0);
    }

    function test_onlyCreatorTouchesLp() public {
        vm.expectRevert(GuardianCovenant.NotCreator.selector);
        covenant.withdrawLp(address(this));
    }

    // ------------------------------------------------------------------
    // Heartbeats, status, enforcement log
    // ------------------------------------------------------------------

    function test_guardianStatusDerivation() public {
        assertEq(uint8(covenant.guardianStatus()), uint8(GuardianStatus.Active));

        // Heartbeats gone quiet for > 3 monitor intervals: Reviving.
        vm.roll(block.number + uint256(MONITOR_EVERY) * 3 + 1);
        assertEq(uint8(covenant.guardianStatus()), uint8(GuardianStatus.Reviving));

        vm.prank(guardian);
        covenant.heartbeat(keccak256("ckpt"), bytes32(uint256(3)));
        assertEq(uint8(covenant.guardianStatus()), uint8(GuardianStatus.Active));
        assertEq(covenant.lastHeartbeatBlock(), uint64(block.number));
    }

    function test_schedulerDeferralRefundsFunding() public {
        // No scheduler precompile in this environment: registration is
        // deferred and the funding must come back — the covenant has no
        // native withdrawal path, so anything kept would be stranded.
        vm.deal(guardian, 1 ether);
        vm.prank(guardian);
        uint256 taskId = covenant.registerWithScheduler{value: 1 ether}();
        assertEq(taskId, 0);
        assertEq(guardian.balance, 1 ether);
        assertEq(address(covenant).balance, 0);
    }

    function test_revivalRecorded() public {
        vm.prank(guardian);
        covenant.recordRevival(bytes32(uint256(4)), "revived from checkpoint by consensus");
        assertEq(covenant.revivals(), 1);
    }

    function test_enforcementLogEmits() public {
        vm.expectEmit(true, false, false, true, address(covenant));
        emit GuardianCovenant.EnforcementAction(
            ActionType.CheckOk, uint64(block.number), bytes32(uint256(5)), "wallets audited - no violations"
        );
        vm.prank(guardian);
        covenant.recordAudit(true, bytes32(uint256(5)), "wallets audited - no violations");
    }

    function test_guardianOnlyActions() public {
        vm.expectRevert(GuardianCovenant.NotGuardian.selector);
        covenant.recordAudit(true, bytes32(0), "");
        vm.expectRevert(GuardianCovenant.NotGuardian.selector);
        covenant.heartbeat(bytes32(0), bytes32(0));
        vm.expectRevert(GuardianCovenant.NotGuardian.selector);
        covenant.onScheduledWake(bytes32(0), "");
        vm.expectRevert(GuardianCovenant.NotGuardian.selector);
        covenant.trackWallet(buyer);
        vm.expectRevert(GuardianCovenant.NotGuardian.selector);
        covenant.setWalletFrozen(buyer, true, bytes32(0), "");
    }

    function test_hookOnlyCallableByToken() public {
        vm.expectRevert(GuardianCovenant.NotToken.selector);
        covenant.beforeTokenTransfer(creator, buyer, 1);
    }

    function test_guardianSummaryShape() public view {
        (address agent, uint64 deployedAt, uint64 lastHb, uint32 revs, GuardianStatus status) =
            covenant.guardianSummary();
        assertEq(agent, guardian);
        assertEq(deployedAt, 100);
        assertEq(lastHb, 100);
        assertEq(revs, 0);
        assertEq(uint8(status), uint8(GuardianStatus.Active));
    }
}

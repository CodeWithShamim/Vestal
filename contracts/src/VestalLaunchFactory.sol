// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {VestalToken} from "./VestalToken.sol";
import {GuardianCovenant} from "./GuardianCovenant.sol";
import {CovenantRegistry} from "./CovenantRegistry.sol";
import {CovenantTerms, VestingTranche} from "./interfaces/ICovenant.sol";
import {IGuardianProvider} from "./interfaces/IGuardianProvider.sol";

/**
 * One transaction turns the Launch Wizard's "Covenant Summary" into an
 * enforced reality:
 *
 *   1. Mint the fixed supply.
 *   2. Send the creator their unvested share (before the covenant
 *      starts watching, so the sell-cap window bases on real holdings).
 *   3. Deploy the covenant, which immediately puts the creator's wallet
 *      under audit.
 *   4. Move the entire vesting allocation into covenant custody.
 *   5. Bind the covenant into the token's transfer path.
 *   6. Provision the sovereign agent, committed to the terms hash, and
 *      bind it as guardian.
 *   7. Register the launch.
 *
 * After step 7 the factory has no remaining authority over the launch —
 * and never had a key that could override the covenant.
 */
contract VestalLaunchFactory {
    error InvalidSupply();
    error InvalidTerms();
    error InvalidTranche();
    error VestingOverflow();
    error NoTranches();
    error TransferFailed();

    event LaunchCreated(
        address indexed token,
        address indexed covenant,
        address indexed creator,
        address guardian,
        bytes32 termsHash
    );

    uint16 internal constant BPS = 10_000;

    CovenantRegistry public immutable registry;
    IGuardianProvider public immutable guardianProvider;

    struct TokenParams {
        string name;
        string symbol;
        uint256 totalSupply;
    }

    constructor(address registry_, address guardianProvider_) {
        registry = CovenantRegistry(registry_);
        guardianProvider = IGuardianProvider(guardianProvider_);
    }

    function createLaunch(
        TokenParams calldata params,
        CovenantTerms calldata terms,
        VestingTranche[] calldata tranches
    ) external returns (address token, address covenant, address guardian) {
        if (params.totalSupply == 0) revert InvalidSupply();
        if (tranches.length == 0) revert NoTranches();
        if (
            terms.lpLockUntilBlock <= block.number || terms.sellWindowBlocks == 0
                || terms.monitorEveryBlocks == 0 || terms.devWalletCapBps > BPS || terms.lpLockedBps > BPS
        ) revert InvalidTerms();

        uint256 vestingBps;
        for (uint256 i = 0; i < tranches.length; i++) {
            // A tranche due in the past would be releasable the moment the
            // launch lands — "vesting" in name only; zero-bps tranches are
            // no-op log entries dressed up as commitments.
            if (tranches[i].supplyBps == 0 || tranches[i].releaseAtBlock <= block.number) {
                revert InvalidTranche();
            }
            vestingBps += tranches[i].supplyBps;
        }
        // The creator must keep some circulating share; a covenant that
        // vests 100% of supply has nothing to launch with.
        if (vestingBps == 0 || vestingBps >= BPS) revert VestingOverflow();

        VestalToken t = new VestalToken(params.name, params.symbol, params.totalSupply, address(this));

        uint256 vestingAmount = (params.totalSupply * vestingBps) / BPS;
        if (!t.transfer(msg.sender, params.totalSupply - vestingAmount)) revert TransferFailed();

        GuardianCovenant c = new GuardianCovenant(address(t), msg.sender, terms, tranches);
        if (!t.transfer(address(c), vestingAmount)) revert TransferFailed();
        t.bindCovenant(address(c));

        guardian = guardianProvider.provisionGuardian(address(c), c.termsHash());
        c.bindGuardian(guardian);

        registry.register(address(t), address(c), guardian, msg.sender);
        emit LaunchCreated(address(t), address(c), msg.sender, guardian, c.termsHash());
        return (address(t), address(c), guardian);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {VestalLaunchFactory} from "../src/VestalLaunchFactory.sol";
import {GuardianCovenant} from "../src/GuardianCovenant.sol";
import {CovenantTerms, VestingTranche} from "../src/interfaces/ICovenant.sol";

/**
 * Creates one demo launch and writes a few guardian log entries so the
 * frontend has real contract state to read against a local anvil node
 * (where MockGuardianProvider makes the deployer the guardian).
 *
 *   FACTORY=0x... forge script script/DemoLaunch.s.sol --rpc-url http://localhost:8545 --broadcast
 */
contract DemoLaunch is Script {
    function run() external {
        VestalLaunchFactory factory = VestalLaunchFactory(vm.envAddress("FACTORY"));

        vm.startBroadcast();

        VestingTranche[] memory tranches = new VestingTranche[](4);
        address treasury = msg.sender;
        tranches[0] =
            VestingTranche("Team tranche 1 of 4", 400, uint64(block.number + 1_100_000), treasury, false);
        tranches[1] =
            VestingTranche("Team tranche 2 of 4", 400, uint64(block.number + 2_200_000), treasury, false);
        tranches[2] =
            VestingTranche("Team tranche 3 of 4", 400, uint64(block.number + 3_300_000), treasury, false);
        tranches[3] =
            VestingTranche("Team tranche 4 of 4", 400, uint64(block.number + 4_400_000), treasury, false);

        CovenantTerms memory terms = CovenantTerms({
            lpLockUntilBlock: uint64(block.number + 30_000_000),
            lpLockedBps: 10_000,
            devWalletCapBps: 200,
            sellWindowBlocks: 1_296_000,
            monitorEveryBlocks: 300
        });

        (address token, address covenantAddr, address guardian) = factory.createLaunch(
            VestalLaunchFactory.TokenParams("Northlight", "NLT", 1_000_000_000e18), terms, tranches
        );

        // On anvil the deployer is the guardian — write a plausible log.
        GuardianCovenant covenant = GuardianCovenant(covenantAddr);
        if (guardian == msg.sender) {
            covenant.heartbeat(keccak256("demo-checkpoint-1"), keccak256("demo-att-1"));
            covenant.recordAudit(
                true,
                keccak256("demo-att-2"),
                "Dev and insider wallets audited against sell-limit - no violations"
            );
            covenant.onScheduledWake(
                keccak256("demo-att-3"), "Scheduled wake executed - covenant state for NLT re-verified"
            );
        }

        vm.stopBroadcast();

        console.log("Demo launch created:");
        console.log("  token:    %s", token);
        console.log("  covenant: %s", covenantAddr);
        console.log("  guardian: %s", guardian);
    }
}

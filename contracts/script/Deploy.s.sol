// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CovenantRegistry} from "../src/CovenantRegistry.sol";
import {VestalLaunchFactory} from "../src/VestalLaunchFactory.sol";
import {MockGuardianProvider} from "../src/providers/MockGuardianProvider.sol";
import {RitualGuardianProvider} from "../src/providers/RitualGuardianProvider.sol";
import {RitualPrecompiles} from "../src/interfaces/IRitual.sol";

/**
 * Deploys the Vestal protocol: registry → guardian provider → factory.
 *
 * Provider selection is automatic: if the sovereign-agent precompile
 * (0x080C) has code on the target chain, the RitualGuardianProvider is
 * used; otherwise the MockGuardianProvider (guardian = deployer) so the
 * full launch flow works on anvil and pre-release testnets.
 *
 *   forge script script/Deploy.s.sol --rpc-url $RITUAL_RPC_URL --broadcast
 *
 * After deployment, copy the printed addresses into the frontend's
 * src/config/ritual.js VESTAL_CONTRACTS block.
 */
contract Deploy is Script {
    function run() external {
        // Attested guardian TEE build id — placeholder until the real
        // vestal-guardian build is published.
        bytes32 buildId = vm.envOr("GUARDIAN_BUILD_ID", keccak256("vestal-guardian/1.2"));
        // ~10 minutes at 2s blocks before consensus revival triggers.
        uint64 heartbeatGap = uint64(vm.envOr("HEARTBEAT_MAX_GAP_BLOCKS", uint256(300)));

        vm.startBroadcast();

        CovenantRegistry registry = new CovenantRegistry();

        address provider;
        if (RitualPrecompiles.SOVEREIGN_AGENT.code.length != 0) {
            provider = address(new RitualGuardianProvider(buildId, heartbeatGap));
            console.log("Guardian provider: RitualGuardianProvider (precompiles live)");
        } else {
            provider = address(new MockGuardianProvider(msg.sender));
            console.log("Guardian provider: MockGuardianProvider (precompiles absent; guardian = deployer)");
        }

        VestalLaunchFactory factory = new VestalLaunchFactory(address(registry), provider);
        registry.setFactory(address(factory));

        vm.stopBroadcast();

        console.log("");
        console.log("Update src/config/ritual.js VESTAL_CONTRACTS:");
        console.log("  LAUNCH_FACTORY:    %s", address(factory));
        console.log("  COVENANT_REGISTRY: %s", address(registry));
        console.log("  (guardian provider %s)", provider);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IGuardianProvider} from "../interfaces/IGuardianProvider.sol";
import {ISovereignAgent, IPersistentAgent, RitualPrecompiles} from "../interfaces/IRitual.sol";

/**
 * Production provider for Ritual Chain testnet.
 *
 * Provisions the guardian through the sovereign-agent precompile
 * (0x080C) from an attested TEE build, then registers it for
 * consensus-level heartbeat monitoring through the persistent-agent
 * precompile (0x0820) — the dead-man's-switch that revives it from
 * checkpoint if its executor dies.
 *
 * This file (plus IRitual.sol) is the entire blast radius of the
 * placeholder precompile ABIs: when the published testnet ABIs land,
 * update these two and redeploy the provider; factory, covenant, and
 * token are untouched.
 */
contract RitualGuardianProvider is IGuardianProvider {
    error PrecompileUnavailable(address precompile);

    /// Attested guardian build (maps to the frontend's "model" field,
    /// e.g. vestal-guardian/1.2 TEE build hash).
    bytes32 public immutable guardianBuildId;

    /// Max blocks between heartbeats before consensus triggers revival.
    uint64 public immutable heartbeatMaxGapBlocks;

    constructor(bytes32 guardianBuildId_, uint64 heartbeatMaxGapBlocks_) {
        guardianBuildId = guardianBuildId_;
        heartbeatMaxGapBlocks = heartbeatMaxGapBlocks_;
    }

    function provisionGuardian(address covenant, bytes32 termsHash) external returns (address guardian) {
        address sovereign = RitualPrecompiles.SOVEREIGN_AGENT;
        address persistent = RitualPrecompiles.PERSISTENT_AGENT;
        if (sovereign.code.length == 0) revert PrecompileUnavailable(sovereign);

        guardian = ISovereignAgent(sovereign).provision(guardianBuildId, covenant, termsHash);

        if (persistent.code.length != 0) {
            IPersistentAgent(persistent).registerHeartbeat(guardian, heartbeatMaxGapBlocks);
        }
    }
}

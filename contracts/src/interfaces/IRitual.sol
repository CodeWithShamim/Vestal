// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * Ritual Chain precompile interfaces.
 *
 * These are Vestal's *assumed* ABIs for the documented precompile slots.
 * The published testnet ABIs may differ; every touchpoint with them is
 * isolated behind these interfaces plus RitualGuardianProvider, so a
 * signature change lands in exactly two files and never in the covenant,
 * factory, or token logic.
 *
 * Canonical slot addresses live in RitualPrecompiles below and mirror
 * the frontend's src/config/ritual.js — keep the two in sync.
 */

/// Native scheduled/recurring execution. The block proposer includes the
/// call — no external keeper bots. Guardians register their own wake-ups.
interface IScheduler {
    /// Register a recurring call to `target.onScheduledWake()` every
    /// `everyBlocks` blocks, funded by the caller. Returns a task id.
    function scheduleRecurring(address target, uint64 everyBlocks) external payable returns (uint256 taskId);

    function cancel(uint256 taskId) external;
}

/// Sovereign-agent invocation (slot 0x080C). Agents run inside TEEs and
/// hold their own keys via DKMS — provisioning returns the agent's address,
/// never its key material.
interface ISovereignAgent {
    /// Provision a sovereign agent from an attested build, bound to a
    /// covenant it will enforce. `termsHash` commits the exact terms.
    function provision(bytes32 buildId, address covenant, bytes32 termsHash)
        external
        payable
        returns (address agent);
}

/// Persistent-agent lifecycle (slot 0x0820): checkpoints and heartbeat
/// registration. Agents that miss heartbeats are revived from their last
/// checkpoint by consensus — the chain-level dead-man's-switch.
interface IPersistentAgent {
    /// Register `agent` for consensus-level heartbeat monitoring with the
    /// given max gap between heartbeats before revival triggers.
    function registerHeartbeat(address agent, uint64 maxGapBlocks) external;
}

/// Canonical precompile slots. SCHEDULER is a placeholder pending the
/// published address; the 0x0801/0x0802/0x080C/0x0820 suffixes are the
/// documented slots.
library RitualPrecompiles {
    address internal constant SCHEDULER = 0x0000000000000000000000000000000000000800;
    address internal constant HTTP = 0x0000000000000000000000000000000000000801;
    address internal constant LLM = 0x0000000000000000000000000000000000000802;
    address internal constant SOVEREIGN_AGENT = 0x000000000000000000000000000000000000080C;
    address internal constant PERSISTENT_AGENT = 0x0000000000000000000000000000000000000820;
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * Provisions the sovereign agent that will enforce a covenant.
 *
 * The factory only knows this interface. On Ritual testnet the
 * implementation calls the sovereign-agent and persistent-agent
 * precompiles (RitualGuardianProvider); in local tests it hands back a
 * plain address (MockGuardianProvider). Swapping providers is how the
 * placeholder precompile ABIs get replaced without touching launch logic.
 */
interface IGuardianProvider {
    /// Provision a guardian bound to `covenant`, committed to `termsHash`.
    /// Returns the agent's own address — its keys are held via DKMS and
    /// never exist outside the TEE.
    function provisionGuardian(address covenant, bytes32 termsHash) external returns (address guardian);
}

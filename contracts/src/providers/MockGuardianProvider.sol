// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IGuardianProvider} from "../interfaces/IGuardianProvider.sol";

/**
 * Test/demo provider for environments without the Ritual precompiles
 * (local anvil, pre-release testnets). Hands out a caller-chosen
 * guardian address so tests and demos can drive guardian actions from
 * an EOA. Never deploy behind a production factory.
 */
contract MockGuardianProvider is IGuardianProvider {
    event GuardianProvisioned(address indexed covenant, address indexed guardian, bytes32 termsHash);

    address public owner;
    address public nextGuardian;

    constructor(address defaultGuardian) {
        owner = msg.sender;
        nextGuardian = defaultGuardian;
    }

    /// The guardian address returned by subsequent provisionGuardian calls.
    function setNextGuardian(address guardian) external {
        require(msg.sender == owner, "MockGuardianProvider: not owner");
        nextGuardian = guardian;
    }

    function provisionGuardian(address covenant, bytes32 termsHash) external returns (address guardian) {
        guardian = nextGuardian;
        require(guardian != address(0), "MockGuardianProvider: no guardian set");
        emit GuardianProvisioned(covenant, guardian, termsHash);
    }
}

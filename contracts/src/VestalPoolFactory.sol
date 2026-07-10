// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {LaunchPool} from "./LaunchPool.sol";

/**
 * Permissionless registry of LaunchPools: one native-paired pool per
 * token, discoverable on-chain so the frontend can resolve token →
 * market with a single read. Deployed separately from the launch
 * factory so existing launches get markets without redeploying the
 * protocol.
 */
contract VestalPoolFactory {
    error PoolExists(address pool);
    error ZeroAddress();

    event PoolCreated(address indexed token, address indexed pool, address indexed creator);

    /// token → its LaunchPool (zero if no market yet).
    mapping(address => address) public poolOf;

    function createPool(address token) external returns (address pool) {
        if (token == address(0)) revert ZeroAddress();
        if (poolOf[token] != address(0)) revert PoolExists(poolOf[token]);
        pool = address(new LaunchPool(token));
        poolOf[token] = pool;
        emit PoolCreated(token, pool, msg.sender);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {VestalPoolFactory} from "../src/VestalPoolFactory.sol";
import {LaunchPool} from "../src/LaunchPool.sol";
import {VestalToken} from "../src/VestalToken.sol";
import {GuardianCovenant} from "../src/GuardianCovenant.sol";

/**
 * Deploys the market layer (VestalPoolFactory) and, if TOKEN is set,
 * makes that launch tradable end-to-end as its creator:
 *
 *   1. create the LaunchPool,
 *   2. seed liquidity (SEED_NATIVE_WEI + SEED_TOKENS_WEI),
 *   3. lock the LP shares into the launch's GuardianCovenant — the
 *      "LP locked" line on every token page becomes literal custody.
 *
 * Run as the launch creator; seeding transfers tokens out of the
 * creator's wallet, so the covenant's sell cap applies — keep
 * SEED_TOKENS_WEI under devWalletCapBps of current holdings.
 *
 *   TOKEN=0x... forge script script/DeployMarket.s.sol \
 *     --rpc-url $RITUAL_RPC_URL --broadcast
 *
 * After deployment, copy the printed pool-factory address into the
 * frontend's src/config/ritual.js VESTAL_CONTRACTS block.
 */
contract DeployMarket is Script {
    function run() external {
        address tokenAddr = vm.envOr("TOKEN", address(0));
        uint256 seedNative = vm.envOr("SEED_NATIVE_WEI", uint256(0.1 ether));
        uint256 seedTokens = vm.envOr("SEED_TOKENS_WEI", uint256(10_000_000e18));

        vm.startBroadcast();

        VestalPoolFactory poolFactory = new VestalPoolFactory();
        console.log("VestalPoolFactory: %s", address(poolFactory));

        if (tokenAddr != address(0)) {
            VestalToken token = VestalToken(tokenAddr);
            LaunchPool pool = LaunchPool(poolFactory.createPool(tokenAddr));

            token.approve(address(pool), seedTokens);
            // First deposit into a pool this script just created: the share
            // count is sqrt(native * tokens), deterministic, so no slippage
            // floor is needed.
            uint256 shares = pool.addLiquidity{value: seedNative}(seedTokens, 0);
            console.log("Pool for %s: %s", token.symbol(), address(pool));
            console.log("  seeded %s wei native / %s token wei", seedNative, seedTokens);

            GuardianCovenant covenant = GuardianCovenant(address(token.covenant()));
            pool.approve(address(covenant), shares);
            covenant.lockLp(address(pool), shares);
            console.log("  %s LP shares locked in covenant %s", shares, address(covenant));
        }

        vm.stopBroadcast();

        console.log("");
        console.log("Update src/config/ritual.js VESTAL_CONTRACTS:");
        console.log("  POOL_FACTORY: %s", address(poolFactory));
    }
}

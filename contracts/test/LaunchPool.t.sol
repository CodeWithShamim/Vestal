// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {VestalToken} from "../src/VestalToken.sol";
import {GuardianCovenant} from "../src/GuardianCovenant.sol";
import {VestalLaunchFactory} from "../src/VestalLaunchFactory.sol";
import {CovenantRegistry} from "../src/CovenantRegistry.sol";
import {MockGuardianProvider} from "../src/providers/MockGuardianProvider.sol";
import {CovenantTerms, VestingTranche} from "../src/interfaces/ICovenant.sol";
import {LaunchPool} from "../src/LaunchPool.sol";
import {VestalPoolFactory} from "../src/VestalPoolFactory.sol";

/**
 * LaunchPool against a real Vestal launch, so the covenant hook runs on
 * every pool interaction exactly as it will on testnet.
 */
contract LaunchPoolTest is Test {
    CovenantRegistry registry;
    MockGuardianProvider provider;
    VestalLaunchFactory factory;
    VestalPoolFactory poolFactory;

    address creator = makeAddr("creator");
    address guardian = makeAddr("guardian");
    address treasury = makeAddr("treasury");
    address buyer = makeAddr("buyer");

    VestalToken token;
    GuardianCovenant covenant;
    LaunchPool pool;

    uint256 constant SUPPLY = 1_000_000_000e18;
    uint32 constant SELL_WINDOW = 1_296_000;

    // Creator holds 85% after launch; 2% cap ⇒ 17M tokens movable per window.
    uint256 constant SEED_TOKENS = 10_000_000e18;
    uint256 constant SEED_NATIVE = 10 ether;

    function setUp() public {
        vm.roll(100);
        registry = new CovenantRegistry();
        provider = new MockGuardianProvider(guardian);
        factory = new VestalLaunchFactory(address(registry), address(provider));
        registry.setFactory(address(factory));
        poolFactory = new VestalPoolFactory();

        VestingTranche[] memory tr = new VestingTranche[](3);
        tr[0] = VestingTranche("Treasury tranche 1 of 3", 500, 700_000, treasury, false);
        tr[1] = VestingTranche("Treasury tranche 2 of 3", 500, 1_300_000, treasury, false);
        tr[2] = VestingTranche("Treasury tranche 3 of 3", 500, 1_900_000, treasury, false);
        CovenantTerms memory terms = CovenantTerms({
            lpLockUntilBlock: 5_000_000,
            lpLockedBps: 10_000,
            devWalletCapBps: 200,
            sellWindowBlocks: SELL_WINDOW,
            monitorEveryBlocks: 300
        });

        vm.prank(creator);
        (address t, address c,) =
            factory.createLaunch(VestalLaunchFactory.TokenParams("Aurum", "AUR", SUPPLY), terms, tr);
        token = VestalToken(t);
        covenant = GuardianCovenant(c);

        pool = LaunchPool(poolFactory.createPool(t));
        vm.deal(creator, 100 ether);
        vm.deal(buyer, 100 ether);
    }

    function _seed() internal returns (uint256 shares) {
        vm.startPrank(creator);
        token.approve(address(pool), SEED_TOKENS);
        shares = pool.addLiquidity{value: SEED_NATIVE}(SEED_TOKENS);
        vm.stopPrank();
    }

    function test_createPool_oncePerToken() public {
        assertEq(poolFactory.poolOf(address(token)), address(pool));
        vm.expectRevert(abi.encodeWithSelector(VestalPoolFactory.PoolExists.selector, address(pool)));
        poolFactory.createPool(address(token));
    }

    function test_addLiquidity_setsReservesAndShares() public {
        uint256 shares = _seed();
        assertGt(shares, 0);
        assertEq(pool.balanceOf(creator), shares);
        assertEq(pool.reserveNative(), SEED_NATIVE);
        assertEq(pool.reserveToken(), SEED_TOKENS);
        // price = native/token, 1e18-scaled: 10e18 * 1e18 / 10_000_000e18 = 1e12
        assertEq(pool.priceX18(), 1e12);
    }

    function test_buy_transfersTokensAndMovesPrice() public {
        _seed();
        uint256 priceBefore = pool.priceX18();
        uint256 quoted = pool.quoteBuy(1 ether);

        vm.prank(buyer);
        uint256 got = pool.buy{value: 1 ether}(quoted);

        assertEq(got, quoted);
        assertEq(token.balanceOf(buyer), got);
        assertEq(pool.reserveNative(), SEED_NATIVE + 1 ether);
        assertGt(pool.priceX18(), priceBefore);
    }

    function test_buy_slippageGuard() public {
        _seed();
        uint256 quoted = pool.quoteBuy(1 ether);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(LaunchPool.SlippageExceeded.selector, quoted, quoted + 1));
        pool.buy{value: 1 ether}(quoted + 1);
    }

    function test_sell_roundTrip() public {
        _seed();
        vm.startPrank(buyer);
        uint256 got = pool.buy{value: 1 ether}(0);
        token.approve(address(pool), got);
        uint256 balBefore = buyer.balance;
        uint256 nativeOut = pool.sell(got, 0);
        vm.stopPrank();

        assertEq(buyer.balance, balBefore + nativeOut);
        // Two 0.3% fees: round trip returns slightly less than 1 ether.
        assertLt(nativeOut, 1 ether);
        assertGt(nativeOut, 0.99 ether);
    }

    function test_sell_covenantCapBitesInPool() public {
        _seed(); // creator already moved 10M of ~17M cap into the pool
        uint256 overCap = 8_000_000e18; // pushes past the 2% window cap
        vm.startPrank(creator);
        token.approve(address(pool), overCap);
        vm.expectRevert(); // GuardianCovenant.SellCapExceeded via token hook
        pool.sell(overCap, 0);
        vm.stopPrank();
    }

    function test_removeLiquidity_returnsBothSides() public {
        uint256 shares = _seed();
        uint256 balNative = creator.balance;
        uint256 balToken = token.balanceOf(creator);

        vm.prank(creator);
        (uint256 nativeOut, uint256 tokenOut) = pool.removeLiquidity(shares, creator);

        assertEq(nativeOut, SEED_NATIVE);
        assertEq(tokenOut, SEED_TOKENS);
        assertEq(creator.balance, balNative + SEED_NATIVE);
        assertEq(token.balanceOf(creator), balToken + SEED_TOKENS);
        assertEq(pool.totalSupply(), 0);
    }

    function test_lpSharesLockIntoCovenant() public {
        uint256 shares = _seed();
        vm.startPrank(creator);
        pool.approve(address(covenant), shares);
        covenant.lockLp(address(pool), shares);
        vm.stopPrank();

        assertEq(pool.balanceOf(address(covenant)), shares);
        assertEq(covenant.lpAmount(), shares);
        // Locked shares cannot be pulled back before the unlock block.
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(GuardianCovenant.LpStillLocked.selector, uint64(5_000_000)));
        covenant.withdrawLp(creator);
    }

    function test_quotesMatchExecution() public {
        _seed();
        uint256 qBuy = pool.quoteBuy(0.5 ether);
        vm.prank(buyer);
        assertEq(pool.buy{value: 0.5 ether}(0), qBuy);

        uint256 qSell = pool.quoteSell(qBuy);
        vm.startPrank(buyer);
        token.approve(address(pool), qBuy);
        assertEq(pool.sell(qBuy, 0), qSell);
        vm.stopPrank();
    }
}

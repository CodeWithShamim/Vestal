// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "./lib/ERC20.sol";

/**
 * The trading venue for a Vestal launch: a minimal constant-product AMM
 * pairing the launch token against the chain's native coin (tRITUAL).
 *
 * LP shares are themselves an ERC20, deliberately: the creator seeds
 * liquidity here, then locks the shares into the launch's
 * GuardianCovenant via lockLp() — the same covenant that vests the team
 * allocation takes custody of the market's liquidity until the
 * committed unlock block. Nothing in this pool is Vestal-privileged:
 * no owner, no fee switch, no pause.
 *
 * Enforcement interplay is free: selling into the pool is a token
 * transfer out of the seller's wallet, so the covenant's sell-cap and
 * freeze checks run on every sell at the token level.
 *
 * Every trade emits Swap with the post-trade price (native per token,
 * 1e18-scaled) — the frontend's price chart is a straight event read.
 */
contract LaunchPool is ERC20 {
    error ZeroAmount();
    error ZeroShares();
    error NoLiquidity();
    error SlippageExceeded(uint256 out, uint256 minOut);
    error NativeSendFailed();
    error Reentrancy();

    event LiquidityAdded(address indexed provider, uint256 nativeIn, uint256 tokenIn, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 nativeOut, uint256 tokenOut, uint256 shares);
    event Swap(address indexed trader, bool indexed isBuy, uint256 nativeAmount, uint256 tokenAmount, uint256 priceX18);

    /// 0.3% swap fee, paid to the pool (accrues to LP shares).
    uint256 public constant FEE_BPS = 30;
    uint256 internal constant BPS = 10_000;

    ERC20 public immutable token;

    /// Reserves are tracked explicitly so stray donations cannot skew pricing.
    uint256 public reserveNative;
    uint256 public reserveToken;

    uint256 private _locked = 1;

    modifier lock() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address token_) ERC20(string.concat("Vestal LP: ", ERC20(token_).symbol()), "vLP") {
        token = ERC20(token_);
    }

    // ------------------------------------------------------------------
    // Liquidity
    // ------------------------------------------------------------------

    /// Deposit native + tokens (approve tokens first). The first deposit
    /// sets the price; later deposits must roughly match the current
    /// ratio — excess of either side simply improves the price for the
    /// other, so callers should quote first.
    function addLiquidity(uint256 tokenIn) external payable lock returns (uint256 shares) {
        if (msg.value == 0 || tokenIn == 0) revert ZeroAmount();
        uint256 supply = totalSupply;
        shares = supply == 0
            ? _sqrt(msg.value * tokenIn)
            : _min((msg.value * supply) / reserveNative, (tokenIn * supply) / reserveToken);
        if (shares == 0) revert ZeroShares();

        require(token.transferFrom(msg.sender, address(this), tokenIn), "LaunchPool: token transfer failed");
        reserveNative += msg.value;
        reserveToken += tokenIn;
        _mint(msg.sender, shares);
        emit LiquidityAdded(msg.sender, msg.value, tokenIn, shares);
    }

    /// Burn shares for the proportional slice of both reserves.
    function removeLiquidity(uint256 shares, address to) external lock returns (uint256 nativeOut, uint256 tokenOut) {
        uint256 supply = totalSupply;
        if (shares == 0 || supply == 0) revert ZeroShares();
        nativeOut = (reserveNative * shares) / supply;
        tokenOut = (reserveToken * shares) / supply;

        _burn(msg.sender, shares);
        reserveNative -= nativeOut;
        reserveToken -= tokenOut;
        require(token.transfer(to, tokenOut), "LaunchPool: token transfer failed");
        _sendNative(to, nativeOut);
        emit LiquidityRemoved(msg.sender, nativeOut, tokenOut, shares);
    }

    // ------------------------------------------------------------------
    // Swaps
    // ------------------------------------------------------------------

    /// Buy launch tokens with native coin.
    function buy(uint256 minTokensOut) external payable lock returns (uint256 tokensOut) {
        if (msg.value == 0) revert ZeroAmount();
        tokensOut = _quote(msg.value, reserveNative, reserveToken);
        if (tokensOut < minTokensOut) revert SlippageExceeded(tokensOut, minTokensOut);

        reserveNative += msg.value;
        reserveToken -= tokensOut;
        require(token.transfer(msg.sender, tokensOut), "LaunchPool: token transfer failed");
        emit Swap(msg.sender, true, msg.value, tokensOut, priceX18());
    }

    /// Sell launch tokens for native coin (approve first). The token's
    /// covenant hook runs on the transfer in — a capped or frozen wallet
    /// reverts here, which is the enforcement working as committed.
    function sell(uint256 tokenIn, uint256 minNativeOut) external lock returns (uint256 nativeOut) {
        if (tokenIn == 0) revert ZeroAmount();
        nativeOut = _quote(tokenIn, reserveToken, reserveNative);
        if (nativeOut < minNativeOut) revert SlippageExceeded(nativeOut, minNativeOut);

        require(token.transferFrom(msg.sender, address(this), tokenIn), "LaunchPool: token transfer failed");
        reserveToken += tokenIn;
        reserveNative -= nativeOut;
        _sendNative(msg.sender, nativeOut);
        emit Swap(msg.sender, false, nativeOut, tokenIn, priceX18());
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function reserves() external view returns (uint256 native_, uint256 token_) {
        return (reserveNative, reserveToken);
    }

    /// Spot price: native wei per whole token, scaled by 1e18.
    function priceX18() public view returns (uint256) {
        if (reserveToken == 0) return 0;
        return (reserveNative * 1e18) / reserveToken;
    }

    function quoteBuy(uint256 nativeIn) external view returns (uint256 tokensOut) {
        return _quote(nativeIn, reserveNative, reserveToken);
    }

    function quoteSell(uint256 tokenIn) external view returns (uint256 nativeOut) {
        return _quote(tokenIn, reserveToken, reserveNative);
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    /// Constant-product output after the 0.3% fee.
    function _quote(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        if (reserveIn == 0 || reserveOut == 0) revert NoLiquidity();
        uint256 inWithFee = amountIn * (BPS - FEE_BPS);
        return (reserveOut * inWithFee) / (reserveIn * BPS + inWithFee);
    }

    function _burn(address from, uint256 shares) internal {
        uint256 bal = balanceOf[from];
        require(bal >= shares, "LaunchPool: insufficient shares");
        unchecked {
            balanceOf[from] = bal - shares;
            totalSupply -= shares;
        }
        emit Transfer(from, address(0), shares);
    }

    function _sendNative(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert NativeSendFailed();
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}

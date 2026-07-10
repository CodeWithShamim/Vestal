// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "./lib/ERC20.sol";
import {ICovenantHook} from "./interfaces/ICovenant.sol";

/**
 * A Vestal-launched token.
 *
 * Fixed supply, minted once by the factory at launch and split between
 * the creator and the covenant (which takes custody of the vesting and
 * LP allocations). Every transfer is checked by the covenant before it
 * moves: frozen wallets and sell-cap violations revert at the token
 * level, so enforcement is not a promise layered on top of the token —
 * it is the token.
 *
 * The covenant address is set exactly once, by the factory, during
 * launch. There is no admin, no upgrade path, and no way to detach the
 * covenant afterward.
 */
contract VestalToken is ERC20 {
    address public immutable factory;
    ICovenantHook public covenant;

    constructor(string memory name_, string memory symbol_, uint256 supply, address supplyRecipient)
        ERC20(name_, symbol_)
    {
        factory = msg.sender;
        _mint(supplyRecipient, supply);
    }

    /// One-shot covenant binding; only the deploying factory, only once.
    function bindCovenant(address covenant_) external {
        require(msg.sender == factory, "VestalToken: not factory");
        require(address(covenant) == address(0), "VestalToken: covenant already bound");
        require(covenant_ != address(0), "VestalToken: zero covenant");
        covenant = ICovenantHook(covenant_);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        // The covenant itself moves tokens when executing releases and
        // returning unlocked LP; those moves are the enforcement, not
        // its subject.
        if (address(covenant) != address(0) && from != address(covenant)) {
            covenant.beforeTokenTransfer(from, to, amount);
        }
    }
}

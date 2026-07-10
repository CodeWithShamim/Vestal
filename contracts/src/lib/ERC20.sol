// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * Minimal ERC20 base, dependency-free.
 *
 * Deliberately small so the whole token surface is auditable in one file:
 * fixed supply minted once in the constructor, no owner, no pause, no
 * upgrade path. Subclasses override _beforeTokenTransfer to add rules;
 * VestalToken uses that single hook to route every transfer through its
 * covenant.
 */
abstract contract ERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ERC20: insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "ERC20: transfer to zero");
        _beforeTokenTransfer(from, to, amount);
        uint256 fromBal = balanceOf[from];
        require(fromBal >= amount, "ERC20: insufficient balance");
        unchecked {
            balanceOf[from] = fromBal - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    /// Mint is constructor-only in subclasses; there is no public path.
    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "ERC20: mint to zero");
        totalSupply += amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Transfer(address(0), to, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual {}
}

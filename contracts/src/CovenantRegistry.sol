// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * Canonical index of every Vestal launch. The Explore page enumerates
 * this; the token detail page resolves token → covenant through it.
 * Registration is factory-only; entries are append-only and immutable.
 */
contract CovenantRegistry {
    error NotFactory();
    error FactoryAlreadySet();
    error AlreadyRegistered();

    event LaunchRegistered(
        uint256 indexed index, address indexed token, address indexed covenant, address creator
    );

    struct Launch {
        address token;
        address covenant;
        address guardian;
        address creator;
        uint64 createdAtBlock;
    }

    address public factory;
    address public immutable deployer;

    Launch[] internal _launches;
    mapping(address => uint256) internal _indexByToken; // index + 1; 0 = absent

    constructor() {
        deployer = msg.sender;
    }

    /// One-shot wiring: deployer points the registry at the factory once,
    /// then holds no further power.
    function setFactory(address factory_) external {
        if (msg.sender != deployer) revert NotFactory();
        if (factory != address(0)) revert FactoryAlreadySet();
        factory = factory_;
    }

    function register(address token, address covenant, address guardian, address creator) external {
        if (msg.sender != factory) revert NotFactory();
        if (_indexByToken[token] != 0) revert AlreadyRegistered();
        _launches.push(
            Launch({
                token: token,
                covenant: covenant,
                guardian: guardian,
                creator: creator,
                createdAtBlock: uint64(block.number)
            })
        );
        _indexByToken[token] = _launches.length;
        emit LaunchRegistered(_launches.length - 1, token, covenant, creator);
    }

    function launchCount() external view returns (uint256) {
        return _launches.length;
    }

    function getLaunch(uint256 index) external view returns (Launch memory) {
        return _launches[index];
    }

    function getLaunchByToken(address token) external view returns (Launch memory launch) {
        uint256 idx = _indexByToken[token];
        require(idx != 0, "Registry: unknown token");
        return _launches[idx - 1];
    }

    function allLaunches() external view returns (Launch[] memory) {
        return _launches;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * Shared covenant types. Field semantics mirror the frontend's
 * CovenantTerms / VestingTranche / EnforcementEvent typedefs in
 * src/data/launches.js — the UI's percentages are basis points here
 * (bps / 100 = %), and every enforcement action maps to one ActionType.
 */

/// One enforcement-log entry kind. Order matches the frontend's
/// EnforcementEvent.type union: wake | release | check_ok | flag |
/// freeze | checkpoint | revival.
enum ActionType {
    Wake,
    Release,
    CheckOk,
    Flag,
    Freeze,
    Checkpoint,
    Revival
}

/// Derived guardian status shown on cards and the Guardian Panel.
enum GuardianStatus {
    Active,
    Enforcing,
    Reviving
}

struct VestingTranche {
    /// Human label, e.g. "Team tranche 2 of 8".
    string label;
    /// Share of total token supply in this tranche, in bps.
    uint16 supplyBps;
    /// Block at which the guardian may release it.
    uint64 releaseAtBlock;
    /// Where the release goes (team / treasury / contributors).
    address recipient;
    bool released;
}

struct CovenantTerms {
    /// LP custody cannot leave the covenant before this block.
    uint64 lpLockUntilBlock;
    /// Share of LP under guardian custody, in bps (informational).
    uint16 lpLockedBps;
    /// Max share of a tracked wallet's holdings sellable per window, bps.
    uint16 devWalletCapBps;
    /// Rolling sell-cap window length, in blocks (~30 days on testnet).
    uint32 sellWindowBlocks;
    /// Guardian audit cadence — it wakes itself this often via Scheduler.
    uint32 monitorEveryBlocks;
}

interface ICovenantHook {
    /// Called by VestalToken on every transfer; reverts on covenant
    /// violations (frozen wallet, sell cap exceeded).
    function beforeTokenTransfer(address from, address to, uint256 amount) external;
}

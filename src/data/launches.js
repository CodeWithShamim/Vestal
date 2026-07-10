/**
 * Launch shape + derived values and formatters. All launch data is read
 * from the chain (src/chain/launches.js → CovenantRegistry) and mapped
 * into the Launch typedef below — this module holds no data of its own.
 */

import { BLOCK_TIME_SECONDS } from '../config/ritual.js';

/**
 * @typedef {'active' | 'enforcing' | 'reviving'} GuardianStatus
 *
 * @typedef {Object} VestingTranche
 * @property {string} label       Human label, e.g. "Team tranche 2 of 8"
 * @property {number} pct         Percent of total supply in this tranche
 * @property {number} atBlock     Block at which the guardian releases it
 * @property {boolean} released   Whether the guardian has executed the release
 *
 * @typedef {Object} EnforcementEvent
 * @property {number} block
 * @property {'wake'|'release'|'check_ok'|'flag'|'freeze'|'checkpoint'|'revival'} type
 * @property {string} detail      One-line human-readable description
 * @property {string} attestation TEE attestation hash for the action
 *
 * @typedef {Object} Guardian
 * @property {string} address           Agent's own address (keys held via DKMS)
 * @property {string} model             Attested guardian build identifier
 * @property {number} deployedBlock
 * @property {number} lastHeartbeatBlock
 * @property {number} revivals          Times consensus revived it from checkpoint
 * @property {GuardianStatus} status
 *
 * @typedef {Object} CovenantTerms
 * @property {number} lpLockUntilBlock
 * @property {number} lpPctLocked        Percent of LP under guardian custody
 * @property {number} devWalletCapPct    Max % of dev holdings sellable per 30 days
 * @property {number} monitorEveryBlocks Guardian audit cadence
 * @property {VestingTranche[]} vesting
 *
 * @typedef {Object} Launch
 * @property {string} id           Token address (lowercase)
 * @property {string} name
 * @property {string} symbol
 * @property {string} tagline
 * @property {string} description
 * @property {string} creator      Creator address
 * @property {number} createdAtBlock
 * @property {Guardian} guardian
 * @property {CovenantTerms} terms
 * @property {EnforcementEvent[]} log  Newest first
 */

// ---------------------------------------------------------------------------
// Derived values & formatters (UI depends only on these, not raw fields)
// ---------------------------------------------------------------------------

/** Percent of the vesting allocation already released by the guardian. */
export function vestedPct(launch) {
  const total = launch.terms.vesting.reduce((s, t) => s + t.pct, 0);
  if (!total) return 0;
  const done = launch.terms.vesting.filter((t) => t.released).reduce((s, t) => s + t.pct, 0);
  return Math.round((done / total) * 100);
}

/**
 * Guardian trust score, derived purely from enforcement history:
 * successful audits and on-schedule releases raise it; violations found
 * (which prove enforcement works, but indicate a misbehaving team) lower it.
 * Range 0–100.
 */
export function trustScore(launch) {
  let score = 62;
  for (const e of launch.log) {
    if (e.type === 'check_ok' || e.type === 'checkpoint') score += 2;
    if (e.type === 'wake') score += 1;
    if (e.type === 'release') score += 5;
    if (e.type === 'flag') score -= 6;
    if (e.type === 'freeze') score -= 12;
  }
  if (launch.guardian.revivals > 0) score += 2; // survived a crash: resilience proven
  return Math.max(5, Math.min(99, score));
}

export function blocksToApproxTime(blocks) {
  const secs = Math.max(0, blocks) * BLOCK_TIME_SECONDS;
  if (secs < 60) return `~${Math.round(secs)}s`;
  if (secs < 3600) return `~${Math.round(secs / 60)}m`;
  if (secs < 86400) return `~${Math.round(secs / 3600)}h`;
  return `~${Math.round(secs / 86400)}d`;
}

export function fmtBlock(n) {
  return n.toLocaleString('en-US');
}

export function shortAddr(a) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function shortHash(h) {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

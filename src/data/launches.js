/**
 * MOCK DATA MODULE — every number on the site that looks live comes from here.
 *
 * Shapes are documented with JSDoc typedefs so real chain reads (via viem
 * against the contracts/precompiles in src/config/ritual.js) can replace this
 * module without touching any UI component. Keep the exported names and
 * shapes stable when you swap in real data.
 */

import { BLOCK_TIME_SECONDS } from '../config/ritual.js';

/** The block height the mock dataset pretends is "now". */
export const CURRENT_BLOCK = 8_412_930;

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
 * @property {string} attestation TEE attestation hash for the action (mock)
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
 * @typedef {Object} MarketMock
 * @property {number} priceUsd
 * @property {number} change24h   Percent, signed
 * @property {number} guardedUsd  Value under guardian custody (LP + unvested)
 * @property {number} holders
 *
 * @typedef {Object} Launch
 * @property {string} id
 * @property {string} name
 * @property {string} symbol
 * @property {string} tagline
 * @property {string} description
 * @property {string} creator      Creator address (mock)
 * @property {number} createdAtBlock
 * @property {Guardian} guardian
 * @property {CovenantTerms} terms
 * @property {MarketMock} market
 * @property {EnforcementEvent[]} log  Newest first
 */

// ---------------------------------------------------------------------------
// Deterministic pseudo-random helpers (so mock hashes/series are stable)
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic mock hex string (attestation hashes, addresses). */
export function mockHex(key, bytes = 32) {
  const rnd = mulberry32(seedFrom(key));
  let out = '0x';
  for (let i = 0; i < bytes * 2; i++) out += '0123456789abcdef'[Math.floor(rnd() * 16)];
  return out;
}

const addr = (key) => mockHex(key, 20);

// ---------------------------------------------------------------------------
// Enforcement log generation
// ---------------------------------------------------------------------------

const EVENT_COPY = {
  wake: (sym) => `Scheduled wake executed via native Scheduler — covenant state for ${sym} re-verified`,
  check_ok: () => `Dev and insider wallets audited against sell-limit — no violations`,
  checkpoint: () => `State checkpoint written via persistent-agent precompile; heartbeat emitted`,
  release: (sym, pct) => `Vesting release executed: ${pct}% of ${sym} supply transferred per schedule`,
  flag: () => `Dev wallet outflow approached committed cap — wallet placed under tightened monitoring`,
  freeze: () => `Covenant violation: dev wallet exceeded 30-day sell cap — excess transfer frozen`,
  revival: () => `Missed heartbeat detected by consensus — agent revived from last checkpoint with full state`,
};

/**
 * Build a plausible newest-first enforcement log for a launch.
 * @param {string} id
 * @param {string} symbol
 * @param {number} lastBlock
 * @param {number} everyBlocks
 * @param {Array<{offset: number, type: EnforcementEvent['type'], detail?: string}>} specials
 * @returns {EnforcementEvent[]}
 */
function buildLog(id, symbol, lastBlock, everyBlocks, specials = []) {
  const rnd = mulberry32(seedFrom(id + ':log'));
  /** @type {EnforcementEvent[]} */
  const events = [];
  let block = lastBlock;
  const cycle = ['checkpoint', 'check_ok', 'wake', 'check_ok', 'checkpoint', 'wake'];
  for (let i = 0; i < 6; i++) {
    const type = cycle[i];
    events.push({
      block,
      type,
      detail: EVENT_COPY[type](symbol),
      attestation: mockHex(`${id}:att:${i}`),
    });
    block -= everyBlocks + Math.floor(rnd() * everyBlocks * 0.2);
  }
  for (const s of specials) {
    events.push({
      block: lastBlock - s.offset,
      type: s.type,
      detail: s.detail ?? EVENT_COPY[s.type](symbol, s.pct),
      attestation: mockHex(`${id}:att:special:${s.offset}`),
    });
  }
  return events.sort((a, b) => b.block - a.block);
}

// ---------------------------------------------------------------------------
// The launches
// ---------------------------------------------------------------------------

const guardianModel = (n) => `vestal-guardian/1.${n} · TEE build ${mockHex('build' + n, 4)}`;

/** @type {Launch[]} */
export const LAUNCHES = [
  {
    id: 'aurum',
    name: 'Aurum',
    symbol: 'AUR',
    tagline: 'A reserve-asset experiment with a decade-long covenant.',
    description:
      'Aurum is a testnet reserve-asset experiment: 40% of supply vests to its treasury over ten years, released tranche by tranche by its guardian. The team cannot accelerate a single block of it — the schedule was committed at launch and the guardian holds the keys.',
    creator: addr('aurum:creator'),
    createdAtBlock: 6_120_400,
    guardian: {
      address: addr('aurum:guardian'),
      model: guardianModel(2),
      deployedBlock: 6_120_412,
      lastHeartbeatBlock: CURRENT_BLOCK - 9,
      revivals: 1,
      status: 'active',
    },
    terms: {
      lpLockUntilBlock: 22_000_000,
      lpPctLocked: 100,
      devWalletCapPct: 2,
      monitorEveryBlocks: 300,
      vesting: [
        { label: 'Treasury tranche 1 of 8', pct: 5, atBlock: 6_700_000, released: true },
        { label: 'Treasury tranche 2 of 8', pct: 5, atBlock: 7_300_000, released: true },
        { label: 'Treasury tranche 3 of 8', pct: 5, atBlock: 7_900_000, released: true },
        { label: 'Treasury tranche 4 of 8', pct: 5, atBlock: 8_500_000, released: false },
        { label: 'Treasury tranche 5 of 8', pct: 5, atBlock: 9_100_000, released: false },
        { label: 'Treasury tranche 6 of 8', pct: 5, atBlock: 9_700_000, released: false },
        { label: 'Treasury tranche 7 of 8', pct: 5, atBlock: 10_300_000, released: false },
        { label: 'Treasury tranche 8 of 8', pct: 5, atBlock: 10_900_000, released: false },
      ],
    },
    market: { priceUsd: 1.84, change24h: 3.2, guardedUsd: 1_240_000, holders: 4_812 },
    log: buildLog('aurum', 'AUR', CURRENT_BLOCK - 9, 300, [
      { offset: 512_930, type: 'release', pct: 5 },
      {
        offset: 1_030_000,
        type: 'revival',
        detail:
          'Executor missed 2 consecutive heartbeats — consensus revived the guardian from checkpoint at block 7,382,410. No covenant state lost.',
      },
    ]),
  },
  {
    id: 'northlight',
    name: 'Northlight',
    symbol: 'NLT',
    tagline: 'Community energy credits with a four-year team lock.',
    description:
      'Northlight tokenizes testnet energy credits for a research co-op. Its covenant is deliberately conservative: the full team allocation vests over four years and the LP is locked for two, with the guardian auditing insider wallets every 600 blocks.',
    creator: addr('northlight:creator'),
    createdAtBlock: 7_010_220,
    guardian: {
      address: addr('northlight:guardian'),
      model: guardianModel(2),
      deployedBlock: 7_010_231,
      lastHeartbeatBlock: CURRENT_BLOCK - 41,
      revivals: 0,
      status: 'active',
    },
    terms: {
      lpLockUntilBlock: 38_500_000,
      lpPctLocked: 100,
      devWalletCapPct: 1,
      monitorEveryBlocks: 600,
      vesting: [
        { label: 'Team tranche 1 of 4', pct: 4, atBlock: 8_100_000, released: true },
        { label: 'Team tranche 2 of 4', pct: 4, atBlock: 9_200_000, released: false },
        { label: 'Team tranche 3 of 4', pct: 4, atBlock: 10_300_000, released: false },
        { label: 'Team tranche 4 of 4', pct: 4, atBlock: 11_400_000, released: false },
      ],
    },
    market: { priceUsd: 0.42, change24h: -1.1, guardedUsd: 684_000, holders: 2_204 },
    log: buildLog('northlight', 'NLT', CURRENT_BLOCK - 41, 600, [{ offset: 312_900, type: 'release', pct: 4 }]),
  },
  {
    id: 'basalt',
    name: 'Basalt',
    symbol: 'BSLT',
    tagline: 'Validator-infrastructure token, LP locked to 2027.',
    description:
      'Basalt funds shared validator infrastructure. Nearly all value sits in its locked LP; the guardian holds it until block 30,000,000 and publishes an attested audit of insider wallets every 1,200 blocks.',
    creator: addr('basalt:creator'),
    createdAtBlock: 6_840_100,
    guardian: {
      address: addr('basalt:guardian'),
      model: guardianModel(1),
      deployedBlock: 6_840_115,
      lastHeartbeatBlock: CURRENT_BLOCK - 220,
      revivals: 0,
      status: 'active',
    },
    terms: {
      lpLockUntilBlock: 30_000_000,
      lpPctLocked: 100,
      devWalletCapPct: 3,
      monitorEveryBlocks: 1_200,
      vesting: [
        { label: 'Core tranche 1 of 2', pct: 6, atBlock: 9_000_000, released: false },
        { label: 'Core tranche 2 of 2', pct: 6, atBlock: 12_000_000, released: false },
      ],
    },
    market: { priceUsd: 3.1, change24h: 0.4, guardedUsd: 512_000, holders: 1_130 },
    log: buildLog('basalt', 'BSLT', CURRENT_BLOCK - 220, 1_200),
  },
  {
    id: 'kiln',
    name: 'Kiln',
    symbol: 'KILN',
    tagline: 'Creator-economy token — currently under active enforcement.',
    description:
      'Kiln is the launch that proves the system has teeth. Eleven days ago its dev wallet attempted to move 4.6% of holdings in a 30-day window against a committed 2% cap. The guardian froze the excess, published the attestation, and tightened its audit cadence. No human intervened.',
    creator: addr('kiln:creator'),
    createdAtBlock: 7_610_500,
    guardian: {
      address: addr('kiln:guardian'),
      model: guardianModel(2),
      deployedBlock: 7_610_512,
      lastHeartbeatBlock: CURRENT_BLOCK - 15,
      revivals: 0,
      status: 'enforcing',
    },
    terms: {
      lpLockUntilBlock: 18_000_000,
      lpPctLocked: 95,
      devWalletCapPct: 2,
      monitorEveryBlocks: 150,
      vesting: [
        { label: 'Creator tranche 1 of 6', pct: 3, atBlock: 8_200_000, released: true },
        { label: 'Creator tranche 2 of 6', pct: 3, atBlock: 8_800_000, released: false },
        { label: 'Creator tranche 3 of 6', pct: 3, atBlock: 9_400_000, released: false },
        { label: 'Creator tranche 4 of 6', pct: 3, atBlock: 10_000_000, released: false },
        { label: 'Creator tranche 5 of 6', pct: 3, atBlock: 10_600_000, released: false },
        { label: 'Creator tranche 6 of 6', pct: 3, atBlock: 11_200_000, released: false },
      ],
    },
    market: { priceUsd: 0.087, change24h: -6.8, guardedUsd: 296_000, holders: 3_540 },
    log: buildLog('kiln', 'KILN', CURRENT_BLOCK - 15, 150, [
      { offset: 460_000, type: 'flag' },
      { offset: 458_200, type: 'freeze' },
      {
        offset: 455_900,
        type: 'wake',
        detail: 'Post-enforcement audit: frozen amount escrowed under guardian custody pending covenant terms. Monitoring cadence tightened to every 150 blocks.',
      },
    ]),
  },
  {
    id: 'solenne',
    name: 'Solenne',
    symbol: 'SLN',
    tagline: 'Solar DePIN rewards with monthly guardian releases.',
    description:
      'Solenne meters testnet solar-node rewards. Its guardian releases contributor rewards monthly and holds the LP until mid-2027 — a covenant designed so node operators never depend on the founding team staying solvent, or honest.',
    creator: addr('solenne:creator'),
    createdAtBlock: 7_205_800,
    guardian: {
      address: addr('solenne:guardian'),
      model: guardianModel(2),
      deployedBlock: 7_205_808,
      lastHeartbeatBlock: CURRENT_BLOCK - 88,
      revivals: 0,
      status: 'active',
    },
    terms: {
      lpLockUntilBlock: 26_000_000,
      lpPctLocked: 100,
      devWalletCapPct: 2,
      monitorEveryBlocks: 600,
      vesting: [
        { label: 'Contributor tranche 1 of 5', pct: 4, atBlock: 7_900_000, released: true },
        { label: 'Contributor tranche 2 of 5', pct: 4, atBlock: 8_600_000, released: false },
        { label: 'Contributor tranche 3 of 5', pct: 4, atBlock: 9_300_000, released: false },
        { label: 'Contributor tranche 4 of 5', pct: 4, atBlock: 10_000_000, released: false },
        { label: 'Contributor tranche 5 of 5', pct: 4, atBlock: 10_700_000, released: false },
      ],
    },
    market: { priceUsd: 0.66, change24h: 2.0, guardedUsd: 431_000, holders: 1_988 },
    log: buildLog('solenne', 'SLN', CURRENT_BLOCK - 88, 600, [{ offset: 512_800, type: 'release', pct: 4 }]),
  },
  {
    id: 'ferro',
    name: 'Ferro',
    symbol: 'FRO',
    tagline: 'Industrial-metals index token with a hard 1% dev cap.',
    description:
      'Ferro tracks a synthetic industrial-metals basket. Its creators asked for the strictest dev-wallet cap on Vestal — 1% per 30 days — precisely because they wanted the market to know they could not dump even if they wished to.',
    creator: addr('ferro:creator'),
    createdAtBlock: 7_480_900,
    guardian: {
      address: addr('ferro:guardian'),
      model: guardianModel(2),
      deployedBlock: 7_480_910,
      lastHeartbeatBlock: CURRENT_BLOCK - 130,
      revivals: 0,
      status: 'active',
    },
    terms: {
      lpLockUntilBlock: 24_000_000,
      lpPctLocked: 100,
      devWalletCapPct: 1,
      monitorEveryBlocks: 300,
      vesting: [
        { label: 'Team tranche 1 of 3', pct: 5, atBlock: 9_000_000, released: false },
        { label: 'Team tranche 2 of 3', pct: 5, atBlock: 10_500_000, released: false },
        { label: 'Team tranche 3 of 3', pct: 5, atBlock: 12_000_000, released: false },
      ],
    },
    market: { priceUsd: 12.4, change24h: 1.6, guardedUsd: 388_000, holders: 742 },
    log: buildLog('ferro', 'FRO', CURRENT_BLOCK - 130, 300),
  },
  {
    id: 'oriel',
    name: 'Oriel',
    symbol: 'ORL',
    tagline: 'Oracle-network token — guardian mid-revival right now.',
    description:
      'Oriel pays testnet oracle operators. Its guardian executor went dark 140 blocks ago; consensus detected the missed heartbeat and is restoring the agent from its last checkpoint. Watch this page: the covenant, the keys, and the vesting state all survive the crash — that is the point.',
    creator: addr('oriel:creator'),
    createdAtBlock: 7_720_300,
    guardian: {
      address: addr('oriel:guardian'),
      model: guardianModel(1),
      deployedBlock: 7_720_309,
      lastHeartbeatBlock: CURRENT_BLOCK - 140,
      revivals: 2,
      status: 'reviving',
    },
    terms: {
      lpLockUntilBlock: 20_000_000,
      lpPctLocked: 100,
      devWalletCapPct: 2,
      monitorEveryBlocks: 600,
      vesting: [
        { label: 'Operator tranche 1 of 4', pct: 4, atBlock: 8_500_000, released: false },
        { label: 'Operator tranche 2 of 4', pct: 4, atBlock: 9_500_000, released: false },
        { label: 'Operator tranche 3 of 4', pct: 4, atBlock: 10_500_000, released: false },
        { label: 'Operator tranche 4 of 4', pct: 4, atBlock: 11_500_000, released: false },
      ],
    },
    market: { priceUsd: 0.21, change24h: -0.9, guardedUsd: 173_000, holders: 1_402 },
    log: buildLog('oriel', 'ORL', CURRENT_BLOCK - 140, 600, [
      {
        offset: 0,
        type: 'revival',
        detail:
          'Heartbeat missed at block 8,412,790 — consensus initiated revival from checkpoint. Covenant state intact; enforcement resumes automatically on restore.',
      },
    ]),
  },
  {
    id: 'pyre',
    name: 'Pyre',
    symbol: 'PYR',
    tagline: 'Game-economy token with per-season vesting.',
    description:
      'Pyre backs a testnet strategy game whose studio vests its allocation one game-season at a time. Players can verify — not trust — that the studio cannot sell ahead of a season it has not shipped.',
    creator: addr('pyre:creator'),
    createdAtBlock: 8_100_700,
    guardian: {
      address: addr('pyre:guardian'),
      model: guardianModel(2),
      deployedBlock: 8_100_706,
      lastHeartbeatBlock: CURRENT_BLOCK - 33,
      revivals: 0,
      status: 'active',
    },
    terms: {
      lpLockUntilBlock: 16_500_000,
      lpPctLocked: 90,
      devWalletCapPct: 3,
      monitorEveryBlocks: 300,
      vesting: [
        { label: 'Studio season 1', pct: 5, atBlock: 9_000_000, released: false },
        { label: 'Studio season 2', pct: 5, atBlock: 10_200_000, released: false },
        { label: 'Studio season 3', pct: 5, atBlock: 11_400_000, released: false },
      ],
    },
    market: { priceUsd: 0.034, change24h: 9.4, guardedUsd: 121_000, holders: 5_206 },
    log: buildLog('pyre', 'PYR', CURRENT_BLOCK - 33, 300),
  },
  {
    id: 'meridian',
    name: 'Meridian',
    symbol: 'MRD',
    tagline: 'Payments-pilot token, the newest covenant on Vestal.',
    description:
      'Meridian is a payments pilot launched days ago. Its guardian took custody at block 8,377,100 and has been auditing wallets every 300 blocks since — young launch, short history, and every block of it attested.',
    creator: addr('meridian:creator'),
    createdAtBlock: 8_377_088,
    guardian: {
      address: addr('meridian:guardian'),
      model: guardianModel(2),
      deployedBlock: 8_377_100,
      lastHeartbeatBlock: CURRENT_BLOCK - 12,
      revivals: 0,
      status: 'active',
    },
    terms: {
      lpLockUntilBlock: 21_000_000,
      lpPctLocked: 100,
      devWalletCapPct: 2,
      monitorEveryBlocks: 300,
      vesting: [
        { label: 'Team tranche 1 of 4', pct: 4, atBlock: 9_600_000, released: false },
        { label: 'Team tranche 2 of 4', pct: 4, atBlock: 10_800_000, released: false },
        { label: 'Team tranche 3 of 4', pct: 4, atBlock: 12_000_000, released: false },
        { label: 'Team tranche 4 of 4', pct: 4, atBlock: 13_200_000, released: false },
      ],
    },
    market: { priceUsd: 1.02, change24h: 0.2, guardedUsd: 92_000, holders: 318 },
    log: buildLog('meridian', 'MRD', CURRENT_BLOCK - 12, 300),
  },
];

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

export function fmtUsd(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(2)}`;
}

export function shortAddr(a) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function shortHash(h) {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

/** Deterministic illustrative price series for the chart placeholder. */
export function priceSeries(launch, points = 48) {
  const rnd = mulberry32(seedFrom(launch.id + ':price'));
  const out = [];
  const target = launch.market.priceUsd;
  let v = target * (0.82 + rnd() * 0.1);
  for (let i = 0; i < points; i++) {
    // converge toward the current price so the series ends where the ticker reads
    v = Math.max(0.000001, v + (target - v) * 0.12 + (rnd() - 0.5) * target * 0.025);
    out.push(v);
  }
  return out;
}

export function getLaunch(id) {
  return LAUNCHES.find((l) => l.id === id) ?? null;
}

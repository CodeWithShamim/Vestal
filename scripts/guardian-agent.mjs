/**
 * Real guardian agent. Runs the sovereign agent's job off-chain with the
 * guardian key until Ritual's agent precompiles (0x080C/0x0820/Scheduler)
 * go live: it sweeps every registered covenant, sends heartbeat()
 * checkpoints committed to *actual covenant state* (the checkpointHash is
 * keccak256 of a real state snapshot, re-derivable by anyone), audits the
 * tracked creator wallet against the committed sell cap via recordAudit(),
 * and executes vesting releases the moment tranches come due.
 *
 * Two operational constraints shape the loop:
 *  - guardianStatus() arms its staleness check after the first post-deploy
 *    heartbeat: miss 3 × monitorEveryBlocks and the covenant reads
 *    "Reviving". Intervals on the live launches are 150-300 blocks
 *    (30-60s), so this process must keep running once started.
 *  - All txs sign with one key, so sends are strictly sequential
 *    (nonce order) and each waits for its receipt before the next.
 *
 * No TEE exists on this machine, so `attestation` is an honest hash
 * commitment over the same snapshot (domain-tagged), not a TEE quote —
 * the one part of the design that stays aspirational until the
 * precompiles ship.
 *
 * Usage:  node scripts/guardian-agent.mjs [--once]
 * Env:    reads contracts/.env (RITUAL_RPC_URL, DEPLOYER_PRIVATE_KEY);
 *         GUARDIAN_PRIVATE_KEY / RPC_URL override.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  keccak256,
  toHex,
  formatEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ---------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal .env parser — contracts/.env only holds KEY=value lines. */
function loadEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split('\n')
        .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2].trim()]),
    );
  } catch {
    return {};
  }
}

const env = { ...loadEnv(join(ROOT, 'contracts/.env')), ...process.env };

const RPC_URL = env.RPC_URL || env.RITUAL_RPC_URL || 'https://rpc.ritualfoundation.org';
const PRIVATE_KEY = env.GUARDIAN_PRIVATE_KEY || env.DEPLOYER_PRIVATE_KEY;
const REGISTRY = env.COVENANT_REGISTRY || '0x56F78A7e8Afe11C69228283CCe3971F73486E7fE';

/** Sweep cadence. 45s keeps every covenant under 2 monitor intervals
 *  (the tightest live launch is 150 blocks ≈ 30s; reviving trips at 3). */
const SWEEP_MS = Number(env.SWEEP_MS || 45_000);
/** Audits are chain-verified every sweep but only *logged* on-chain this
 *  often per covenant — recordAudit costs gas and a CheckOk entry per
 *  call, and the timeline should stay legible. Violations log instantly. */
const AUDIT_LOG_EVERY_MS = Number(env.AUDIT_LOG_EVERY_MS || 30 * 60_000);
/** Re-read the registry this often so new launches get adopted. */
const RELOAD_EVERY_SWEEPS = 10;
const LOW_BALANCE_WEI = 10n ** 16n; // warn under 0.01 tRITUAL

if (!PRIVATE_KEY) {
  console.error('[guardian] no GUARDIAN_PRIVATE_KEY / DEPLOYER_PRIVATE_KEY found');
  process.exit(1);
}

const REGISTRY_ABI = parseAbi([
  'struct Launch { address token; address covenant; address guardian; address creator; uint64 createdAtBlock; }',
  'function allLaunches() view returns (Launch[])',
]);

const COVENANT_ABI = parseAbi([
  'struct VestingTranche { string label; uint16 supplyBps; uint64 releaseAtBlock; address recipient; bool released; }',
  'function terms() view returns (uint64 lpLockUntilBlock, uint16 lpLockedBps, uint16 devWalletCapBps, uint32 sellWindowBlocks, uint32 monitorEveryBlocks)',
  'function vesting() view returns (VestingTranche[])',
  'function lastHeartbeatBlock() view returns (uint64)',
  'function trackedWallets(address) view returns (bool tracked, bool frozen, uint64 windowStart, uint256 holdingsAtWindowStart, uint256 soldInWindow)',
  'function frozenCount() view returns (uint32)',
  'function lpAmount() view returns (uint256)',
  'function heartbeat(bytes32 checkpointHash, bytes32 attestation)',
  'function recordAudit(bool ok, bytes32 attestation, string detail)',
  'function executeVestingRelease(uint256 index, bytes32 attestation, string detail)',
]);

const TOKEN_ABI = parseAbi(['function balanceOf(address) view returns (uint256)']);

const account = privateKeyToAccount(PRIVATE_KEY);
const transport = http(RPC_URL);
const pub = createPublicClient({ transport });
const wallet = createWalletClient({ account, transport });

// ---------------------------------------------------------------------
// Real state snapshot → checkpoint/attestation hashes
// ---------------------------------------------------------------------

/** Read everything the guardian attests to, straight from the chain. */
async function snapshotCovenant(l, blockNumber) {
  const c = { address: l.covenant, abi: COVENANT_ABI };
  const [tracked, frozenCount, lpAmount, tranches, creatorBalance] = await Promise.all([
    pub.readContract({ ...c, functionName: 'trackedWallets', args: [l.creator] }),
    pub.readContract({ ...c, functionName: 'frozenCount' }),
    pub.readContract({ ...c, functionName: 'lpAmount' }),
    pub.readContract({ ...c, functionName: 'vesting' }),
    pub.readContract({ address: l.token, abi: TOKEN_ABI, functionName: 'balanceOf', args: [l.creator] }),
  ]);
  const snapshot = {
    covenant: l.covenant,
    block: blockNumber.toString(),
    creator: l.creator,
    creatorBalance: creatorBalance.toString(),
    tracked: { frozen: tracked[1], windowStart: tracked[2].toString(), soldInWindow: tracked[4].toString(), holdingsAtWindowStart: tracked[3].toString() },
    frozenCount: Number(frozenCount),
    lpAmount: lpAmount.toString(),
    released: tranches.map((t) => t.released),
  };
  const encoded = toHex(JSON.stringify(snapshot));
  return {
    snapshot,
    tranches,
    tracked,
    checkpointHash: keccak256(encoded),
    // Hash commitment, not a TEE quote — see module comment.
    attestation: keccak256(toHex(`vestal-guardian-agent-v1:${JSON.stringify(snapshot)}`)),
  };
}

// ---------------------------------------------------------------------
// Writes — simulate → write → wait, strictly sequential
// ---------------------------------------------------------------------

async function send(l, functionName, args, label) {
  const { request } = await pub.simulateContract({
    address: l.covenant,
    abi: COVENANT_ABI,
    functionName,
    args,
    account,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${label} reverted (${hash})`);
  console.log(`[guardian] ${l.symbol ?? l.covenant} ${label} — block ${receipt.blockNumber} tx ${hash}`);
  return receipt;
}

// ---------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------

/** @type {Map<string, { monitorEveryBlocks: bigint, devWalletCapBps: number, sellWindowBlocks: bigint, lastAuditLogMs: number }>} */
const covenantState = new Map();
let launches = [];

async function loadLaunches() {
  const entries = await pub.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: 'allLaunches' });
  launches = entries.filter((e) => e.guardian.toLowerCase() === account.address.toLowerCase());
  for (const l of launches) {
    if (covenantState.has(l.covenant)) continue;
    const t = await pub.readContract({ address: l.covenant, abi: COVENANT_ABI, functionName: 'terms' });
    covenantState.set(l.covenant, {
      monitorEveryBlocks: BigInt(t[4]),
      devWalletCapBps: Number(t[2]),
      sellWindowBlocks: BigInt(t[3]),
      lastAuditLogMs: 0,
    });
  }
}

async function sweepCovenant(l, blockNumber) {
  const state = covenantState.get(l.covenant);
  const s = await snapshotCovenant(l, blockNumber);

  // 1. Heartbeat once per monitor interval, committed to the snapshot.
  const lastHb = await pub.readContract({ address: l.covenant, abi: COVENANT_ABI, functionName: 'lastHeartbeatBlock' });
  if (blockNumber - BigInt(lastHb) >= state.monitorEveryBlocks) {
    await send(l, 'heartbeat', [s.checkpointHash, s.attestation], 'heartbeat');
  }

  // 2. Real sell-cap audit of the tracked creator wallet. The transfer
  //    hook already enforces the cap, so a violation here means contract
  //    state itself is inconsistent — log ok/violation accordingly, but
  //    only write CheckOk on the slow cadence to keep the log legible.
  const [, frozen, windowStart, holdingsAtStart, soldInWindow] = s.tracked;
  const windowLive = blockNumber < BigInt(windowStart) + state.sellWindowBlocks;
  const cap = (holdingsAtStart * BigInt(state.devWalletCapBps)) / 10_000n;
  const ok = frozen || !windowLive || state.devWalletCapBps >= 10_000 || soldInWindow <= cap;
  const due = Date.now() - state.lastAuditLogMs >= AUDIT_LOG_EVERY_MS;
  if (!ok || due) {
    const detail = ok
      ? `Audit sweep: creator ${l.creator} within sell cap (${soldInWindow}/${cap} sold this window), ${s.snapshot.frozenCount} frozen`
      : `Sell-cap inconsistency on ${l.creator}: sold ${soldInWindow} exceeds window cap ${cap}`;
    await send(l, 'recordAudit', [ok, s.attestation, detail], ok ? 'audit ok' : 'audit FLAG');
    state.lastAuditLogMs = Date.now();
  }

  // 3. Release any due, unreleased tranche — the guardian path, millions
  //    of blocks ahead of the permissionless failsafe.
  for (let i = 0; i < s.tranches.length; i++) {
    const t = s.tranches[i];
    if (t.released || blockNumber < BigInt(t.releaseAtBlock)) continue;
    await send(
      l,
      'executeVestingRelease',
      [BigInt(i), s.attestation, `Guardian release: "${t.label}" due at block ${t.releaseAtBlock}`],
      `release tranche ${i} (${t.label})`,
    );
  }
}

let sweepCount = 0;
async function sweep() {
  if (sweepCount % RELOAD_EVERY_SWEEPS === 0) await loadLaunches();
  sweepCount++;

  const [blockNumber, balance] = await Promise.all([
    pub.getBlockNumber(),
    pub.getBalance({ address: account.address }),
  ]);
  if (balance < LOW_BALANCE_WEI) {
    console.warn(`[guardian] LOW GAS: ${formatEther(balance)} tRITUAL left on ${account.address}`);
  }

  for (const l of launches) {
    try {
      await sweepCovenant(l, blockNumber);
    } catch (err) {
      console.warn(`[guardian] sweep failed for ${l.covenant}:`, err?.shortMessage || err?.message || err);
    }
  }
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

const once = process.argv.includes('--once');
console.log(`[guardian] agent ${account.address} on ${RPC_URL}`);
console.log(`[guardian] registry ${REGISTRY}, sweep every ${SWEEP_MS / 1000}s${once ? ' (single sweep)' : ''}`);

await sweep();
if (!once) {
  // Chained timeouts, not setInterval: a slow RPC sweep must finish
  // before the next begins or nonces collide.
  const loop = async () => {
    try {
      await sweep();
    } catch (err) {
      console.warn('[guardian] sweep error:', err?.shortMessage || err?.message || err);
    }
    setTimeout(loop, SWEEP_MS);
  };
  setTimeout(loop, SWEEP_MS);
}

/**
 * Real chain reads. Fetches every registered launch from the
 * CovenantRegistry and maps it into the Launch shape documented in
 * src/data/launches.js. Everything covenant-related — terms, vesting,
 * guardian status, the enforcement log — is read from contracts.
 */
import { createPublicClient, http } from 'viem';
import { RPC_URL, VESTAL_CONTRACTS } from '../config/ritual.js';
import { REGISTRY_ABI, COVENANT_ABI, TOKEN_ABI, ACTION_TYPES, GUARDIAN_STATUSES } from './abi.js';

/** @returns {import('viem').PublicClient} */
export function publicClient(rpcUrl = RPC_URL) {
  return createPublicClient({ transport: http(rpcUrl) });
}

const num = (v) => Number(v);

/**
 * @param {{ rpcUrl?: string, registryAddress?: `0x${string}` }} [opts]
 * @returns {Promise<{ currentBlock: number, launches: import('../data/launches.js').Launch[] }>}
 */
export async function fetchChainLaunches(opts = {}) {
  const client = publicClient(opts.rpcUrl);
  const registry = opts.registryAddress ?? VESTAL_CONTRACTS.COVENANT_REGISTRY;

  const [currentBlock, entries] = await Promise.all([
    client.getBlockNumber(),
    client.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'allLaunches' }),
  ]);

  const launches = await Promise.all(entries.map((e) => mapLaunch(client, e, currentBlock)));
  return { currentBlock: num(currentBlock), launches };
}

/**
 * Public RPCs cap eth_getLogs ranges (Ritual testnet: 100k blocks), so
 * the enforcement log is fetched in chunks, newest window first, from
 * the covenant's creation block. Bounded to MAX_LOG_CHUNKS so an old
 * covenant costs a fixed number of requests — tranche released-state
 * comes from contract storage, not logs, so older entries only trim
 * the visible timeline.
 */
const LOG_CHUNK_BLOCKS = 90_000n;
const MAX_LOG_CHUNKS = 10;

/**
 * Enforcement actions already seen this session, per covenant (keyed by
 * txHash:logIndex). Same rationale as market.js's seenSwaps: the public
 * RPC is load-balanced across backends with inconsistent log history, so
 * a single query can come back empty even though the events exist. Every
 * fetch merges into this cache and returns the union — an action, once
 * observed, never drops out of the timeline for the session.
 */
const seenActions = new Map();

/** One chunk of EnforcementAction logs, retried against flaky backends. */
async function getEnforcementChunk(client, covenant, range, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await client.getContractEvents({ ...covenant, eventName: 'EnforcementAction', ...range });
    } catch {
      if (i < attempts) await new Promise((r) => setTimeout(r, 250 * i));
    }
  }
  return [];
}

async function fetchEnforcementLog(client, covenant, createdAtBlock, currentBlock) {
  const floor = createdAtBlock > 0n ? createdAtBlock : 0n;
  const chunks = [];
  let to = currentBlock;
  for (let i = 0; i < MAX_LOG_CHUNKS && to >= floor; i++) {
    const from = to - LOG_CHUNK_BLOCKS + 1n > floor ? to - LOG_CHUNK_BLOCKS + 1n : floor;
    chunks.push({ fromBlock: from, toBlock: to });
    to = from - 1n;
  }
  // Each chunk is queried twice: requests land on different backends, so
  // duplicates double the odds of hitting one with complete log history.
  const results = await Promise.all(
    chunks.flatMap((c) => [
      getEnforcementChunk(client, covenant, c),
      getEnforcementChunk(client, covenant, c),
    ]),
  );

  let cache = seenActions.get(covenant.address);
  if (!cache) seenActions.set(covenant.address, (cache = new Map()));
  for (const l of results.flat()) cache.set(`${l.transactionHash}:${l.logIndex}`, l);
  return [...cache.values()];
}

async function mapLaunch(client, entry, currentBlock) {
  const covenant = { address: entry.covenant, abi: COVENANT_ABI };
  const token = { address: entry.token, abi: TOKEN_ABI };

  const [name, symbol, terms, tranches, summary, logs] = await Promise.all([
    client.readContract({ ...token, functionName: 'name' }),
    client.readContract({ ...token, functionName: 'symbol' }),
    client.readContract({ ...covenant, functionName: 'terms' }),
    client.readContract({ ...covenant, functionName: 'vesting' }),
    client.readContract({ ...covenant, functionName: 'guardianSummary' }),
    fetchEnforcementLog(client, covenant, BigInt(entry.createdAtBlock), currentBlock),
  ]);

  const [lpLockUntilBlock, lpLockedBps, devWalletCapBps, , monitorEveryBlocks] = terms;
  const [agent, deployedAt, lastHeartbeat, revivalCount, status] = summary;

  return {
    id: entry.token.toLowerCase(),
    covenant: entry.covenant,
    name,
    symbol,
    tagline: 'Live on-chain launch — covenant state read from Ritual contracts.',
    description:
      'This launch is read directly from the CovenantRegistry. Terms, vesting, guardian status, and the enforcement log below are contract state on Ritual Chain testnet.',
    creator: entry.creator,
    createdAtBlock: num(entry.createdAtBlock),
    guardian: {
      address: agent,
      model: 'vestal-guardian (on-chain)',
      deployedBlock: num(deployedAt),
      lastHeartbeatBlock: num(lastHeartbeat),
      revivals: num(revivalCount),
      status: GUARDIAN_STATUSES[status] ?? 'active',
    },
    terms: {
      lpLockUntilBlock: num(lpLockUntilBlock),
      lpPctLocked: num(lpLockedBps) / 100,
      devWalletCapPct: num(devWalletCapBps) / 100,
      monitorEveryBlocks: num(monitorEveryBlocks),
      vesting: tranches.map((t) => ({
        label: t.label,
        pct: num(t.supplyBps) / 100,
        atBlock: num(t.releaseAtBlock),
        released: t.released,
      })),
    },
    log: logs
      .map((l) => ({
        block: num(l.args.atBlock ?? l.blockNumber),
        type: ACTION_TYPES[num(l.args.action)] ?? 'wake',
        detail: l.args.detail || 'Guardian action recorded on-chain.',
        attestation: l.args.attestation,
      }))
      .sort((a, b) => b.block - a.block),
  };
}

/**
 * Real chain reads. Fetches every registered launch from the
 * CovenantRegistry and maps it into the exact Launch shape documented
 * in src/data/launches.js, so UI components cannot tell a chain launch
 * from a mock one.
 *
 * Market data (price, holders, guarded USD) has no on-chain source yet
 * and is zeroed; everything covenant-related — terms, vesting,
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

  const launches = await Promise.all(entries.map((e) => mapLaunch(client, e)));
  return { currentBlock: num(currentBlock), launches };
}

async function mapLaunch(client, entry) {
  const covenant = { address: entry.covenant, abi: COVENANT_ABI };
  const token = { address: entry.token, abi: TOKEN_ABI };

  const [name, symbol, terms, tranches, summary, logs] = await Promise.all([
    client.readContract({ ...token, functionName: 'name' }),
    client.readContract({ ...token, functionName: 'symbol' }),
    client.readContract({ ...covenant, functionName: 'terms' }),
    client.readContract({ ...covenant, functionName: 'vesting' }),
    client.readContract({ ...covenant, functionName: 'guardianSummary' }),
    client.getContractEvents({ ...covenant, eventName: 'EnforcementAction', fromBlock: 0n }),
  ]);

  const [lpLockUntilBlock, lpLockedBps, devWalletCapBps, , monitorEveryBlocks] = terms;
  const [agent, deployedAt, lastHeartbeat, revivalCount, status] = summary;

  return {
    id: entry.token.toLowerCase(),
    name,
    symbol,
    tagline: 'Live on-chain launch — covenant state read from Ritual contracts.',
    description:
      'This launch is read directly from the CovenantRegistry. Terms, vesting, guardian status, and the enforcement log below are contract state, not mock data. Market figures await an on-chain price source.',
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
    market: { priceUsd: 0, change24h: 0, guardedUsd: 0, holders: 0 },
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

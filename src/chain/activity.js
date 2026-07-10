/**
 * Cross-market activity for the home page: recent Swap events (buys and
 * sells) from every launch's pool, merged with token creations from the
 * CovenantRegistry, newest first. Swap reads go through market.js's
 * fetchSwaps so the feed shares its session trade cache with the token
 * pages — a swap observed on either surface shows up on both.
 */
import { VESTAL_CONTRACTS } from '../config/ritual.js';
import { POOL_FACTORY_ABI } from './abi.js';
import { publicClient } from './launches.js';
import { fetchSwaps } from './market.js';

const ZERO = '0x0000000000000000000000000000000000000000';

/** Feed window per pool: 3 chunks ≈ 270k blocks (~15h at 0.2s blocks). */
const FEED_CHUNKS = 3;

/** token → pool address, cached once resolved (pools are never unset). */
const poolCache = new Map();

async function poolOf(client, token) {
  const hit = poolCache.get(token);
  if (hit) return hit;
  const pool = await client.readContract({
    address: VESTAL_CONTRACTS.POOL_FACTORY,
    abi: POOL_FACTORY_ABI,
    functionName: 'poolOf',
    args: [token],
  });
  if (pool.toLowerCase() === ZERO) return null;
  poolCache.set(token, pool);
  return pool;
}

/**
 * @param {import('../data/launches.js').Launch[]} launches
 * @returns {Promise<{ currentBlock: number, events: Array<{
 *   kind: 'buy' | 'sell' | 'create',
 *   block: number, logIndex: number,
 *   txHash: `0x${string}` | null, maker: string,
 *   native?: number, tokens?: number, price?: number,
 *   launch: import('../data/launches.js').Launch,
 * }> }>} events sorted newest first
 */
export async function fetchActivity(launches) {
  const client = publicClient();
  const currentBlock = await client.getBlockNumber();

  const perPool = await Promise.all(
    launches.map(async (launch) => {
      const pool = await poolOf(client, launch.id).catch(() => null);
      if (!pool) return [];
      const trades = await fetchSwaps(client, pool, currentBlock, FEED_CHUNKS);
      return trades.map((t) => ({ ...t, kind: t.isBuy ? 'buy' : 'sell', launch }));
    }),
  );

  const created = launches.map((launch) => ({
    kind: 'create',
    block: launch.createdAtBlock,
    logIndex: 0,
    txHash: null,
    maker: launch.creator,
    launch,
  }));

  const events = [...perPool.flat(), ...created].sort(
    (a, b) => b.block - a.block || b.logIndex - a.logIndex,
  );
  return { currentBlock: Number(currentBlock), events };
}

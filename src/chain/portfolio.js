/**
 * Portfolio reads: enumerates every registered launch from the
 * CovenantRegistry, reads the wallet's balance of each token, and
 * prices held tokens through their LaunchPool markets. Pure RPC reads —
 * no wallet client or browser state, so it is SSR-safe.
 */
import { TOKEN_ABI } from './abi.js';
import { publicClient, fetchChainLaunches } from './launches.js';
import { fetchMarket } from './market.js';

const toNative = (wei) => Number(wei) / 1e18;

/**
 * @param {`0x${string}`} walletAddress
 * @returns {Promise<{
 *   nativeBalance: number,            // wallet tRITUAL balance
 *   currentBlock: number,
 *   holdings: Array<{
 *     launch: import('../data/launches.js').Launch,  // full launch object
 *     balance: number,                // token balance (18-dec → number)
 *     priceNative: number|null,       // null when the token has no seeded pool
 *     valueNative: number|null,       // balance * priceNative, null when unpriced
 *     change: { pct: number, label: string } | null, // from fetchMarket
 *   }>,
 *   totalValueNative: number,         // sum of non-null valueNative
 * }>}
 */
export async function fetchPortfolio(walletAddress) {
  const client = publicClient();
  const [nativeWei, { currentBlock, launches }] = await Promise.all([
    client.getBalance({ address: walletAddress }),
    fetchChainLaunches(),
  ]);

  const balances = await Promise.all(
    launches.map(async (launch) => {
      const wei = await client.readContract({
        address: launch.id,
        abi: TOKEN_ABI,
        functionName: 'balanceOf',
        args: [walletAddress],
      });
      return { launch, balance: toNative(wei) };
    }),
  );

  // Only held tokens become holdings; a per-token market failure (or a
  // token with no seeded pool) leaves that holding unpriced instead of
  // failing the whole portfolio.
  const holdings = await Promise.all(
    balances
      .filter((b) => b.balance > 0)
      .map(async ({ launch, balance }) => {
        const market = await fetchMarket(launch.id).catch(() => null);
        const priceNative = market ? market.priceNative : null;
        return {
          launch,
          balance,
          priceNative,
          valueNative: priceNative == null ? null : balance * priceNative,
          change: market ? market.change : null,
        };
      }),
  );

  holdings.sort((a, b) => {
    if (a.valueNative == null && b.valueNative == null) return 0;
    if (a.valueNative == null) return 1;
    if (b.valueNative == null) return -1;
    return b.valueNative - a.valueNative;
  });

  const totalValueNative = holdings.reduce((sum, h) => sum + (h.valueNative ?? 0), 0);

  return {
    nativeBalance: toNative(nativeWei),
    currentBlock,
    holdings,
    totalValueNative,
  };
}

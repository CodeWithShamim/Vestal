/**
 * Market layer over LaunchPool: resolves a token's pool through the
 * VestalPoolFactory, reads reserves/price, rebuilds price history from
 * on-chain Swap events, and executes buys/sells through the connected
 * wallet. Prices are in the native coin (tRITUAL) per token — both are
 * 18-decimal, so BigInt ratios convert cleanly for display.
 */
import { parseEther } from 'viem';
import { BLOCK_TIME_SECONDS, VESTAL_CONTRACTS } from '../config/ritual.js';
import { POOL_FACTORY_ABI, POOL_ABI, TOKEN_ABI } from './abi.js';
import { publicClient } from './launches.js';
import { walletClient } from './wallet.js';

const ZERO = '0x0000000000000000000000000000000000000000';
const FEE_BPS = 30n;
const BPS = 10_000n;

/** Same chunking as the enforcement log — public RPCs cap getLogs ranges. */
const LOG_CHUNK_BLOCKS = 90_000n;
const MAX_LOG_CHUNKS = 10;

const BLOCKS_24H = Math.round(86_400 / BLOCK_TIME_SECONDS);

const toNative = (wei) => Number(wei) / 1e18;

async function fetchSwaps(client, pool, currentBlock) {
  const chunks = [];
  let to = currentBlock;
  for (let i = 0; i < MAX_LOG_CHUNKS && to >= 0n; i++) {
    const from = to > LOG_CHUNK_BLOCKS ? to - LOG_CHUNK_BLOCKS + 1n : 0n;
    chunks.push({ fromBlock: from, toBlock: to });
    if (from === 0n) break;
    to = from - 1n;
  }
  const results = await Promise.all(
    chunks.map((c) =>
      client.getContractEvents({ address: pool, abi: POOL_ABI, eventName: 'Swap', ...c }).catch(() => []),
    ),
  );
  return results
    .flat()
    .map((l) => ({
      block: Number(l.blockNumber),
      isBuy: l.args.isBuy,
      native: toNative(l.args.nativeAmount),
      tokens: toNative(l.args.tokenAmount),
      price: Number(l.args.priceX18) / 1e18,
    }))
    .sort((a, b) => a.block - b.block);
}

/**
 * Full market snapshot for a token, or null when it has no pool or an
 * unseeded one — the UI's "no market yet" state.
 *
 * @param {`0x${string}`} tokenAddress
 * @returns {Promise<null | {
 *   pool: `0x${string}`,
 *   priceNative: number,
 *   reserveNative: number, reserveToken: number,
 *   guardedNative: number,
 *   trades: Array<{ block: number, isBuy: boolean, native: number, tokens: number, price: number }>,
 *   change: { pct: number, label: string } | null,
 * }>}
 */
export async function fetchMarket(tokenAddress) {
  const client = publicClient();
  const pool = await client.readContract({
    address: VESTAL_CONTRACTS.POOL_FACTORY,
    abi: POOL_FACTORY_ABI,
    functionName: 'poolOf',
    args: [tokenAddress],
  });
  if (pool.toLowerCase() === ZERO) return null;

  const currentBlock = await client.getBlockNumber();
  const poolC = { address: pool, abi: POOL_ABI };
  const [[reserveNative, reserveToken], totalShares, trades] = await Promise.all([
    client.readContract({ ...poolC, functionName: 'reserves' }),
    client.readContract({ ...poolC, functionName: 'totalSupply' }),
    fetchSwaps(client, pool, currentBlock),
  ]);
  if (reserveToken === 0n) return null;

  const priceNative = Number(reserveNative) / Number(reserveToken);

  // Share of LP shares sitting in covenant custody, valued as its slice
  // of both reserves (≈ 2× the native side).
  let guardedNative = 0;
  if (totalShares > 0n) {
    const covenant = await client.readContract({
      address: tokenAddress,
      abi: [{ type: 'function', name: 'covenant', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }],
      functionName: 'covenant',
    });
    const locked = await client.readContract({
      address: pool,
      abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
      functionName: 'balanceOf',
      args: [covenant],
    });
    guardedNative = (2 * toNative(reserveNative) * Number(locked)) / Number(totalShares);
  }

  // Change vs the most recent trade at least ~24h old; if history is
  // younger than that, vs the first recorded trade.
  let change = null;
  if (trades.length > 0) {
    const cutoff = Number(currentBlock) - BLOCKS_24H;
    const dayOld = [...trades].reverse().find((t) => t.block <= cutoff);
    const base = dayOld ?? trades[0];
    if (base.price > 0) {
      change = {
        pct: ((priceNative - base.price) / base.price) * 100,
        label: dayOld ? '24h' : 'since first trade',
      };
    }
  }

  return {
    pool,
    priceNative,
    reserveNative: toNative(reserveNative),
    reserveToken: toNative(reserveToken),
    guardedNative,
    trades,
    change,
  };
}

/** Client-side buy estimate from the fetched reserves (0.3% fee). */
export function estimateBuy(market, nativeIn) {
  if (!market || !(nativeIn > 0)) return 0;
  const inWei = parseEther(String(nativeIn));
  const rN = parseEther(market.reserveNative.toFixed(18));
  const rT = parseEther(market.reserveToken.toFixed(18));
  const inFee = inWei * (BPS - FEE_BPS);
  return toNative((rT * inFee) / (rN * BPS + inFee));
}

export async function fetchTokenBalance(tokenAddress, wallet) {
  const bal = await publicClient().readContract({
    address: tokenAddress,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: [wallet],
  });
  return toNative(bal);
}

/**
 * Buy launch tokens with native coin. Simulates first so pool reverts
 * surface before the wallet prompt; returns the tx hash after the
 * receipt confirms.
 */
export async function buyTokens({ pool, nativeAmount, minTokensOut }) {
  const wallet = walletClient();
  if (!wallet) throw new Error('Connect a wallet on Ritual Chain first.');
  const client = publicClient();
  const { request } = await client.simulateContract({
    address: pool,
    abi: POOL_ABI,
    functionName: 'buy',
    args: [parseEther(minTokensOut.toFixed(18))],
    value: parseEther(String(nativeAmount)),
    account: wallet.account.address,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain.');
  return hash;
}

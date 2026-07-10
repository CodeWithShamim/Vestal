/**
 * Market layer over LaunchPool: resolves a token's pool through the
 * VestalPoolFactory, reads reserves/price, rebuilds price history from
 * on-chain Swap events, and executes buys/sells through the connected
 * wallet. Prices are in the native coin (tRITUAL) per token — both are
 * 18-decimal, so BigInt ratios convert cleanly for display.
 */
import { parseEther } from 'viem';
import { BLOCK_TIME_SECONDS, VESTAL_CONTRACTS } from '../config/ritual.js';
import { POOL_FACTORY_ABI, POOL_ABI, TOKEN_ABI, COVENANT_ABI } from './abi.js';
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

const bigintMin = (a, b) => (a < b ? a : b);

/** Babylonian integer sqrt, matching LaunchPool's first-deposit share mint. */
function bigintSqrt(x) {
  if (x < 2n) return x;
  let z = (x + 1n) / 2n;
  let y = x;
  while (z < y) {
    y = z;
    z = (x / z + z) / 2n;
  }
  return y;
}

/**
 * Trades already seen this session, per pool (keyed by txHash:logIndex).
 * The public RPC is load-balanced across nodes with inconsistent log
 * history — the same getLogs query can return a swap on one call and
 * omit it on the next — so every fetch merges into this cache and the
 * union is what the UI sees. A swap, once observed, stays for the session.
 */
const seenSwaps = new Map();

/** One chunk of Swap logs, retried against flaky/stale RPC backends. */
async function getSwapChunk(client, pool, range, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await client.getContractEvents({ address: pool, abi: POOL_ABI, eventName: 'Swap', ...range });
    } catch {
      if (i < attempts) await new Promise((r) => setTimeout(r, 250 * i));
    }
  }
  return [];
}

/**
 * Merged, ascending swap history for a pool. `maxChunks` bounds the
 * scanned block window — the home-page activity feed passes a smaller
 * one than the token page's full history.
 */
export async function fetchSwaps(client, pool, currentBlock, maxChunks = MAX_LOG_CHUNKS) {
  const chunks = [];
  let to = currentBlock;
  for (let i = 0; i < maxChunks && to >= 0n; i++) {
    const from = to > LOG_CHUNK_BLOCKS ? to - LOG_CHUNK_BLOCKS + 1n : 0n;
    chunks.push({ fromBlock: from, toBlock: to });
    if (from === 0n) break;
    to = from - 1n;
  }
  // Each chunk is queried twice: requests land on different backends, so
  // duplicates double the odds of hitting one with complete log history.
  const results = await Promise.all(
    chunks.flatMap((c) => [getSwapChunk(client, pool, c), getSwapChunk(client, pool, c)]),
  );

  let cache = seenSwaps.get(pool);
  if (!cache) seenSwaps.set(pool, (cache = new Map()));
  for (const l of results.flat()) {
    cache.set(`${l.transactionHash}:${l.logIndex}`, {
      block: Number(l.blockNumber),
      logIndex: Number(l.logIndex ?? 0),
      txHash: l.transactionHash,
      maker: l.args.trader,
      isBuy: l.args.isBuy,
      native: toNative(l.args.nativeAmount),
      tokens: toNative(l.args.tokenAmount),
      price: Number(l.args.priceX18) / 1e18,
    });
  }
  return [...cache.values()].sort((a, b) => a.block - b.block || a.logIndex - b.logIndex);
}

/**
 * Full market snapshot for a token, or null when it has no pool or an
 * unseeded one — the UI's "no market yet" state.
 *
 * @param {`0x${string}`} tokenAddress
 * @returns {Promise<null | {
 *   pool: `0x${string}`,
 *   currentBlock: number,
 *   priceNative: number,
 *   reserveNative: number, reserveToken: number,
 *   guardedNative: number,
 *   trades: Array<{
 *     block: number, logIndex: number, txHash: `0x${string}`, maker: `0x${string}`,
 *     isBuy: boolean, native: number, tokens: number, price: number,
 *   }>,
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
    currentBlock: Number(currentBlock),
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
  const inWei = parseEther(nativeIn.toFixed(18));
  const rN = parseEther(market.reserveNative.toFixed(18));
  const rT = parseEther(market.reserveToken.toFixed(18));
  const inFee = inWei * (BPS - FEE_BPS);
  return toNative((rT * inFee) / (rN * BPS + inFee));
}

/** Client-side sell estimate from the fetched reserves (0.3% fee). */
export function estimateSell(market, tokenIn) {
  if (!market || !(tokenIn > 0)) return 0;
  const inWei = parseEther(tokenIn.toFixed(18));
  const rN = parseEther(market.reserveNative.toFixed(18));
  const rT = parseEther(market.reserveToken.toFixed(18));
  const inFee = inWei * (BPS - FEE_BPS);
  return toNative((rN * inFee) / (rT * BPS + inFee));
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

function requireWallet() {
  const wallet = walletClient();
  if (!wallet) throw new Error('Connect a wallet on Ritual Chain first.');
  return wallet;
}

/** Simulate → write → confirm receipt; returns the tx hash. */
async function writeAndConfirm(client, wallet, params) {
  const { request } = await client.simulateContract({ ...params, account: wallet.account.address });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain.');
  return hash;
}

/** Approve `spender` for `amount` of `token` unless the allowance already covers it. */
async function ensureAllowance(client, wallet, { token, spender, amount }) {
  const current = await client.readContract({
    address: token,
    abi: TOKEN_ABI,
    functionName: 'allowance',
    args: [wallet.account.address, spender],
  });
  if (current >= amount) return;
  await writeAndConfirm(client, wallet, {
    address: token,
    abi: TOKEN_ABI,
    functionName: 'approve',
    args: [spender, amount],
  });
}

/**
 * Buy launch tokens with native coin. Simulates first so pool reverts
 * surface before the wallet prompt; returns the tx hash after the
 * receipt confirms.
 */
export async function buyTokens({ pool, nativeAmount, minTokensOut }) {
  const wallet = requireWallet();
  const client = publicClient();
  return writeAndConfirm(client, wallet, {
    address: pool,
    abi: POOL_ABI,
    functionName: 'buy',
    args: [parseEther(minTokensOut.toFixed(18))],
    value: parseEther(nativeAmount.toFixed(18)),
  });
}

/**
 * Sell launch tokens for native coin: approve the pool if needed, then
 * sell. The token's covenant hook runs on the transfer in, so a sell-cap
 * or freeze revert surfaces here as a readable simulation error.
 */
export async function sellTokens({ pool, token, tokenAmount, minNativeOut }) {
  const wallet = requireWallet();
  const client = publicClient();
  const tokenIn = parseEther(tokenAmount.toFixed(18));
  await ensureAllowance(client, wallet, { token, spender: pool, amount: tokenIn });
  return writeAndConfirm(client, wallet, {
    address: pool,
    abi: POOL_ABI,
    functionName: 'sell',
    args: [tokenIn, parseEther(minNativeOut.toFixed(18))],
  });
}

/**
 * Creator flow that takes a launch from "no market yet" to a live,
 * covenant-guarded market: create the pool if none exists, approve and
 * seed the initial liquidity (the deposit ratio sets the opening price),
 * then lock every LP share into the launch's GuardianCovenant.
 *
 * Each stage is its own transaction; `onStep` receives
 * 'pool' | 'seed' | 'lock' as the flow advances so the UI can narrate.
 * Safe to re-run after a mid-flow failure — completed stages are
 * detected and skipped.
 *
 * @returns {Promise<`0x${string}`>} the pool address
 */
export async function openMarket({ token, covenant, tokenAmount, nativeAmount, onStep = () => {} }) {
  const wallet = requireWallet();
  const client = publicClient();
  const factory = { address: VESTAL_CONTRACTS.POOL_FACTORY, abi: POOL_FACTORY_ABI };

  onStep('pool');
  let pool = await client.readContract({ ...factory, functionName: 'poolOf', args: [token] });
  if (pool.toLowerCase() === ZERO) {
    await writeAndConfirm(client, wallet, { ...factory, functionName: 'createPool', args: [token] });
    pool = await client.readContract({ ...factory, functionName: 'poolOf', args: [token] });
  }

  onStep('seed');
  const tokenIn = parseEther(tokenAmount.toFixed(18));
  const nativeIn = parseEther(nativeAmount.toFixed(18));
  await ensureAllowance(client, wallet, { token, spender: pool, amount: tokenIn });
  // Mirror the pool's share formula and apply the same 1% guard as
  // trades: without a floor, a swap landing between this quote and the
  // deposit shifts the ratio and silently donates the excess side to
  // existing LPs. A fresh pool mints sqrt(native * tokens) — deterministic,
  // but quoted the same way in case someone else seeded first.
  const poolC = { address: pool, abi: POOL_ABI };
  const [[reserveNative, reserveToken], shareSupply] = await Promise.all([
    client.readContract({ ...poolC, functionName: 'reserves' }),
    client.readContract({ ...poolC, functionName: 'totalSupply' }),
  ]);
  const expectedShares =
    shareSupply === 0n
      ? bigintSqrt(nativeIn * tokenIn)
      : bigintMin((nativeIn * shareSupply) / reserveNative, (tokenIn * shareSupply) / reserveToken);
  await writeAndConfirm(client, wallet, {
    ...poolC,
    functionName: 'addLiquidity',
    args: [tokenIn, (expectedShares * 99n) / 100n],
    value: nativeIn,
  });

  onStep('lock');
  const shares = await client.readContract({
    address: pool,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: [wallet.account.address],
  });
  if (shares > 0n) {
    await ensureAllowance(client, wallet, { token: pool, spender: covenant, amount: shares });
    await writeAndConfirm(client, wallet, {
      address: covenant,
      abi: COVENANT_ABI,
      functionName: 'lockLp',
      args: [pool, shares],
    });
  }
  return pool;
}

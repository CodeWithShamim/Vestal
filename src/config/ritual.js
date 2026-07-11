/**
 * Ritual Chain testnet configuration.
 *
 * Everything the app knows about the chain lives here. The viem chain
 * object for wallet connection is built from these constants in
 * src/chain/wallet.js — no UI code should hardcode chain values.
 *
 * Placeholders are marked; replace them with the published testnet
 * values before wiring real reads/writes.
 */

/**
 * Vite env overrides (VITE_* in .env.local) let local dev point at anvil
 * without touching this file. Guarded so the module also loads in plain
 * node (smoke/prerender scripts), where import.meta.env is undefined.
 */
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

/** JSON-RPC endpoint for Ritual Chain testnet. */
export const RPC_URL = env.VITE_RPC_URL || 'https://rpc.ritualfoundation.org';

/** Ritual Chain testnet chain id. */
export const CHAIN_ID = Number(env.VITE_CHAIN_ID ?? 1979);

/** Block explorer base URL. */
export const EXPLORER_URL = 'https://explorer.ritualfoundation.org';

/**
 * Approximate block time in seconds, used for countdown display only.
 * Measured against wall clock on testnet 2026-07-10 (~5 blocks/s).
 * Note: the chain's block timestamps are in milliseconds, not seconds.
 */
export const BLOCK_TIME_SECONDS = 0.2;

/**
 * Ritual precompile addresses used by Vestal guardians.
 * The 0x0801/0x0802/0x080C/0x0820 suffixes are the documented precompile
 * slots; SCHEDULER is a placeholder pending the published address.
 */
export const PRECOMPILES = {
  /** Native scheduled/recurring execution — guardians register their own wake-ups here. PLACEHOLDER address. */
  SCHEDULER: '0x0000000000000000000000000000000000000800',
  /** HTTP calls from inside the TEE (attested outbound requests). */
  HTTP_0x0801: '0x0000000000000000000000000000000000000801',
  /** LLM inference precompile (attested model calls). */
  LLM_0x0802: '0x0000000000000000000000000000000000000802',
  /** Sovereign agent invocation precompile. */
  SOVEREIGN_AGENT_0x080C: '0x000000000000000000000000000000000000080C',
  /** Persistent agent lifecycle precompile (checkpoints, heartbeat registration). */
  PERSISTENT_AGENT_0x0820: '0x0000000000000000000000000000000000000820',
};

/** Vestal protocol contracts, deployed to Ritual Chain testnet 2026-07-11. */
export const VESTAL_CONTRACTS = {
  LAUNCH_FACTORY: env.VITE_LAUNCH_FACTORY || '0x726D2c8e17d3d445c1c0088470dA2DBcCe345B35',
  COVENANT_REGISTRY: env.VITE_COVENANT_REGISTRY || '0x56F78A7e8Afe11C69228283CCe3971F73486E7fE',
  /** VestalPoolFactory — token → LaunchPool market resolution. */
  POOL_FACTORY: env.VITE_POOL_FACTORY || '0xCdB83Cdeba6CD12116925E6AF5cDF17d35D2530B',
  /** Guardian provider live on this deploy (mock until the agent precompiles ship). Display only. */
  GUARDIAN_PROVIDER: env.VITE_GUARDIAN_PROVIDER || '0x15cce71713b686aaE99C441Ab4e3dEBf7853A889',
};

/** True when a registry address is configured — chain reads replace mocks. */
export const CHAIN_READS_ENABLED =
  VESTAL_CONTRACTS.COVENANT_REGISTRY !== '0x0000000000000000000000000000000000000000';

export const RITUAL_TESTNET = {
  name: 'Ritual Chain Testnet',
  rpcUrl: RPC_URL,
  chainId: CHAIN_ID,
  explorerUrl: EXPLORER_URL,
  nativeCurrency: { name: 'Ritual Test Token', symbol: 'tRITUAL', decimals: 18 },
};

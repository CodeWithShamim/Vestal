/**
 * Wallet connection via the injected EIP-1193 provider (MetaMask etc.),
 * exposed as a single external store so every component sees the same
 * connection. The chain object is built from the constants in
 * src/config/ritual.js — no UI code hardcodes chain values.
 *
 * SSR-safe: window is only touched inside event handlers and effects,
 * so the module loads under the smoke/prerender scripts unchanged.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { createWalletClient, custom, defineChain } from 'viem';
import { RITUAL_TESTNET } from '../config/ritual.js';

export const ritualChain = defineChain({
  id: RITUAL_TESTNET.chainId,
  name: RITUAL_TESTNET.name,
  nativeCurrency: RITUAL_TESTNET.nativeCurrency,
  rpcUrls: { default: { http: [RITUAL_TESTNET.rpcUrl] } },
  blockExplorers: { default: { name: 'Ritual Explorer', url: RITUAL_TESTNET.explorerUrl } },
  testnet: true,
});

/** localStorage flag: reconnect silently on the next visit. */
const RECONNECT_KEY = 'vestal:wallet-connected';

const state = {
  /** @type {{ address: `0x${string}`|null, chainId: number|null, status: 'disconnected'|'connecting'|'connected', error: string|null }} */
  snapshot: { address: null, chainId: null, status: 'disconnected', error: null },
  listeners: new Set(),
  bound: false,
  reconnectTried: false,
};

function subscribe(listener) {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

function update(patch) {
  state.snapshot = { ...state.snapshot, ...patch };
  state.listeners.forEach((l) => l());
}

function provider() {
  return typeof window !== 'undefined' ? (window.ethereum ?? null) : null;
}

function resetLocal() {
  try {
    localStorage.removeItem(RECONNECT_KEY);
  } catch {}
  update({ address: null, chainId: null, status: 'disconnected', error: null });
}

/** Wallet-side account/network switches propagate without a reload. */
function bindEvents(eth) {
  if (state.bound || !eth.on) return;
  state.bound = true;
  eth.on('accountsChanged', (accounts) => {
    if (accounts.length === 0) resetLocal();
    else update({ address: accounts[0] });
  });
  eth.on('chainChanged', (hexId) => update({ chainId: Number(hexId) }));
}

async function adopt(eth, accounts) {
  const chainIdHex = await eth.request({ method: 'eth_chainId' });
  bindEvents(eth);
  try {
    localStorage.setItem(RECONNECT_KEY, '1');
  } catch {}
  update({ address: accounts[0], chainId: Number(chainIdHex), status: 'connected', error: null });
}

/** Prompt the injected wallet for access. */
export async function connect() {
  const eth = provider();
  if (!eth) {
    update({ error: 'No wallet found. Install MetaMask or another browser wallet, then retry.' });
    return;
  }
  update({ status: 'connecting', error: null });
  try {
    const accounts = await eth.request({ method: 'eth_requestAccounts' });
    if (accounts.length === 0) throw new Error('Wallet returned no accounts.');
    await adopt(eth, accounts);
  } catch (err) {
    update({
      status: 'disconnected',
      error: err?.code === 4001 ? 'Connection request rejected in wallet.' : err?.shortMessage || err?.message || 'Wallet connection failed.',
    });
  }
}

/**
 * Forget the connection locally and ask the wallet to revoke the
 * permission (best effort — not every wallet supports revocation).
 */
export function disconnect() {
  provider()
    ?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] })
    .catch(() => {});
  resetLocal();
}

/** Restore a previous session without prompting (eth_accounts only). */
async function reconnectOnce() {
  if (state.reconnectTried) return;
  state.reconnectTried = true;
  const eth = provider();
  if (!eth) return;
  let stored = false;
  try {
    stored = localStorage.getItem(RECONNECT_KEY) === '1';
  } catch {}
  if (!stored) return;
  try {
    const accounts = await eth.request({ method: 'eth_accounts' });
    if (accounts.length > 0) await adopt(eth, accounts);
  } catch {
    // Silent — the user can always connect explicitly.
  }
}

/** Move the wallet to Ritual Chain, offering to add it if unknown. */
export async function switchToRitual() {
  const client = walletClient();
  if (!client) return;
  update({ error: null });
  try {
    await client.switchChain({ id: ritualChain.id });
  } catch (switchErr) {
    if (/reject/i.test(switchErr?.message ?? '')) {
      update({ error: 'Network switch rejected in wallet.' });
      return;
    }
    try {
      await client.addChain({ chain: ritualChain });
    } catch (addErr) {
      update({ error: addErr?.shortMessage || addErr?.message || 'Could not switch network.' });
    }
  }
}

/** viem wallet client for writes; null until connected. */
export function walletClient() {
  const eth = provider();
  const { address } = state.snapshot;
  if (!eth || !address) return null;
  return createWalletClient({ account: address, chain: ritualChain, transport: custom(eth) });
}

/**
 * Wallet connection state plus actions. `onRitual` is true when the
 * wallet is connected and on the configured chain — gate writes on it.
 */
export function useWallet() {
  useEffect(() => {
    reconnectOnce();
  }, []);
  const snap = useSyncExternalStore(subscribe, () => state.snapshot, () => state.snapshot);
  return {
    ...snap,
    connected: snap.status === 'connected',
    onRitual: snap.status === 'connected' && snap.chainId === ritualChain.id,
    connect,
    disconnect,
    switchToRitual,
    walletClient,
  };
}

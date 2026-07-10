/**
 * Single data entry point for pages: launches are read live from the
 * CovenantRegistry (src/chain/launches.js) — there is no mock fallback.
 * Launch ids are token addresses, so /token/:id routes are addresses.
 * refreshLaunches() refetches after a deploy so a new launch appears
 * without a reload. While any page is subscribed the store re-polls:
 * the public RPC's backends disagree on log history, so repeated
 * fetches let the enforcement-log session cache converge on the
 * complete set (and keep guardian heartbeat/current block live).
 */
import { useEffect, useSyncExternalStore } from 'react';
import { CHAIN_READS_ENABLED } from '../config/ritual.js';

const POLL_MS = 30_000;

const state = {
  /** @type {{ launches: import('./launches.js').Launch[], currentBlock: number, pending: boolean, error: string|null }} */
  snapshot: { launches: [], currentBlock: 0, pending: CHAIN_READS_ENABLED, error: null },
  listeners: new Set(),
  fetched: false,
  timer: null,
};

function subscribe(listener) {
  state.listeners.add(listener);
  // Poll only while someone is mounted; subscribe never runs during SSR.
  if (state.listeners.size === 1 && CHAIN_READS_ENABLED) {
    state.timer = setInterval(fetchLaunches, POLL_MS);
  }
  return () => {
    state.listeners.delete(listener);
    if (state.listeners.size === 0 && state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  };
}

function notify() {
  state.listeners.forEach((l) => l());
}

async function fetchLaunches() {
  if (!CHAIN_READS_ENABLED) {
    state.snapshot = { ...state.snapshot, pending: false, error: 'No CovenantRegistry address configured (see src/config/ritual.js).' };
    notify();
    return;
  }
  try {
    const { fetchChainLaunches } = await import('../chain/launches.js');
    const { currentBlock, launches } = await fetchChainLaunches();
    state.snapshot = { launches, currentBlock, pending: false, error: null };
  } catch (err) {
    console.warn('[vestal] chain read failed:', err);
    // Keep the last good snapshot on a failed background poll — only
    // surface the error when there's no data to show yet.
    state.snapshot = {
      ...state.snapshot,
      pending: false,
      error: state.snapshot.launches.length
        ? null
        : 'Could not reach Ritual Chain — check your connection and reload.',
    };
  }
  notify();
}

function fetchOnce() {
  if (state.fetched) return;
  state.fetched = true;
  fetchLaunches();
}

/** Refetch the registry (e.g. right after a launch deploys). */
export function refreshLaunches() {
  state.fetched = true;
  state.snapshot = { ...state.snapshot, pending: true };
  notify();
  return fetchLaunches();
}

/** All launches plus the block height countdowns should compute against. */
export function useLaunches() {
  useEffect(() => {
    fetchOnce();
  }, []);
  return useSyncExternalStore(subscribe, () => state.snapshot, () => state.snapshot);
}

/** One launch by token address. */
export function useLaunch(id) {
  const { launches, currentBlock, pending, error } = useLaunches();
  const launch = launches.find((l) => l.id === id?.toLowerCase()) ?? null;
  return { launch, currentBlock, pending, error };
}

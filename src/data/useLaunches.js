/**
 * Single data entry point for pages: mock launches render instantly,
 * and when a registry address is configured (VITE_COVENANT_REGISTRY,
 * see src/config/ritual.js) real chain launches are fetched once and
 * shown ahead of the mocks. Chain launch ids are token addresses, so
 * /token/:id routes work unchanged.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { LAUNCHES, CURRENT_BLOCK } from './launches.js';
import { CHAIN_READS_ENABLED } from '../config/ritual.js';

const state = {
  /** @type {{ launches: import('./launches.js').Launch[], currentBlock: number, source: 'mock'|'chain', pending: boolean }} */
  snapshot: { launches: LAUNCHES, currentBlock: CURRENT_BLOCK, source: 'mock', pending: CHAIN_READS_ENABLED },
  listeners: new Set(),
  fetched: false,
};

function subscribe(listener) {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

async function fetchOnce() {
  if (state.fetched || !CHAIN_READS_ENABLED) return;
  state.fetched = true;
  try {
    const { fetchChainLaunches } = await import('../chain/launches.js');
    const { currentBlock, launches } = await fetchChainLaunches();
    state.snapshot = {
      launches: launches.length ? [...launches, ...LAUNCHES] : LAUNCHES,
      currentBlock: launches.length ? currentBlock : CURRENT_BLOCK,
      source: launches.length ? 'chain' : 'mock',
      pending: false,
    };
  } catch (err) {
    // Chain unreachable — mocks stay up; log for the developer.
    console.warn('[vestal] chain read failed, showing illustrative data:', err);
    state.snapshot = { ...state.snapshot, pending: false };
  }
  state.listeners.forEach((l) => l());
}

/** All launches plus the block height countdowns should compute against. */
export function useLaunches() {
  useEffect(() => {
    fetchOnce();
  }, []);
  return useSyncExternalStore(subscribe, () => state.snapshot, () => state.snapshot);
}

/** One launch by id (mock slug or token address). */
export function useLaunch(id) {
  const { launches, currentBlock, source, pending } = useLaunches();
  const launch = launches.find((l) => l.id === id) ?? null;
  return { launch, currentBlock, source, pending };
}

/**
 * Home-page activity feed: merged buys, sells, and token creations
 * across all launches (src/chain/activity.js), polled while mounted on
 * the same cadence as useMarket. Waits for the launches list to load
 * first — pass `ready` from useLaunches — and keeps the last good
 * snapshot on a failed background poll.
 */
import { useEffect, useState } from 'react';

export function useActivity(launches, ready) {
  const [state, setState] = useState({ events: [], currentBlock: 0, pending: true, error: null });

  useEffect(() => {
    if (launches.length === 0) {
      // Registry loaded but holds no launches — nothing to feed.
      if (ready) setState((s) => (s.pending ? { ...s, pending: false } : s));
      return;
    }
    let cancelled = false;

    async function refresh() {
      try {
        const { fetchActivity } = await import('../chain/activity.js');
        const { events, currentBlock } = await fetchActivity(launches);
        if (!cancelled) setState({ events, currentBlock, pending: false, error: null });
      } catch (err) {
        console.warn('[vestal] activity read failed:', err);
        if (!cancelled) {
          setState((s) =>
            s.events.length > 0
              ? s
              : { ...s, pending: false, error: 'Could not read live activity from Ritual Chain.' },
          );
        }
      }
    }

    refresh();
    const timer = setInterval(refresh, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [launches, ready]);

  return state;
}

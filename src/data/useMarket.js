/**
 * Per-token market state: pool, live price, reserves, and on-chain trade
 * history via src/chain/market.js. `market` is null when the token has
 * no seeded pool — pages render their "no market yet" state from that.
 * `refresh` refetches after a trade.
 */
import { useCallback, useEffect, useState } from 'react';

export function useMarket(tokenAddress) {
  const [state, setState] = useState({ market: null, pending: true, error: null });

  const refresh = useCallback(async () => {
    if (!tokenAddress) return;
    try {
      const { fetchMarket } = await import('../chain/market.js');
      const market = await fetchMarket(tokenAddress);
      setState({ market, pending: false, error: null });
    } catch (err) {
      console.warn('[vestal] market read failed:', err);
      // Keep the last good snapshot on a failed background poll.
      setState((s) =>
        s.market ? s : { market: null, pending: false, error: 'Could not read the market from Ritual Chain.' },
      );
    }
  }, [tokenAddress]);

  // Poll while mounted: the public RPC's backends disagree on log
  // history, so repeated fetches let the session trade cache converge
  // on the complete set (and keep price/reserves live).
  useEffect(() => {
    setState({ market: null, pending: true, error: null });
    refresh();
    const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
  }, [refresh]);

  return { ...state, refresh };
}

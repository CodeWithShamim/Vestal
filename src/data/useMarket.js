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
      setState({ market: null, pending: false, error: 'Could not read the market from Ritual Chain.' });
    }
  }, [tokenAddress]);

  useEffect(() => {
    setState({ market: null, pending: true, error: null });
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}

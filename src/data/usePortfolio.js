/**
 * Wallet portfolio: native balance plus every launch token the address
 * holds, priced via each token's pool (src/chain/portfolio.js).
 * `portfolio` stays null until an address is connected — no fetch runs
 * without one. `refresh` refetches after a trade.
 */
import { useCallback, useEffect, useState } from 'react';

export function usePortfolio(address) {
  const [state, setState] = useState({ portfolio: null, pending: Boolean(address), error: null });

  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      const { fetchPortfolio } = await import('../chain/portfolio.js');
      const portfolio = await fetchPortfolio(address);
      setState({ portfolio, pending: false, error: null });
    } catch (err) {
      console.warn('[vestal] portfolio read failed:', err);
      setState({ portfolio: null, pending: false, error: 'Could not read your portfolio from Ritual Chain.' });
    }
  }, [address]);

  useEffect(() => {
    if (!address) {
      setState({ portfolio: null, pending: false, error: null });
      return;
    }
    setState({ portfolio: null, pending: true, error: null });
    refresh();
  }, [address, refresh]);

  return { ...state, refresh };
}

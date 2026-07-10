/**
 * DexScreener-style transactions table for a token's LaunchPool: every
 * on-chain Swap in the recent block window, newest first, with buy/sell
 * filter tabs. Rows link the maker and the transaction to the explorer.
 */
import { useState } from 'react';
import Card from './Card.jsx';
import { blocksToApproxTime, fmtNative, shortAddr } from '../data/launches.js';
import { EXPLORER_URL, RITUAL_TESTNET } from '../config/ritual.js';

const SYM = RITUAL_TESTNET.nativeCurrency.symbol;
const PAGE_SIZE = 10;

/** Token amounts: compact past 1M, whole-ish above 1, precise below. */
const fmtAmount = (v) => {
  if (v >= 1_000_000) return v.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });
  if (v >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return v.toLocaleString('en-US', { maximumFractionDigits: 6 });
};

const FILTERS = ['all', 'buys', 'sells'];

const thClass = 'px-3 py-3 font-medium first:pl-6 last:pr-6';

export default function TradeHistory({ trades, symbol, currentBlock }) {
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);

  const buys = trades.filter((t) => t.isBuy).length;
  const counts = { all: trades.length, buys, sells: trades.length - buys };

  const filtered = [...trades]
    .reverse()
    .filter((t) => filter === 'all' || t.isBuy === (filter === 'buys'));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  function switchFilter(next) {
    setFilter(next);
    setPage(0);
  }

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linefaint px-6 py-4">
        <h2 className="font-display text-lg font-medium text-cream">Transactions</h2>
        <div className="flex rounded-lg border border-line p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => switchFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                filter === f ? 'bg-ember/20 text-cream' : 'text-faint hover:text-fog'
              }`}
            >
              {f} <span className={filter === f ? 'text-fog' : ''}>{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-6 py-8 text-sm text-faint">
          {trades.length === 0
            ? 'No swaps in the recent block window yet — trades appear here the moment they settle.'
            : `No ${filter} in the recent block window.`}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b border-linefaint text-left text-[11px] uppercase tracking-wider text-faint">
                <th className={thClass}>Age</th>
                <th className={thClass}>Type</th>
                <th className={`${thClass} text-right`}>Price ({SYM})</th>
                <th className={`${thClass} text-right`}>Amount ({symbol})</th>
                <th className={`${thClass} text-right`}>Total ({SYM})</th>
                <th className={`${thClass} text-right`}>Maker</th>
                <th className={`${thClass} text-right`}>Txn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linefaint">
              {rows.map((t) => {
                const tone = t.isBuy ? 'text-status-good' : 'text-status-warn';
                return (
                  <tr key={`${t.txHash}-${t.logIndex}`} className="transition-colors hover:bg-ink/60">
                    <td className="whitespace-nowrap py-2.5 pl-6 pr-3 text-faint">
                      {blocksToApproxTime(currentBlock - t.block)}
                    </td>
                    <td className={`px-3 py-2.5 font-semibold ${tone}`}>{t.isBuy ? 'Buy' : 'Sell'}</td>
                    <td className={`mono px-3 py-2.5 text-right ${tone}`}>{fmtNative(t.price)}</td>
                    <td className={`mono px-3 py-2.5 text-right ${tone}`}>{fmtAmount(t.tokens)}</td>
                    <td className={`mono px-3 py-2.5 text-right ${tone}`}>{fmtNative(t.native)}</td>
                    <td className="mono whitespace-nowrap px-3 py-2.5 text-right">
                      <a
                        href={`${EXPLORER_URL}/address/${t.maker}`}
                        target="_blank"
                        rel="noreferrer"
                        title={t.maker}
                        className="text-fog underline decoration-ember/30 underline-offset-4 transition-colors hover:text-gold"
                      >
                        {shortAddr(t.maker)}
                      </a>
                    </td>
                    <td className="py-2.5 pl-3 pr-6 text-right">
                      <a
                        href={`${EXPLORER_URL}/tx/${t.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="View transaction on explorer"
                        className="inline-flex text-faint transition-colors hover:text-gold"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path
                            d="M6.5 3.5h6v6m0-6L5 11m-1.5-6H3A1.5 1.5 0 0 0 1.5 6.5V13A1.5 1.5 0 0 0 3 14.5h6.5A1.5 1.5 0 0 0 11 13v-.5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linefaint px-6 py-3">
        <span className="text-xs text-faint">
          Read live from the pool's on-chain Swap events — ages are block-derived approximations.
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="font-semibold text-gold transition-colors hover:text-cream disabled:cursor-not-allowed disabled:text-faint"
            >
              ‹ Prev
            </button>
            <span className="text-faint">
              Page {current + 1} of {pageCount}
            </span>
            <button
              type="button"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
              className="font-semibold text-gold transition-colors hover:text-cream disabled:cursor-not-allowed disabled:text-faint"
            >
              Next ›
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

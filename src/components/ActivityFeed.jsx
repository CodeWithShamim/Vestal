/**
 * Live cross-market activity table for the home page: recent buys,
 * sells, and token creations across every Vestal launch, newest first,
 * with type filter tabs and pagination. Tokens link to their detail
 * page; makers and transactions link to the explorer.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from './Card.jsx';
import TokenAvatar from './TokenAvatar.jsx';
import { blocksToApproxTime, fmtAmount, fmtNative, shortAddr } from '../data/launches.js';
import { EXPLORER_URL, RITUAL_TESTNET } from '../config/ritual.js';

const SYM = RITUAL_TESTNET.nativeCurrency.symbol;
const PAGE_SIZE = 10;

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'buy', label: 'Buys' },
  { id: 'sell', label: 'Sells' },
  { id: 'create', label: 'Launches' },
];

const KIND_META = {
  buy: { label: 'Buy', tone: 'text-status-good' },
  sell: { label: 'Sell', tone: 'text-status-warn' },
  create: { label: 'New token', tone: 'text-gold' },
};

const thClass = 'px-3 py-3 font-medium first:pl-6 last:pr-6';

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.5 3.5h6v6m0-6L5 11m-1.5-6H3A1.5 1.5 0 0 0 1.5 6.5V13A1.5 1.5 0 0 0 3 14.5h6.5A1.5 1.5 0 0 0 11 13v-.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ActivityFeed({ events, currentBlock, pending, error, className = '' }) {
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);

  const counts = { all: events.length };
  for (const f of FILTERS.slice(1)) counts[f.id] = events.filter((e) => e.kind === f.id).length;

  const filtered = events.filter((e) => filter === 'all' || e.kind === filter);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  function switchFilter(next) {
    setFilter(next);
    setPage(0);
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linefaint px-6 py-4">
        <h3 className="inline-flex items-center gap-2.5 font-display text-lg font-medium text-cream">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-good opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-status-good" />
          </span>
          Live activity
        </h3>
        <div className="flex rounded-lg border border-line p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => switchFilter(f.id)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                filter === f.id ? 'bg-ember/20 text-cream' : 'text-faint hover:text-fog'
              }`}
            >
              {f.label} <span className={filter === f.id ? 'text-fog' : ''}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-6 py-8 text-sm text-faint">
          {error ??
            (pending
              ? 'Reading recent activity from Ritual Chain…'
              : events.length === 0
                ? 'No on-chain activity in the recent block window yet — trades and launches appear here the moment they settle.'
                : `No ${FILTERS.find((f) => f.id === filter).label.toLowerCase()} in the recent block window.`)}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b border-linefaint text-left text-[11px] uppercase tracking-wider text-faint">
                <th className={thClass}>Age</th>
                <th className={thClass}>Type</th>
                <th className={thClass}>Token</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={`${thClass} text-right`}>Total ({SYM})</th>
                <th className={`${thClass} text-right`}>Maker</th>
                <th className={`${thClass} text-right`}>Txn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linefaint">
              {rows.map((e) => {
                const meta = KIND_META[e.kind];
                const isTrade = e.kind !== 'create';
                return (
                  <tr
                    key={e.txHash ? `${e.txHash}-${e.logIndex}` : `create-${e.launch.id}`}
                    className="transition-colors hover:bg-ink/60"
                  >
                    <td className="whitespace-nowrap py-2.5 pl-6 pr-3 text-faint">
                      {blocksToApproxTime(currentBlock - e.block)}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 font-semibold ${meta.tone}`}>{meta.label}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Link
                        to={`/token/${e.launch.id}`}
                        className="inline-flex items-center gap-2 font-medium text-cream transition-colors hover:text-gold"
                      >
                        <TokenAvatar name={e.launch.name} symbol={e.launch.symbol} size={20} />
                        {e.launch.symbol}
                      </Link>
                    </td>
                    <td className={`mono px-3 py-2.5 text-right ${isTrade ? meta.tone : 'text-faint'}`}>
                      {isTrade ? fmtAmount(e.tokens) : '—'}
                    </td>
                    <td className={`mono px-3 py-2.5 text-right ${isTrade ? meta.tone : 'text-faint'}`}>
                      {isTrade ? fmtNative(e.native) : '—'}
                    </td>
                    <td className="mono whitespace-nowrap px-3 py-2.5 text-right">
                      <a
                        href={`${EXPLORER_URL}/address/${e.maker}`}
                        target="_blank"
                        rel="noreferrer"
                        title={e.maker}
                        className="text-fog underline decoration-ember/30 underline-offset-4 transition-colors hover:text-gold"
                      >
                        {shortAddr(e.maker)}
                      </a>
                    </td>
                    <td className="py-2.5 pl-3 pr-6 text-right">
                      <a
                        href={e.txHash ? `${EXPLORER_URL}/tx/${e.txHash}` : `${EXPLORER_URL}/address/${e.launch.id}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={e.txHash ? 'View transaction on explorer' : 'View token on explorer'}
                        className="inline-flex text-faint transition-colors hover:text-gold"
                      >
                        <ExternalIcon />
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
          Read live from pool Swap events and the CovenantRegistry — refreshes every 15s.
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

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import TokenAvatar from '../components/TokenAvatar.jsx';
import TrustMeter from '../components/TrustMeter.jsx';
import {
  LAUNCHES,
  CURRENT_BLOCK,
  vestedPct,
  trustScore,
  fmtUsd,
  blocksToApproxTime,
} from '../data/launches.js';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'enforcing', label: 'Enforcing' },
  { id: 'reviving', label: 'Reviving' },
];

const SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'guarded', label: 'Most guarded value' },
  { id: 'trust', label: 'Trust score' },
];

function LaunchCard({ launch }) {
  const vested = vestedPct(launch);
  const score = trustScore(launch);
  const lockBlocksLeft = launch.terms.lpLockUntilBlock - CURRENT_BLOCK;

  return (
    <Link to={`/token/${launch.id}`} className="block focus-visible:outline-2 focus-visible:outline-ember">
      <Card lift className="flex h-full flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <TokenAvatar name={launch.name} symbol={launch.symbol} />
            <div>
              <h3 className="font-display text-lg font-medium leading-tight text-cream">{launch.name}</h3>
              <span className="mono text-faint">${launch.symbol}</span>
            </div>
          </div>
          <Badge status={launch.guardian.status} />
        </div>

        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-fog">{launch.tagline}</p>

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-linefaint pt-4 text-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-faint">Supply vested</div>
            <div className="mt-0.5 font-semibold text-cream">{vested}%</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-faint">Value guarded</div>
            <div className="mt-0.5 font-semibold text-cream">{fmtUsd(launch.market.guardedUsd)}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[11px] uppercase tracking-wider text-faint">LP unlocks in</div>
            <div className="mono mt-0.5 text-cream">
              {blocksToApproxTime(lockBlocksLeft)}
              <span className="text-faint"> · {lockBlocksLeft.toLocaleString('en-US')} blocks</span>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-linefaint pt-4">
          <TrustMeter score={score} compact />
        </div>
      </Card>
    </Link>
  );
}

export default function Explore() {
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');

  const shown = useMemo(() => {
    let list = LAUNCHES.filter((l) => status === 'all' || l.guardian.status === status);
    const bySort = {
      newest: (a, b) => b.createdAtBlock - a.createdAtBlock,
      guarded: (a, b) => b.market.guardedUsd - a.market.guardedUsd,
      trust: (a, b) => trustScore(b) - trustScore(a),
    };
    return [...list].sort(bySort[sort]);
  }, [status, sort]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <div className="max-w-2xl">
        <div className="kicker">Explore</div>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-cream">
          Launches under guardianship
        </h1>
        <p className="mt-4 leading-relaxed text-fog">
          Every token below is enforced by its own sovereign agent. The badges are live guardian states —
          including the uncomfortable ones. A launchpad that only ever shows green is hiding something.
        </p>
      </div>

      {/* Filters — one row above the grid */}
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-line bg-surface p-1" role="group" aria-label="Filter by guardian status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id)}
              aria-pressed={status === f.id}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                status === f.id ? 'bg-raise text-cream' : 'text-fog hover:text-cream'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-faint">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-cream outline-none focus:border-ember/60"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <Card className="mt-8 p-12 text-center text-fog">No launches in this state right now.</Card>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((l) => (
            <LaunchCard key={l.id} launch={l} />
          ))}
        </div>
      )}

      <p className="mt-10 text-xs text-faint">
        Illustrative testnet data. Trust scores are derived from each guardian's attested enforcement history —
        audits passed and releases executed raise them; violations caught lower them.
      </p>
    </div>
  );
}

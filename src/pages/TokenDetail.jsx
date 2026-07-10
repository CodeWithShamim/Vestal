import { useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import TokenAvatar from '../components/TokenAvatar.jsx';
import TrustMeter from '../components/TrustMeter.jsx';
import Timeline from '../components/Timeline.jsx';
import Sparkline from '../components/Sparkline.jsx';
import HeartbeatMonitor from '../components/HeartbeatMonitor.jsx';
import {
  priceSeries,
  vestedPct,
  trustScore,
  fmtBlock,
  fmtUsd,
  shortAddr,
  mockHex,
  shortHash,
  blocksToApproxTime,
} from '../data/launches.js';
import { useLaunch } from '../data/useLaunches.js';

function TermRow({ title, detail, attestationKey }) {
  return (
    <li className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-status-good/40 text-status-good"
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5 4.8 9 10 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-cream">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-fog">{detail}</div>
        <a
          href="#attestation"
          onClick={(e) => e.preventDefault()}
          title="Attestation viewer connects to the explorer at chain integration"
          className="mono mt-1 inline-block text-ember/90 underline decoration-ember/30 underline-offset-4 transition-colors hover:text-gold"
        >
          view attestation {shortHash(mockHex(attestationKey))}
        </a>
      </div>
    </li>
  );
}

function BuyWidget({ launch }) {
  const [amount, setAmount] = useState('');
  const [connected, setConnected] = useState(false);
  const parsed = parseFloat(amount);
  const estimate = parsed > 0 && launch.market.priceUsd > 0 ? parsed / launch.market.priceUsd : 0;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-medium text-cream">Buy {launch.symbol}</h2>
        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-faint">
          Testnet mock
        </span>
      </div>
      <label className="mt-5 block">
        <span className="text-[11px] uppercase tracking-wider text-faint">You pay (tRITUAL)</span>
        <input
          type="number"
          min="0"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="mt-1.5 w-full rounded-lg border border-line bg-ink px-4 py-3 text-lg font-medium text-cream outline-none transition-colors placeholder:text-faint focus:border-ember/60"
        />
      </label>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-linefaint bg-ink px-4 py-3">
        <span className="text-[11px] uppercase tracking-wider text-faint">You receive (est.)</span>
        <span className="font-semibold text-cream">
          {estimate > 0 ? estimate.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'} {launch.symbol}
        </span>
      </div>
      {connected ? (
        <button type="button" className="btn-ember mt-4 w-full" disabled title="Swap execution arrives with chain integration">
          Review swap — chain integration pending
        </button>
      ) : (
        <button type="button" className="btn-ember mt-4 w-full" onClick={() => setConnected(true)}>
          Connect wallet
        </button>
      )}
      <p className="mt-3 text-xs leading-relaxed text-faint">
        {connected
          ? 'Mock session — real connection wires through viem/wagmi against the chain constants in src/config/ritual.js.'
          : 'Testnet only. No real value is at stake anywhere on Vestal today.'}
      </p>
    </Card>
  );
}

export default function TokenDetail() {
  const { id } = useParams();
  const { launch, currentBlock, pending } = useLaunch(id);
  if (!launch) {
    // A chain launch id may not resolve until the registry read lands.
    if (pending) return null;
    return <Navigate to="/explore" replace />;
  }

  const { guardian, terms, market } = launch;
  const vested = vestedPct(launch);
  const score = trustScore(launch);
  const series = priceSeries(launch);
  const lockBlocksLeft = terms.lpLockUntilBlock - currentBlock;
  const nextTranche = terms.vesting.find((t) => !t.released);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <Link to="/explore" className="inline-flex items-center gap-1.5 text-sm text-fog transition-colors hover:text-cream">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M13 8H3m0 0 4-4M3 8l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        All launches
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_440px]">
        {/* ── Left column: token ─────────────────────────────────────── */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-4">
            <TokenAvatar name={launch.name} symbol={launch.symbol} size={56} />
            <div>
              <h1 className="font-display text-3xl font-medium tracking-tight text-cream">
                {launch.name} <span className="mono ml-1 text-faint">${launch.symbol}</span>
              </h1>
              <p className="mt-1 text-sm text-fog">{launch.tagline}</p>
            </div>
          </div>

          <Card className="mt-6 p-6">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-display text-3xl font-medium text-cream">
                ${market.priceUsd < 0.01 ? market.priceUsd.toFixed(4) : market.priceUsd.toFixed(2)}
              </span>
              <span className={`text-sm font-semibold ${market.change24h >= 0 ? 'text-status-good' : 'text-status-warn'}`}>
                {market.change24h >= 0 ? '▲' : '▼'} {Math.abs(market.change24h).toFixed(1)}% · 24h
              </span>
            </div>
            <div className="mt-4">
              <Sparkline
                series={series}
                formatValue={(v) => (v < 0.01 ? v.toFixed(5) : v.toFixed(3))}
              />
            </div>
            <p className="mt-2 text-xs text-faint">Illustrative price data — live chart lands with chain integration.</p>
            <div className="mt-5 grid grid-cols-3 gap-4 border-t border-linefaint pt-5 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-faint">Value guarded</div>
                <div className="mt-0.5 font-semibold text-cream">{fmtUsd(market.guardedUsd)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-faint">Holders</div>
                <div className="mt-0.5 font-semibold text-cream">{market.holders.toLocaleString('en-US')}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-faint">Supply vested</div>
                <div className="mt-0.5 font-semibold text-cream">{vested}%</div>
              </div>
            </div>
          </Card>

          <div className="mt-6">
            <BuyWidget launch={launch} />
          </div>

          <Card className="mt-6 p-6">
            <h2 className="font-display text-lg font-medium text-cream">About {launch.name}</h2>
            <p className="mt-3 text-sm leading-relaxed text-fog">{launch.description}</p>
            <dl className="mt-5 grid gap-3 border-t border-linefaint pt-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-faint">Creator</dt>
                <dd className="mono mt-0.5 text-fog">{shortAddr(launch.creator)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-faint">Launched</dt>
                <dd className="mono mt-0.5 text-fog">block {fmtBlock(launch.createdAtBlock)}</dd>
              </div>
            </dl>
          </Card>
        </div>

        {/* ── Right column: Guardian Panel ───────────────────────────── */}
        <aside>
          <Card className="overflow-hidden border-ember/20">
            <div
              className="border-b border-linefaint px-6 py-5"
              style={{ background: 'linear-gradient(160deg, rgba(242,96,31,0.10) 0%, transparent 55%)' }}
            >
              <div className="flex items-center justify-between">
                <div className="kicker !text-gold">Guardian Panel</div>
                <Badge status={guardian.status} />
              </div>
              <h2 className="mt-2 font-display text-xl font-medium text-cream">
                A sovereign agent is enforcing this launch.
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-fog">
                No human holds its keys. Every action below settled on-chain with a TEE attestation.
              </p>
            </div>

            <div className="flex flex-col gap-5 px-6 py-6">
              {/* Identity */}
              <div className="rounded-lg border border-linefaint bg-ink/60 p-4">
                <div className="kicker">Agent identity</div>
                <dl className="mt-3 flex flex-col gap-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-faint">Address</dt>
                    <dd className="mono text-cream" title={guardian.address}>{shortAddr(guardian.address)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-faint">Build</dt>
                    <dd className="mono text-right text-cream">{guardian.model}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-faint">Deployed</dt>
                    <dd className="mono text-cream">block {fmtBlock(guardian.deployedBlock)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-faint">Keys</dt>
                    <dd className="text-right text-cream">DKMS — never seen by a human</dd>
                  </div>
                </dl>
              </div>

              <HeartbeatMonitor guardian={guardian} currentBlock={currentBlock} />

              <TrustMeter score={score} />

              {/* Committed terms */}
              <div>
                <div className="kicker">Committed terms</div>
                <ul className="mt-3 divide-y divide-linefaint rounded-lg border border-linefaint bg-ink/60 px-4 py-4">
                  <TermRow
                    title={`LP locked until block ${fmtBlock(terms.lpLockUntilBlock)}`}
                    detail={`${terms.lpPctLocked}% of liquidity under guardian custody — unlocks in ${blocksToApproxTime(lockBlocksLeft)}.`}
                    attestationKey={`${launch.id}:term:lp`}
                  />
                  <TermRow
                    title={`Vesting: ${terms.vesting.length} tranches, ${terms.vesting.reduce((s, t) => s + t.pct, 0)}% of supply`}
                    detail={
                      nextTranche
                        ? `Next: ${nextTranche.label} (${nextTranche.pct}%) at block ${fmtBlock(nextTranche.atBlock)} — in ${blocksToApproxTime(nextTranche.atBlock - currentBlock)}.`
                        : 'All tranches released on schedule.'
                    }
                    attestationKey={`${launch.id}:term:vesting`}
                  />
                  <TermRow
                    title={`Dev wallet capped at ${terms.devWalletCapPct}% per 30 days`}
                    detail="Sales beyond the cap are frozen by the guardian automatically — no warnings, no exceptions."
                    attestationKey={`${launch.id}:term:cap`}
                  />
                  <TermRow
                    title={`Insider audit every ${fmtBlock(terms.monitorEveryBlocks)} blocks`}
                    detail={`The guardian wakes itself via the native Scheduler roughly every ${blocksToApproxTime(terms.monitorEveryBlocks)} — no keeper bots involved.`}
                    attestationKey={`${launch.id}:term:monitor`}
                  />
                </ul>
              </div>

              {/* Enforcement log */}
              <div>
                <div className="flex items-baseline justify-between">
                  <div className="kicker">Enforcement log</div>
                  <span className="text-[11px] text-faint">newest first</span>
                </div>
                <div className="mt-4">
                  <Timeline events={launch.log} currentBlock={currentBlock} />
                </div>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

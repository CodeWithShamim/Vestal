import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import TokenAvatar from '../components/TokenAvatar.jsx';
import TrustMeter from '../components/TrustMeter.jsx';
import Timeline from '../components/Timeline.jsx';
import Sparkline from '../components/Sparkline.jsx';
import HeartbeatMonitor from '../components/HeartbeatMonitor.jsx';
import TradeHistory from '../components/TradeHistory.jsx';
import {
  vestedPct,
  trustScore,
  fmtBlock,
  fmtNative,
  shortAddr,
  shortHash,
  blocksToApproxTime,
} from '../data/launches.js';
import { useLaunch } from '../data/useLaunches.js';
import { useMarket } from '../data/useMarket.js';
import { useWallet } from '../chain/wallet.js';
import { estimateBuy, estimateSell, buyTokens, sellTokens, openMarket, fetchTokenBalance } from '../chain/market.js';
import { EXPLORER_URL, RITUAL_TESTNET } from '../config/ritual.js';

const SYM = RITUAL_TESTNET.nativeCurrency.symbol;

function MarketCard({ market, pending, error, symbol }) {
  if (pending) {
    return <Card className="mt-6 p-6 text-sm text-faint">Reading market from Ritual Chain…</Card>;
  }
  if (error) {
    return <Card className="mt-6 p-6 text-sm text-status-warn">{error}</Card>;
  }
  if (!market) {
    return (
      <Card className="mt-6 p-6">
        <h2 className="font-display text-lg font-medium text-cream">No market yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-fog">
          No liquidity pool has been seeded for {symbol}. Once the creator opens one through the
          VestalPoolFactory and locks its LP shares into the covenant, live pricing and trading appear here.
          If this is your launch, connect the creator wallet — the open-market flow appears right here.
        </p>
      </Card>
    );
  }

  const series = market.trades.map((t) => t.price);
  return (
    <Card className="mt-6 p-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-display text-3xl font-medium text-cream">
          {fmtNative(market.priceNative)} <span className="text-base text-faint">{SYM}</span>
        </span>
        {market.change && (
          <span className={`text-sm font-semibold ${market.change.pct >= 0 ? 'text-status-good' : 'text-status-warn'}`}>
            {market.change.pct >= 0 ? '▲' : '▼'} {Math.abs(market.change.pct).toFixed(1)}% · {market.change.label}
          </span>
        )}
      </div>
      {series.length >= 2 ? (
        <div className="mt-4">
          <Sparkline series={series} formatValue={(v) => `${fmtNative(v)} ${SYM}`} />
        </div>
      ) : (
        <p className="mt-4 text-xs text-faint">Not enough trades yet to chart — history builds with each swap.</p>
      )}
      <p className="mt-2 text-xs text-faint">
        Price and history read from the pool's on-chain Swap events ({market.trades.length} trade
        {market.trades.length === 1 ? '' : 's'} in the recent block window).
      </p>
      <div className="mt-5 grid grid-cols-3 gap-4 border-t border-linefaint pt-5 text-sm">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-faint">Pool liquidity</div>
          <div className="mt-0.5 font-semibold text-cream">{fmtNative(market.reserveNative * 2)} {SYM}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-faint">LP in covenant custody</div>
          <div className="mt-0.5 font-semibold text-cream">{fmtNative(market.guardedNative)} {SYM}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-faint">Pool contract</div>
          <div className="mono mt-0.5 text-cream">
            <a
              href={`${EXPLORER_URL}/address/${market.pool}`}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-ember/30 underline-offset-4 transition-colors hover:text-gold"
            >
              {shortAddr(market.pool)}
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Connect / switch-network fallback shared by the trade and open-market cards. */
function WalletGate({ wallet, children }) {
  if (wallet.onRitual) return children;
  if (wallet.connected) {
    return (
      <button type="button" className="btn-ember mt-4 w-full" onClick={wallet.switchToRitual}>
        Switch wallet to {RITUAL_TESTNET.name}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="btn-ember mt-4 w-full disabled:opacity-60"
      disabled={wallet.status === 'connecting'}
      onClick={wallet.connect}
    >
      {wallet.status === 'connecting' ? 'Connecting…' : 'Connect wallet'}
    </button>
  );
}

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-ink px-4 py-3 text-lg font-medium text-cream outline-none transition-colors placeholder:text-faint focus:border-ember/60';

function TradeWidget({ launch, market, onTraded }) {
  const wallet = useWallet();
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    let stale = false;
    if (wallet.connected) {
      fetchTokenBalance(launch.id, wallet.address)
        .then((b) => !stale && setBalance(b))
        .catch(() => {});
    } else {
      setBalance(null);
    }
    return () => {
      stale = true;
    };
  }, [wallet.connected, wallet.address, launch.id, txHash]);

  const isBuy = side === 'buy';
  const parsed = parseFloat(amount);
  const estimate = isBuy ? estimateBuy(market, parsed) : estimateSell(market, parsed);

  function switchSide(next) {
    setSide(next);
    setAmount('');
    setError(null);
    setTxHash(null);
  }

  async function onTrade() {
    setSubmitting(true);
    setError(null);
    setTxHash(null);
    try {
      const minOut = estimate * 0.99; // 1% slippage guard
      const hash = isBuy
        ? await buyTokens({ pool: market.pool, nativeAmount: parsed, minTokensOut: minOut })
        : await sellTokens({ pool: market.pool, token: launch.id, tokenAmount: parsed, minNativeOut: minOut });
      setTxHash(hash);
      setAmount('');
      onTraded();
    } catch (err) {
      setError(err?.shortMessage || err?.message || 'Swap failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-line p-0.5">
          {['buy', 'sell'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => switchSide(s)}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                side === s ? 'bg-ember/20 text-cream' : 'text-faint hover:text-fog'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {balance !== null && (
          <span className="text-xs text-faint">
            You hold <span className="mono text-fog">{balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span> {launch.symbol}
          </span>
        )}
      </div>
      <label className="mt-5 block">
        <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-faint">
          <span>{isBuy ? `You pay (${SYM})` : `You sell (${launch.symbol})`}</span>
          {!isBuy && balance > 0 && (
            <button
              type="button"
              className="text-gold transition-colors hover:text-cream"
              onClick={() => setAmount(String(Math.floor(balance * 1e6) / 1e6))}
            >
              Max
            </button>
          )}
        </span>
        <input
          type="number"
          min="0"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className={inputClass}
        />
      </label>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-linefaint bg-ink px-4 py-3">
        <span className="text-[11px] uppercase tracking-wider text-faint">You receive (est.)</span>
        <span className="font-semibold text-cream">
          {estimate > 0 ? estimate.toLocaleString('en-US', { maximumFractionDigits: isBuy ? 2 : 6 }) : '—'}{' '}
          {isBuy ? launch.symbol : SYM}
        </span>
      </div>
      <WalletGate wallet={wallet}>
        <button
          type="button"
          className="btn-ember mt-4 w-full disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!(parsed > 0) || submitting}
          onClick={onTrade}
        >
          {submitting
            ? 'Swapping — confirm in wallet…'
            : isBuy
              ? `Buy ${launch.symbol}`
              : `Sell ${launch.symbol}`}
        </button>
      </WalletGate>
      {(error || wallet.error) && (
        <p className="mt-3 text-xs leading-relaxed text-status-warn">{error || wallet.error}</p>
      )}
      {txHash && (
        <p className="mt-3 text-xs leading-relaxed text-status-good">
          Swap confirmed —{' '}
          <a
            href={`${EXPLORER_URL}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mono underline decoration-status-good/40 underline-offset-4"
          >
            {shortHash(txHash)}
          </a>
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-faint">
        Swaps execute against the LaunchPool with a 0.3% fee and 1% slippage guard.
        {!isBuy && ' Selling needs a one-time approval first, and the covenant’s sell cap applies to tracked wallets.'}{' '}
        Testnet only — no real value is at stake.
      </p>
    </Card>
  );
}

const OPEN_MARKET_STEPS = {
  pool: 'Step 1 of 3 — creating the pool…',
  seed: 'Step 2 of 3 — seeding liquidity (approve, then deposit)…',
  lock: 'Step 3 of 3 — locking LP shares into the covenant…',
};

/** Shown to the launch creator while the token has no seeded pool. */
function OpenMarketCard({ launch, onOpened }) {
  const wallet = useWallet();
  const [tokenAmount, setTokenAmount] = useState('');
  const [nativeAmount, setNativeAmount] = useState('');
  const [step, setStep] = useState(null);
  const [error, setError] = useState(null);

  const tokens = parseFloat(tokenAmount);
  const native = parseFloat(nativeAmount);
  const ready = tokens > 0 && native > 0;

  async function onOpen() {
    setError(null);
    try {
      await openMarket({
        token: launch.id,
        covenant: launch.covenant,
        tokenAmount: tokens,
        nativeAmount: native,
        onStep: setStep,
      });
      onOpened();
    } catch (err) {
      setError(err?.shortMessage || err?.message || 'Opening the market failed.');
    } finally {
      setStep(null);
    }
  }

  return (
    <Card className="mt-6 p-6">
      <h2 className="font-display text-lg font-medium text-cream">Open the market for {launch.symbol}</h2>
      <p className="mt-2 text-sm leading-relaxed text-fog">
        You created this launch, so you can open its market: create the pool, seed the first liquidity,
        and lock the LP shares into the covenant — all from here. The ratio you deposit sets the opening
        price.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-faint">{launch.symbol} to deposit</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value)}
            placeholder="0.0"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-faint">{SYM} to deposit</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={nativeAmount}
            onChange={(e) => setNativeAmount(e.target.value)}
            placeholder="0.0"
            className={inputClass}
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-linefaint bg-ink px-4 py-3">
        <span className="text-[11px] uppercase tracking-wider text-faint">Opening price</span>
        <span className="font-semibold text-cream">
          {ready ? `${fmtNative(native / tokens)} ${SYM} / ${launch.symbol}` : '—'}
        </span>
      </div>
      <WalletGate wallet={wallet}>
        <button
          type="button"
          className="btn-ember mt-4 w-full disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!ready || step !== null}
          onClick={onOpen}
        >
          {step ? OPEN_MARKET_STEPS[step] : 'Open market & lock LP'}
        </button>
      </WalletGate>
      {(error || wallet.error) && (
        <p className="mt-3 text-xs leading-relaxed text-status-warn">{error || wallet.error}</p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-faint">
        Runs as separate transactions (create pool → approve → deposit → lock); if one fails you can retry
        and completed steps are skipped. LP shares stay in covenant custody until block{' '}
        {fmtBlock(launch.terms.lpLockUntilBlock)}.
      </p>
    </Card>
  );
}

function TermRow({ title, detail }) {
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
      </div>
    </li>
  );
}

export default function TokenDetail() {
  const { id } = useParams();
  const { launch, currentBlock, pending } = useLaunch(id);
  const { market, pending: marketPending, error: marketError, refresh: refreshMarket } = useMarket(launch?.id);
  const wallet = useWallet();
  if (!launch) {
    // A chain launch id may not resolve until the registry read lands.
    if (pending) return null;
    return <Navigate to="/explore" replace />;
  }

  const isCreator = wallet.connected && wallet.address?.toLowerCase() === launch.creator.toLowerCase();
  const { guardian, terms } = launch;
  const vested = vestedPct(launch);
  const score = trustScore(launch);
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

          {!market && !marketPending && !marketError && isCreator ? (
            <OpenMarketCard launch={launch} onOpened={refreshMarket} />
          ) : (
            <MarketCard market={market} pending={marketPending} error={marketError} symbol={launch.symbol} />
          )}

          {market && <TradeWidget launch={launch} market={market} onTraded={refreshMarket} />}

          {market && (
            <TradeHistory trades={market.trades} symbol={launch.symbol} currentBlock={market.currentBlock} />
          )}

          <Card className="mt-6 p-6">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-faint">Supply vested</div>
                <div className="mt-0.5 font-semibold text-cream">{vested}%</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-faint">Dev sell cap</div>
                <div className="mt-0.5 font-semibold text-cream">{terms.devWalletCapPct}% / 30d</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-faint">LP unlocks in</div>
                <div className="mt-0.5 font-semibold text-cream">{blocksToApproxTime(lockBlocksLeft)}</div>
              </div>
            </div>
          </Card>

          <Card className="mt-6 p-6">
            <h2 className="font-display text-lg font-medium text-cream">About {launch.name}</h2>
            <p className="mt-3 text-sm leading-relaxed text-fog">{launch.description}</p>
            <dl className="mt-5 grid gap-3 border-t border-linefaint pt-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-faint">Token contract</dt>
                <dd className="mono mt-0.5 text-fog">
                  <a
                    href={`${EXPLORER_URL}/address/${launch.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-ember/30 underline-offset-4 transition-colors hover:text-gold"
                  >
                    {shortAddr(launch.id)}
                  </a>
                </dd>
              </div>
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
                  />
                  <TermRow
                    title={`Vesting: ${terms.vesting.length} tranches, ${terms.vesting.reduce((s, t) => s + t.pct, 0)}% of supply`}
                    detail={
                      nextTranche
                        ? `Next: ${nextTranche.label} (${nextTranche.pct}%) at block ${fmtBlock(nextTranche.atBlock)} — in ${blocksToApproxTime(nextTranche.atBlock - currentBlock)}.`
                        : 'All tranches released on schedule.'
                    }
                  />
                  <TermRow
                    title={`Dev wallet capped at ${terms.devWalletCapPct}% per 30 days`}
                    detail="Sales beyond the cap are frozen by the guardian automatically — no warnings, no exceptions."
                  />
                  <TermRow
                    title={`Insider audit every ${fmtBlock(terms.monitorEveryBlocks)} blocks`}
                    detail={`The guardian wakes itself via the native Scheduler roughly every ${blocksToApproxTime(terms.monitorEveryBlocks)} — no keeper bots involved.`}
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
                  <Timeline events={launch.log} currentBlock={currentBlock} pageSize={5} />
                </div>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

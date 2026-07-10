import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';
import StepIndicator from '../components/StepIndicator.jsx';
import AllocationDonut from '../components/AllocationDonut.jsx';
import TokenAvatar from '../components/TokenAvatar.jsx';
import FlameMark from '../components/FlameMark.jsx';
import { CURRENT_BLOCK, fmtBlock, mockHex, shortAddr, shortHash } from '../data/launches.js';
import { BLOCK_TIME_SECONDS, RITUAL_TESTNET } from '../config/ritual.js';
import { useWallet } from '../chain/wallet.js';

const STEPS = ['Token basics', 'Tokenomics', 'Guardian terms', 'Review & deploy'];

const daysToBlocks = (days) => Math.round((days * 86_400) / BLOCK_TIME_SECONDS);

const MONITOR_OPTIONS = [
  { blocks: 150, label: 'Every 150 blocks (~5 min) — vigilant' },
  { blocks: 300, label: 'Every 300 blocks (~10 min) — standard' },
  { blocks: 1200, label: 'Every 1,200 blocks (~40 min) — relaxed' },
];

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-line bg-ink px-4 py-3 text-sm text-cream outline-none transition-colors placeholder:text-faint focus:border-ember/60';

function AllocationSlider({ label, value, onChange, locked = false }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-40 shrink-0 text-sm text-fog">{label}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        disabled={locked}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-[#F2601F]"
        aria-label={`${label} percent of supply`}
      />
      <span className="w-12 shrink-0 text-right text-sm font-semibold text-cream">{value}%</span>
    </div>
  );
}

export default function Launch() {
  const [step, setStep] = useState(0);

  // Step 1 — basics
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');

  // Step 2 — tokenomics
  const [supply, setSupply] = useState('100000000');
  const [alloc, setAlloc] = useState({ publicLp: 60, team: 15, treasury: 15, community: 10 });

  // Step 3 — guardian terms
  const [lpLockDays, setLpLockDays] = useState(365);
  const [vest, setVest] = useState({ cliffDays: 90, tranches: 6, intervalDays: 60 });
  const [devCapPct, setDevCapPct] = useState(2);
  const [monitorBlocks, setMonitorBlocks] = useState(300);

  // Step 4 — review
  const [signature, setSignature] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const wallet = useWallet();

  const allocTotal = alloc.publicLp + alloc.team + alloc.treasury + alloc.community;
  const allocations = [
    { label: 'Public & LP', pct: alloc.publicLp },
    { label: 'Team (vested)', pct: alloc.team },
    { label: 'Treasury', pct: alloc.treasury },
    { label: 'Community', pct: alloc.community },
  ];

  const sym = symbol.trim().toUpperCase();
  const displayName = name.trim() || 'Your token';

  const tranchePreview = useMemo(() => {
    const startBlock = CURRENT_BLOCK + daysToBlocks(vest.cliffDays);
    const per = alloc.team / vest.tranches;
    return Array.from({ length: vest.tranches }, (_, i) => ({
      label: `Tranche ${i + 1} of ${vest.tranches}`,
      pct: per,
      atBlock: startBlock + daysToBlocks(vest.intervalDays) * i,
      days: vest.cliffDays + vest.intervalDays * i,
    }));
  }, [vest, alloc.team]);

  const canNext = [
    name.trim().length >= 2 && sym.length >= 2 && sym.length <= 6,
    allocTotal === 100 && parseFloat(supply) > 0,
    true,
    signature === sym && acknowledged,
  ][step];

  const stepErrors = [
    'Name (2+ chars) and a 2–6 character symbol are required.',
    `Allocations must sum to exactly 100% — currently ${allocTotal}%.`,
    '',
    `Type ${sym || 'your symbol'} to sign, and acknowledge immutability.`,
  ];

  if (deployed) {
    const guardianAddr = mockHex(`wizard:${sym}:guardian`, 20);
    const covenantHash = mockHex(`wizard:${sym}:covenant`);
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <FlameMark size={48} ring className="mx-auto text-gold" />
        <h1 className="mt-6 font-display text-4xl font-medium tracking-tight text-cream">Covenant sealed.</h1>
        <p className="mx-auto mt-4 max-w-md leading-relaxed text-fog">
          This was a dry run — on testnet deployment, a sovereign guardian would now generate its keys via
          DKMS, take custody of {displayName}'s LP and vesting supply, and register its first wake-up with
          the Scheduler.
        </p>
        <Card className="mx-auto mt-8 max-w-md p-6 text-left">
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-faint">Guardian address</dt>
              <dd className="mono text-cream">{shortAddr(guardianAddr)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-faint">Covenant hash</dt>
              <dd className="mono text-cream">{shortHash(covenantHash)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-faint">Network</dt>
              <dd className="text-cream">{RITUAL_TESTNET.name}</dd>
            </div>
          </dl>
        </Card>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/explore" className="btn-ember">Explore launches</Link>
          <Link to="/docs" className="btn-ghost">Read the docs</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <div className="kicker">Launch wizard</div>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-cream">Commit your covenant</h1>
      <p className="mt-4 max-w-xl leading-relaxed text-fog">
        Four steps. At the end you sign terms that no one — including you — will ever be able to change.
        That permanence is the product.
      </p>

      <div className="mt-10">
        <StepIndicator steps={STEPS} current={step} />
      </div>

      <Card className="mt-8 p-7">
        {/* ── Step 1: basics ─────────────────────────────────────────── */}
        {step === 0 && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <TokenAvatar name={displayName} symbol={sym || '?'} size={52} />
              <div>
                <h2 className="font-display text-xl font-medium text-cream">Token basics</h2>
                <p className="text-sm text-fog">Identity only — nothing here binds the guardian yet.</p>
              </div>
            </div>
            <Field label="Token name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aurum" maxLength={32} />
            </Field>
            <Field label="Symbol" hint="2–6 characters. Your avatar is generated from it.">
              <input className={inputClass} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="e.g. AUR" maxLength={6} />
            </Field>
            <Field label="Description" hint="Shown on your launch page. Say what the token is for — the covenant will say why it can be trusted.">
              <textarea className={`${inputClass} min-h-24 resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this token do?" maxLength={280} />
            </Field>
          </div>
        )}

        {/* ── Step 2: tokenomics ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-xl font-medium text-cream">Tokenomics</h2>
              <p className="mt-1 text-sm text-fog">
                The team slice is what your guardian will vest; public &amp; LP is what it will lock.
              </p>
            </div>
            <Field label="Total supply">
              <input className={inputClass} type="number" min="1" value={supply} onChange={(e) => setSupply(e.target.value)} />
            </Field>
            <div className="flex flex-col gap-4">
              <AllocationSlider label="Public & LP" value={alloc.publicLp} onChange={(v) => setAlloc({ ...alloc, publicLp: v })} />
              <AllocationSlider label="Team (vested)" value={alloc.team} onChange={(v) => setAlloc({ ...alloc, team: v })} />
              <AllocationSlider label="Treasury" value={alloc.treasury} onChange={(v) => setAlloc({ ...alloc, treasury: v })} />
              <AllocationSlider label="Community" value={alloc.community} onChange={(v) => setAlloc({ ...alloc, community: v })} />
            </div>
            <div className={`rounded-lg border px-4 py-3 text-sm ${allocTotal === 100 ? 'border-status-good/30 text-status-good' : 'border-status-warn/40 text-status-warn'}`}>
              Total allocated: {allocTotal}% {allocTotal === 100 ? '— balanced' : '— must equal 100%'}
            </div>
            <div className="rounded-lg border border-linefaint bg-ink/60 p-5">
              <AllocationDonut allocations={allocations} size={180} />
            </div>
          </div>
        )}

        {/* ── Step 3: guardian terms ─────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col gap-7">
            <div>
              <h2 className="font-display text-xl font-medium text-cream">Guardian terms</h2>
              <p className="mt-1 text-sm text-fog">
                Everything below becomes physics at deployment. Choose like you mean it.
              </p>
            </div>

            <Field
              label={`LP lock duration — ${lpLockDays} days`}
              hint={`≈ ${fmtBlock(daysToBlocks(lpLockDays))} blocks. The guardian holds 100% of LP until block ${fmtBlock(CURRENT_BLOCK + daysToBlocks(lpLockDays))}.`}
            >
              <input
                type="range"
                min="30"
                max="730"
                step="5"
                value={lpLockDays}
                onChange={(e) => setLpLockDays(parseInt(e.target.value, 10))}
                className="w-full accent-[#F2601F]"
              />
              <div className="mt-1 flex justify-between text-[11px] text-faint">
                <span>30 days</span><span>1 year</span><span>2 years</span>
              </div>
            </Field>

            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-faint">
                Vesting schedule — team allocation ({alloc.team}% of supply)
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <Field label="Cliff (days)">
                  <input className={inputClass} type="number" min="0" max="730" value={vest.cliffDays} onChange={(e) => setVest({ ...vest, cliffDays: Math.max(0, parseInt(e.target.value || '0', 10)) })} />
                </Field>
                <Field label="Tranches">
                  <input className={inputClass} type="number" min="1" max="24" value={vest.tranches} onChange={(e) => setVest({ ...vest, tranches: Math.min(24, Math.max(1, parseInt(e.target.value || '1', 10))) })} />
                </Field>
                <Field label="Interval (days)">
                  <input className={inputClass} type="number" min="1" max="365" value={vest.intervalDays} onChange={(e) => setVest({ ...vest, intervalDays: Math.max(1, parseInt(e.target.value || '1', 10)) })} />
                </Field>
              </div>
              <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-linefaint bg-ink/60 px-4 py-2">
                {tranchePreview.map((t) => (
                  <div key={t.label} className="flex items-baseline justify-between border-b border-linefaint py-2 text-sm last:border-0">
                    <span className="text-fog">{t.label} — {t.pct.toFixed(2)}%</span>
                    <span className="mono text-faint">day {t.days} · block {fmtBlock(t.atBlock)}</span>
                  </div>
                ))}
              </div>
            </div>

            <Field
              label={`Dev wallet sell-limit — ${devCapPct}% per 30 days`}
              hint="The guardian freezes any transfer that would push your wallet past this in a rolling 30-day window."
            >
              <input type="range" min="0" max="10" value={devCapPct} onChange={(e) => setDevCapPct(parseInt(e.target.value, 10))} className="w-full accent-[#F2601F]" />
              <div className="mt-1 flex justify-between text-[11px] text-faint">
                <span>0% (hard lock)</span><span>10%</span>
              </div>
            </Field>

            <Field label="Monitoring frequency" hint="How often the guardian wakes via the native Scheduler to audit insider wallets.">
              <select className={inputClass} value={monitorBlocks} onChange={(e) => setMonitorBlocks(parseInt(e.target.value, 10))}>
                {MONITOR_OPTIONS.map((o) => (
                  <option key={o.blocks} value={o.blocks}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {/* ── Step 4: review & deploy ────────────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-xl font-medium text-cream">The Covenant of {displayName}</h2>
              <p className="mt-1 text-sm text-fog">
                This is the exact set of obligations your guardian will enforce. Read it as your holders will.
              </p>
            </div>

            <div className="rounded-lg border border-ember/25 bg-ink/70 p-6" style={{ background: 'linear-gradient(170deg, rgba(242,96,31,0.06), rgba(10,10,12,0.6) 40%)' }}>
              <div className="flex items-center gap-2.5">
                <FlameMark size={20} />
                <span className="kicker !text-gold">Covenant summary</span>
              </div>
              <ol className="mt-5 flex flex-col gap-4 text-sm leading-relaxed text-cream">
                <li>
                  <strong className="font-semibold">Custody.</strong> A sovereign guardian will generate its own keys via
                  DKMS inside a TEE and take custody of {alloc.publicLp}% of supply as locked liquidity and{' '}
                  {alloc.team}% as the vested team allocation. No human — including you — will hold these keys.
                </li>
                <li>
                  <strong className="font-semibold">Liquidity.</strong> LP remains locked for {lpLockDays} days, until
                  block {fmtBlock(CURRENT_BLOCK + daysToBlocks(lpLockDays))}. There is no early-unlock path.
                </li>
                <li>
                  <strong className="font-semibold">Vesting.</strong> The team allocation releases in {vest.tranches} equal
                  tranches of {(alloc.team / vest.tranches).toFixed(2)}% each, beginning after a {vest.cliffDays}-day
                  cliff and continuing every {vest.intervalDays} days. Releases execute via the guardian's own
                  Scheduler wake-ups.
                </li>
                <li>
                  <strong className="font-semibold">Sell limit.</strong> Your wallet may sell at most {devCapPct}% of its
                  holdings in any rolling 30-day window. Transfers beyond the cap are frozen automatically and the
                  freeze is attested on-chain.
                </li>
                <li>
                  <strong className="font-semibold">Surveillance.</strong> Insider wallets are audited every{' '}
                  {fmtBlock(monitorBlocks)} blocks. Every audit, release, and enforcement action publishes a TEE
                  attestation anyone can verify.
                </li>
                <li>
                  <strong className="font-semibold">Permanence.</strong> These terms cannot be amended, paused, or
                  overridden after deployment. If the guardian crashes, Ritual Chain revives it from checkpoint with
                  this covenant intact.
                </li>
              </ol>
            </div>

            <label className="flex items-start gap-3 text-sm text-fog">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#F2601F]"
              />
              I understand these terms are permanent and will be enforced by an agent that does not answer to me.
            </label>

            <Field label={`Sign by typing your token symbol — ${sym || '—'}`}>
              <input
                className={`${inputClass} font-display text-lg tracking-widest`}
                value={signature}
                onChange={(e) => setSignature(e.target.value.toUpperCase())}
                placeholder={sym}
                aria-label="Type your token symbol to sign the covenant"
              />
            </Field>

            {wallet.onRitual ? (
              <button type="button" className="btn-ember w-full" disabled={!canNext} onClick={() => setDeployed(true)}>
                Deploy covenant to {RITUAL_TESTNET.name}
              </button>
            ) : wallet.connected ? (
              <button type="button" className="btn-ember w-full" onClick={wallet.switchToRitual}>
                Switch wallet to {RITUAL_TESTNET.name}
              </button>
            ) : (
              <button
                type="button"
                className="btn-ember w-full disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canNext || wallet.status === 'connecting'}
                onClick={wallet.connect}
              >
                {wallet.status === 'connecting' ? 'Connecting…' : 'Connect wallet to deploy'}
              </button>
            )}
            {wallet.error && <p className="text-xs leading-relaxed text-status-warn">{wallet.error}</p>}
            <p className="text-xs leading-relaxed text-faint">
              {wallet.connected ? (
                <>Connected as <span className="mono text-fog">{shortAddr(wallet.address)}</span>. </>
              ) : null}
              Deployment is a dry run for now — the factory write lands next; connection and network state are
              live against the constants in <span className="mono">src/config/ritual.js</span>.
            </p>
          </div>
        )}
      </Card>

      {/* Wizard nav */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="btn-ghost disabled:invisible"
        >
          Back
        </button>
        <div className="px-4 text-right text-xs text-faint">{!canNext && stepErrors[step]}</div>
        {step < 3 && (
          <button
            type="button"
            onClick={() => canNext && setStep(step + 1)}
            disabled={!canNext}
            className="btn-ember disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

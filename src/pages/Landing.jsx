import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';
import StatBlock from '../components/StatBlock.jsx';
import Accordion from '../components/Accordion.jsx';
import FlameMark from '../components/FlameMark.jsx';
import { GUARDIAN_NETWORK, RUG_STATS, HOW_STEPS, COMPARISON_ROWS, FAQ_ITEMS } from '../data/site.js';
import { fmtBlock, fmtUsd } from '../data/launches.js';

function HeroBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* ember glow — the eternal flame */}
      <div
        className="absolute left-1/2 top-[62%] h-[520px] w-[720px] -translate-x-1/2 animate-drift rounded-full opacity-60 blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(242,96,31,0.28) 0%, rgba(255,179,71,0.10) 40%, transparent 70%)',
        }}
      />
      <div
        className="absolute left-1/2 top-[68%] h-[260px] w-[300px] -translate-x-1/2 animate-flicker rounded-full blur-2xl"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,179,71,0.22) 0%, transparent 65%)',
        }}
      />
      {/* guardian ring — slow, ceremonial */}
      <svg
        className="absolute left-1/2 top-[64%] -translate-x-1/2 -translate-y-1/2 animate-spin-slow"
        width="640"
        height="640"
        viewBox="0 0 640 640"
        fill="none"
      >
        <circle cx="320" cy="320" r="290" stroke="rgba(242,96,31,0.14)" strokeWidth="1" strokeDasharray="2 14" />
        <circle cx="320" cy="320" r="230" stroke="rgba(255,179,71,0.10)" strokeWidth="1" strokeDasharray="1 10" />
      </svg>
      {/* vignette back to ink */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 30%, #0A0A0C 85%)' }} />
    </div>
  );
}

function SectionHeading({ kicker, title, lead }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="kicker">{kicker}</div>
      <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-cream md:text-4xl">{title}</h2>
      {lead && <p className="mt-4 text-base leading-relaxed text-fog">{lead}</p>}
    </div>
  );
}

export default function Landing() {
  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <HeroBackground />
        <div className="relative mx-auto max-w-4xl px-5 pb-28 pt-24 text-center md:pb-36 md:pt-32">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-xs font-medium text-fog backdrop-blur">
            <FlameMark size={14} />
            Live on Ritual Chain testnet
          </div>
          <h1
            className="animate-fade-up mt-7 font-display text-5xl font-medium leading-[1.05] tracking-tight text-cream md:text-7xl"
            style={{ animationDelay: '80ms' }}
          >
            Launch terms are <em className="text-ember-gradient not-italic">physics</em>,
            <br className="hidden sm:block" /> not promises.
          </h1>
          <p
            className="animate-fade-up mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-fog"
            style={{ animationDelay: '160ms' }}
          >
            Vestal hands every token launch to a sovereign AI guardian on Ritual Chain — an agent that
            holds the keys, enforces the vesting, and cannot be shut down. Not by the creator. Not by us.
            Not by anyone.
          </p>
          <div
            className="animate-fade-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '240ms' }}
          >
            <Link to="/launch" className="btn-ember w-full sm:w-auto">Launch a Token</Link>
            <Link to="/explore" className="btn-ghost w-full sm:w-auto">Explore Launches</Link>
          </div>
        </div>
      </section>

      {/* ── Guardian status strip ────────────────────────────────────── */}
      <section className="border-y border-linefaint bg-surface/50">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            <StatBlock label="Value under guardianship" value={fmtUsd(GUARDIAN_NETWORK.guardedUsd)} accent />
            <StatBlock label="Active guardians" value={GUARDIAN_NETWORK.activeGuardians} />
            <StatBlock label="Heartbeats · last 24h" value={GUARDIAN_NETWORK.heartbeats24h.toLocaleString('en-US')} />
            <StatBlock label="Enforcement actions" value={GUARDIAN_NETWORK.enforcementActions.toLocaleString('en-US')} />
          </div>
          <p className="mt-6 text-xs text-faint">
            Illustrative testnet figures as of block {fmtBlock(GUARDIAN_NETWORK.asOfBlock)} — live chain reads replace
            these at integration.
          </p>
        </div>
      </section>

      {/* ── The rug problem ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <SectionHeading
          kicker="The problem"
          title="Every rug pull was a promise someone chose to break"
          lead="LP locks, vesting cliffs, dev-wallet limits — on today's launchpads these are policies enforced by the same humans who profit from breaking them. The track record speaks for itself."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {RUG_STATS.map((s) => (
            <Card key={s.label} className="p-7">
              <div className="font-display text-4xl font-medium text-ember-gradient">{s.value}</div>
              <p className="mt-3 text-sm leading-relaxed text-cream">{s.label}</p>
              <p className="mt-3 text-xs text-faint">{s.sub}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── How Vestal works ─────────────────────────────────────────── */}
      <section className="border-t border-linefaint bg-surface/30">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <SectionHeading
            kicker="How it works"
            title="Four steps, and the humans are out of the loop"
            lead="Each step leans on a primitive Ritual Chain provides at the protocol level — nothing here is a bot we run or a promise we make."
          />
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {HOW_STEPS.map((step, i) => (
              <Card key={step.n} lift className="relative p-7">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-display text-3xl font-light text-faint">{step.n}</span>
                  <span className="mt-1 max-w-[60%] rounded-full border border-ember/25 bg-ember/10 px-2.5 py-1 text-right text-[10px] font-semibold uppercase leading-relaxed tracking-widest text-gold">
                    {step.primitive}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-xl font-medium text-cream">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-fog">{step.body}</p>
                {i < HOW_STEPS.length - 1 && (
                  <div aria-hidden="true" className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-faint lg:block">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why only on Ritual ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <SectionHeading
          kicker="Why Ritual"
          title="This is only possible on Ritual Chain"
          lead="Take away consensus-level revival, native scheduling, or DKMS and you're back to trusting a team. Here is the honest comparison."
        />
        <div className="mt-12 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] border-collapse bg-surface text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-faint">Guarantee</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-faint">Traditional launchpad</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gold">
                  <span className="inline-flex items-center gap-2"><FlameMark size={14} /> Vestal on Ritual</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.dimension} className="border-b border-linefaint last:border-0">
                  <td className="px-6 py-4 align-top font-medium text-cream">{row.dimension}</td>
                  <td className="px-6 py-4 align-top leading-relaxed text-faint">{row.traditional}</td>
                  <td className="px-6 py-4 align-top leading-relaxed text-fog">
                    <span className="mr-2 inline-block text-status-good" aria-hidden="true">✓</span>
                    {row.vestal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="border-t border-linefaint bg-surface/30">
        <div className="mx-auto max-w-3xl px-5 py-24">
          <SectionHeading
            kicker="Questions"
            title="The questions a skeptic should ask"
            lead="If an answer here ever stops being true, the protocol is broken — that is the standard we hold the design to."
          />
          <div className="mt-12">
            <Accordion items={FAQ_ITEMS} />
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-linefaint">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 120%, rgba(242,96,31,0.14) 0%, transparent 60%)' }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center">
          <FlameMark size={40} ring className="mx-auto text-gold" />
          <h2 className="mt-6 font-display text-3xl font-medium tracking-tight text-cream md:text-4xl">
            Give your launch a guardian that outlives you.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-fog">
            Five minutes to commit your covenant. Enforced for as long as the chain produces blocks.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/launch" className="btn-ember">Launch a Token</Link>
            <Link to="/docs" className="btn-ghost">Read the docs</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

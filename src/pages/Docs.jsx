import Card from '../components/Card.jsx';
import { PRECOMPILES, RITUAL_TESTNET } from '../config/ritual.js';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'lifecycle', label: 'Guardian lifecycle' },
  { id: 'dev-faq', label: 'Developer FAQ' },
  { id: 'roadmap', label: 'Roadmap' },
];

function ArchitectureDiagram() {
  const box = 'fill-[#1A1A21] stroke-[#26262F]';
  const label = { fill: '#F2EDE3', fontSize: 12, fontWeight: 600 };
  const sub = { fill: '#9A948A', fontSize: 9.5 };
  const arrow = { stroke: '#6B665E', strokeWidth: 1.2, markerEnd: 'url(#arr)' };
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 680 330" className="min-w-[640px]" role="img" aria-label="Vestal architecture: creator commits a covenant to Vestal contracts; a sovereign agent in a TEE enforces it using the Scheduler, DKMS, and heartbeat revival; all actions settle on Ritual Chain.">
        <defs>
          <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 8 4 0 8z" fill="#6B665E" />
          </marker>
        </defs>

        {/* Creator */}
        <rect x="20" y="60" width="130" height="64" rx="10" className={box} />
        <text x="85" y="88" textAnchor="middle" style={label}>Creator</text>
        <text x="85" y="105" textAnchor="middle" style={sub}>signs the covenant</text>

        {/* Vestal contracts */}
        <rect x="215" y="60" width="150" height="64" rx="10" className={box} />
        <text x="290" y="83" textAnchor="middle" style={label}>Vestal contracts</text>
        <text x="290" y="99" textAnchor="middle" style={sub}>launch factory ·</text>
        <text x="290" y="111" textAnchor="middle" style={sub}>covenant registry</text>

        {/* Sovereign agent */}
        <rect x="435" y="40" width="220" height="104" rx="10" fill="rgba(242,96,31,0.08)" stroke="#F2601F" strokeOpacity="0.45" />
        <text x="545" y="70" textAnchor="middle" style={{ ...label, fill: '#FFB347' }}>Sovereign Guardian</text>
        <text x="545" y="88" textAnchor="middle" style={sub}>runs inside a TEE · invoked via</text>
        <text x="545" y="101" textAnchor="middle" style={sub}>agent precompiles · holds custody</text>
        <text x="545" y="122" textAnchor="middle" style={{ ...sub, fill: '#F2EDE3' }}>keys via DKMS — never human-held</text>

        {/* Primitives row */}
        <rect x="230" y="210" width="130" height="58" rx="10" className={box} />
        <text x="295" y="233" textAnchor="middle" style={label}>Scheduler</text>
        <text x="295" y="249" textAnchor="middle" style={sub}>self-scheduled wake-ups,</text>
        <text x="295" y="260" textAnchor="middle" style={sub}>no keeper bots</text>

        <rect x="390" y="210" width="120" height="58" rx="10" className={box} />
        <text x="450" y="233" textAnchor="middle" style={label}>DKMS</text>
        <text x="450" y="249" textAnchor="middle" style={sub}>decentralized</text>
        <text x="450" y="260" textAnchor="middle" style={sub}>key management</text>

        <rect x="540" y="210" width="130" height="58" rx="10" className={box} />
        <text x="605" y="230" textAnchor="middle" style={label}>Heartbeat</text>
        <text x="605" y="246" textAnchor="middle" style={sub}>consensus revival</text>
        <text x="605" y="258" textAnchor="middle" style={sub}>from checkpoint</text>

        {/* Settlement strip */}
        <rect x="20" y="292" width="650" height="26" rx="8" fill="rgba(242,96,31,0.05)" stroke="#26262F" />
        <text x="345" y="309" textAnchor="middle" style={{ ...sub, fill: '#9A948A' }}>
          Ritual Chain — every guardian action settles on-chain with a TEE attestation
        </text>

        {/* Arrows */}
        <line x1="150" y1="92" x2="212" y2="92" {...arrow} />
        <line x1="365" y1="92" x2="432" y2="92" {...arrow} />
        <line x1="500" y1="144" x2="330" y2="208" {...arrow} />
        <line x1="520" y1="144" x2="465" y2="208" {...arrow} />
        <line x1="580" y1="144" x2="600" y2="208" {...arrow} />
        <line x1="345" y1="268" x2="345" y2="290" {...arrow} />
      </svg>
    </div>
  );
}

const LIFECYCLE = [
  { state: 'Committed', desc: 'The creator signs the covenant; terms are registered immutably on-chain.' },
  { state: 'Deployed', desc: 'The guardian agent is instantiated in a TEE via the sovereign-agent precompile.' },
  { state: 'Keyed', desc: 'DKMS generates the agent’s keys inside the enclave — no human ever holds them.' },
  { state: 'Custodied', desc: 'LP tokens and unvested supply transfer to the guardian’s address.' },
  { state: 'Active', desc: 'Steady state: heartbeats emitted, wake-ups registered with the native Scheduler.' },
  { state: 'Enforcing', desc: 'A wake-up found work: a vesting release to execute or a violation to freeze.' },
  { state: 'Failed', desc: 'The executor missed its heartbeat — crash, partition, or host loss.' },
  { state: 'Revived', desc: 'Consensus restores the agent from its last checkpoint, state and keys intact.' },
  { state: 'Fulfilled', desc: 'Every tranche released, every lock expired: the covenant is complete, its history permanent.' },
];

const DEV_FAQ = [
  {
    q: 'How do I read covenant state programmatically?',
    a: 'Covenants are registered on-chain; read them through the covenant registry (address in src/config/ritual.js once published). Every mock shape in src/data/launches.js mirrors the intended read model, so swapping mocks for viem calls is mechanical.',
  },
  {
    q: 'What exactly is attested?',
    a: 'Each guardian action — audit, release, freeze, checkpoint — carries a TEE attestation binding the action to the exact guardian build hash. Verify the attestation and you have verified both what ran and that it ran unmodified.',
  },
  {
    q: 'Which precompiles do guardians use?',
    a: `Guardians are invoked via the sovereign-agent precompile (${PRECOMPILES.SOVEREIGN_AGENT_0x080C.slice(0, 6)}…080C), persist state via the persistent-agent precompile (…0820), and can reach HTTP (…0801) and LLM inference (…0802) from inside the enclave. Recurring execution goes through the native Scheduler.`,
  },
  {
    q: 'Can I run my own guardian build?',
    a: 'Planned. The guardian template will be open source; custom builds will be flagged on launch pages with their distinct build hash so holders can see exactly which enforcement logic they are trusting.',
  },
  {
    q: 'What chain config do I point a wallet at?',
    a: `Ritual Chain testnet — see RITUAL_TESTNET in src/config/ritual.js (rpcUrl, chainId, explorer). Values there are placeholders until the public endpoints are pinned; nothing else in the app hardcodes chain details.`,
  },
];

const ROADMAP = [
  { phase: 'Now — Testnet', items: ['Full launch flow on Ritual Chain testnet', 'Guardian enforcement: LP lock, vesting, dev-wallet caps', 'Attestation links on every enforcement action'] },
  { phase: 'Next', items: ['Open-source guardian template + reproducible builds', 'Wallet integration (viem/wagmi) replacing all mocks', 'Public attestation verifier page'] },
  { phase: 'Later', items: ['Third-party guardian builds with on-page build hashes', 'Covenant templates for DAOs and long-horizon treasuries', 'Mainnet, following independent audits'] },
];

function DocSection({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-linefaint py-10 first:pt-0 last:border-0">
      <h2 className="font-display text-2xl font-medium tracking-tight text-cream">{title}</h2>
      <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-fog">{children}</div>
    </section>
  );
}

export default function Docs() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="kicker">Documentation</div>
          <nav className="mt-4 flex flex-row flex-wrap gap-1 lg:flex-col" aria-label="Docs sections">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-md px-3 py-2 text-sm text-fog transition-colors hover:bg-raise hover:text-cream"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0 max-w-3xl">
          <DocSection id="overview" title="Overview">
            <p>
              Vestal is a token launchpad on Ritual Chain where launch rules are enforced by sovereign AI
              agents rather than by the team that made them. When a creator launches through Vestal, they
              commit a <strong className="text-cream">covenant</strong> — LP lock duration, vesting schedule,
              dev-wallet sell limits, monitoring cadence — and custody of the corresponding assets passes to
              a guardian agent that no one controls.
            </p>
            <p>
              The design goal is simple to state and brutal to achieve: <em>no promise on a Vestal launch
              page should depend on any human staying honest, solvent, or alive.</em> Ritual Chain is the
              only environment we know of that provides all four primitives this requires at the protocol
              level: agents that run inside TEEs and are invoked via precompiles, decentralized key
              management (DKMS), a native Scheduler for self-directed recurring execution, and
              consensus-level heartbeat monitoring with automatic revival from checkpoints.
            </p>
            <p>
              Vestal currently runs on {RITUAL_TESTNET.name}. All figures in the app are illustrative
              testnet data and labeled as such.
            </p>
          </DocSection>

          <DocSection id="architecture" title="Architecture">
            <p>
              A launch touches three layers. The creator interacts once, at commitment. The contracts
              record the covenant. The guardian does everything else, forever.
            </p>
            <Card className="p-5">
              <ArchitectureDiagram />
            </Card>
            <p>
              The guardian is a persistent sovereign agent: it registers wake-ups with the{' '}
              <strong className="text-cream">native Scheduler</strong>, so its recurring execution is
              included by the block proposer itself — there are no keeper bots or off-chain cron jobs to
              bribe, break, or abandon. Its keys exist only via{' '}
              <strong className="text-cream">DKMS</strong> inside the TEE. And because Ritual Chain
              monitors persistent agents at the consensus level, a crashed guardian is{' '}
              <strong className="text-cream">revived from its last checkpoint by the chain itself</strong>,
              with covenant state and keys intact.
            </p>
            <p className="rounded-lg border border-linefaint bg-surface px-4 py-3 mono text-xs text-fog">
              Precompiles: SOVEREIGN_AGENT …080C · PERSISTENT_AGENT …0820 · HTTP …0801 · LLM …0802 ·
              SCHEDULER (address pending) — full constants in src/config/ritual.js
            </p>
          </DocSection>

          <DocSection id="lifecycle" title="Guardian lifecycle">
            <p>
              Nine states, from commitment to fulfillment. The unusual ones — Failed and Revived — are the
              point: failure is an anticipated state with a protocol-level recovery path, not an outage.
            </p>
            <ol className="mt-2 flex flex-col">
              {LIFECYCLE.map((s, i) => (
                <li key={s.state} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < LIFECYCLE.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[13px] top-7 h-full w-px bg-linefaint" />
                  )}
                  <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                    s.state === 'Failed' ? 'border-status-warn/50 text-status-warn'
                    : s.state === 'Revived' ? 'border-status-info/50 text-status-info'
                    : 'border-ember/40 bg-ember/5 text-gold'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="pt-1">
                    <span className="text-sm font-semibold text-cream">{s.state}</span>
                    <p className="mt-0.5 text-sm text-fog">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </DocSection>

          <DocSection id="dev-faq" title="Developer FAQ">
            <dl className="flex flex-col gap-5">
              {DEV_FAQ.map((f) => (
                <div key={f.q}>
                  <dt className="text-sm font-semibold text-cream">{f.q}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-fog">{f.a}</dd>
                </div>
              ))}
            </dl>
          </DocSection>

          <DocSection id="roadmap" title="Roadmap">
            <div className="grid gap-4 sm:grid-cols-3">
              {ROADMAP.map((r) => (
                <Card key={r.phase} className="p-5">
                  <div className="kicker !text-gold">{r.phase}</div>
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {r.items.map((item) => (
                      <li key={item} className="flex gap-2 text-sm text-fog">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ember" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
            <p className="text-xs text-faint">
              Roadmap describes intent, not commitment — dates are deliberately absent until audits are scheduled.
            </p>
          </DocSection>
        </div>
      </div>
    </div>
  );
}

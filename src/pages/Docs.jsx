import Card from '../components/Card.jsx';
import { PRECOMPILES, RITUAL_TESTNET, VESTAL_CONTRACTS, EXPLORER_URL } from '../config/ritual.js';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'launch-flow', label: 'Launch, step by step' },
  { id: 'enforcement', label: 'What is enforced' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'market', label: 'Market' },
  { id: 'lifecycle', label: 'Guardian lifecycle' },
  { id: 'dev-faq', label: 'Developer FAQ' },
  { id: 'roadmap', label: 'Roadmap' },
];

function ArchitectureDiagram() {
  const box = 'fill-raise stroke-line';
  const label = { fill: 'var(--color-cream)', fontSize: 12, fontWeight: 600 };
  const sub = { fill: 'var(--color-fog)', fontSize: 9.5 };
  const arrow = { stroke: 'var(--color-faint)', strokeWidth: 1.2, markerEnd: 'url(#arr)' };
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 680 330" className="min-w-[640px]" role="img" aria-label="Vestal architecture: creator commits a covenant to Vestal contracts; a sovereign agent in a TEE enforces it using the Scheduler, DKMS, and heartbeat revival; all actions settle on Ritual Chain.">
        <defs>
          <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 8 4 0 8z" fill="var(--color-faint)" />
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
        <rect x="435" y="40" width="220" height="104" rx="10" fill="rgba(242,96,31,0.08)" stroke="var(--color-ember)" strokeOpacity="0.45" />
        <text x="545" y="70" textAnchor="middle" style={{ ...label, fill: 'var(--color-gold)' }}>Sovereign Guardian</text>
        <text x="545" y="88" textAnchor="middle" style={sub}>runs inside a TEE · invoked via</text>
        <text x="545" y="101" textAnchor="middle" style={sub}>agent precompiles · holds custody</text>
        <text x="545" y="122" textAnchor="middle" style={{ ...sub, fill: 'var(--color-cream)' }}>keys via DKMS — never human-held</text>

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
        <rect x="20" y="292" width="650" height="26" rx="8" fill="rgba(242,96,31,0.05)" stroke="var(--color-line)" />
        <text x="345" y="309" textAnchor="middle" style={sub}>
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

/** The seven atomic actions inside VestalLaunchFactory.createLaunch. */
const LAUNCH_STEPS = [
  { title: 'Mint', desc: 'The fixed supply is minted once, into the factory. No further minting is possible — the token has no mint function after construction.' },
  { title: 'Fund the creator', desc: 'The creator receives their unvested share before the covenant starts watching, so the sell-cap window bases on real holdings.' },
  { title: 'Deploy the covenant', desc: 'A fresh GuardianCovenant is deployed with the committed terms and tranches; the creator’s wallet is under audit from block one.' },
  { title: 'Custody the vesting', desc: 'The entire vesting allocation transfers into covenant custody. Only the guardian can release it, and never early.' },
  { title: 'Bind the transfer hook', desc: 'The covenant is bound into the token’s transfer path — one-shot, factory-only, irreversible. Every future transfer is checked.' },
  { title: 'Provision the guardian', desc: 'The sovereign agent is provisioned, committed to the covenant’s termsHash — a keccak256 of the exact terms anyone can re-derive — and bound as guardian.' },
  { title: 'Register', desc: 'The launch is appended to the CovenantRegistry. After this, the factory has no remaining authority — and never had a key that could override the covenant.' },
];

const ENFORCED = [
  {
    what: 'Vesting',
    how: 'Tranches sit in covenant custody; only the guardian can release them, never before the committed block. If a tranche goes unclaimed ~7 days past due, anyone may execute it — to the committed recipient only. Funds can be neither rushed nor stranded, even if Vestal and Ritual both vanish.',
  },
  {
    what: 'Dev-wallet sell cap',
    how: 'The creator’s wallet (plus any insider wallet the guardian tracks) can sell at most the committed share of its holdings per rolling window. Exceeding it reverts at the token level — the trade simply cannot execute.',
  },
  {
    what: 'Freeze',
    how: 'The guardian can freeze a wallet that violated committed terms; all its outgoing transfers revert until unfrozen. Selling into the pool is a transfer, so frozen wallets cannot sell.',
  },
  {
    what: 'LP lock',
    how: 'The creator deposits LP shares into covenant custody via lockLp(); withdrawal reverts before the committed unlock block — not one block sooner. “LP locked” is literal custody, not a promise.',
  },
  {
    what: 'Terms immutability',
    how: 'Terms are hashed into termsHash at launch. No setter exists for terms, the covenant binding, or the guardian binding. There are no admin keys anywhere in the system.',
  },
  {
    what: 'Attested log',
    how: 'Every guardian action — wake, audit, release, flag, freeze, checkpoint, revival — emits an EnforcementAction event carrying a TEE attestation hash. The Enforcement Log on every token page is a straight read of this stream.',
  },
];

const CONTRACTS = [
  { name: 'VestalToken', role: 'Fixed-supply ERC20 whose every transfer is checked by its covenant. No admin, no upgrade path, no way to detach the covenant.' },
  { name: 'GuardianCovenant', role: 'One per launch. Custodies vesting and LP, enforces freeze and sell caps in the transfer hook, and writes the attested enforcement log.' },
  { name: 'VestalLaunchFactory', role: 'Turns the wizard’s covenant summary into an enforced reality in one transaction (the seven steps above).' },
  { name: 'CovenantRegistry', role: 'Append-only, factory-only index of every launch. Explore enumerates it; token pages resolve through it.' },
  { name: 'LaunchPool', role: 'Native-paired constant-product AMM with 0.3% fee and ERC20 LP shares. No owner, no fee switch, no pause.' },
  { name: 'VestalPoolFactory', role: 'Permissionless one-pool-per-token registry — token → market resolution in a single read.' },
  { name: 'IRitual + providers', role: 'The precompile boundary: assumed Ritual ABIs isolated in two files, with a mock provider so the full flow runs where the precompiles haven’t shipped.' },
];

const DEPLOYED = [
  { name: 'CovenantRegistry', addr: VESTAL_CONTRACTS.COVENANT_REGISTRY },
  { name: 'VestalLaunchFactory', addr: VESTAL_CONTRACTS.LAUNCH_FACTORY },
  { name: 'VestalPoolFactory', addr: VESTAL_CONTRACTS.POOL_FACTORY },
];

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
    a: `Enumerate launches with CovenantRegistry.allLaunches() (${VESTAL_CONTRACTS.COVENANT_REGISTRY.slice(0, 10)}…), then read each covenant directly: terms(), vesting(), guardianSummary(), and the EnforcementAction event stream. src/chain/launches.js in the repo is a complete viem reference implementation, and src/data/launches.js documents the mapped shapes.`,
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
    a: `${RITUAL_TESTNET.name}: chain id ${RITUAL_TESTNET.chainId}, RPC ${RITUAL_TESTNET.rpcUrl}, native currency ${RITUAL_TESTNET.nativeCurrency.symbol}. The app can add and switch to the network for you when you connect — nothing outside src/config/ritual.js hardcodes chain details.`,
  },
  {
    q: 'Is the guardian a real TEE agent today?',
    a: 'Not yet — the agent precompile slots have no code on the current testnet, so launches use a mock provider (guardian = deployer EOA). The covenant’s structural guarantees — vesting custody, sell caps, freezes, LP lock, the permissionless failsafe — hold regardless; TEE-backed liveness and attestations arrive when the precompiles ship, with no changes above the provider boundary.',
  },
];

const ROADMAP = [
  { phase: 'Now — Testnet', items: ['Full launch flow live on Ritual Chain testnet: wizard → createLaunch → registry', 'Covenant enforcement on-chain: LP lock, vesting + failsafe, sell caps, freezes', 'Native-paired AMM with covenant-locked LP shares and on-chain price history'] },
  { phase: 'Next', items: ['Swap the mock provider for TEE guardians when the agent precompiles ship', 'Open-source guardian template + reproducible builds', 'Public attestation verifier page'] },
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
              Vestal runs live on {RITUAL_TESTNET.name} (chain id {RITUAL_TESTNET.chainId}). Every
              launch, guardian status, enforcement log entry, and market figure in the app is read
              directly from deployed contracts — there are no mocks in the data path. Launching and
              trading are real transactions signed by your connected wallet.
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

          <DocSection id="launch-flow" title="Launch, step by step">
            <p>
              The Launch Wizard collects four screens of intent — token basics, tokenomics, guardian
              terms, review &amp; sign — and compresses them into a single{' '}
              <span className="mono text-xs text-cream">createLaunch</span> transaction. Days become
              blocks, percents become basis points, and the team allocation splits into equal vesting
              tranches. Inside that one transaction, the factory performs seven actions atomically:
            </p>
            <ol className="mt-2 flex flex-col">
              {LAUNCH_STEPS.map((s, i) => (
                <li key={s.title} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < LAUNCH_STEPS.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[13px] top-7 h-full w-px bg-linefaint" />
                  )}
                  <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ember/40 bg-ember/5 text-[11px] font-semibold text-gold">
                    {i + 1}
                  </span>
                  <div className="pt-1">
                    <span className="text-sm font-semibold text-cream">{s.title}</span>
                    <p className="mt-0.5 text-sm text-fog">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p>
              The frontend simulates the call before prompting the wallet, so a covenant that would
              revert — LP lock in the past, allocations that don’t sum, a 100%-vested supply — fails
              with a readable error before anything is signed. On success, the app decodes the{' '}
              <span className="mono text-xs text-cream">LaunchCreated</span> event from the receipt
              and routes straight to the new token page, already live.
            </p>
          </DocSection>

          <DocSection id="enforcement" title="What is actually enforced">
            <p>
              “Unruggable” is a checklist, not a vibe. Each guarantee below is a revert in the token’s
              transfer path or a custody rule in the covenant — enforcement is what the code{' '}
              <em>cannot</em> do, not what a team promises not to.
            </p>
            <dl className="flex flex-col gap-4">
              {ENFORCED.map((e) => (
                <div key={e.what}>
                  <dt className="text-sm font-semibold text-cream">{e.what}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-fog">{e.how}</dd>
                </div>
              ))}
            </dl>
          </DocSection>

          <DocSection id="contracts" title="Contracts">
            <p>
              Seven contracts, no admin keys. Full source and 28 Foundry tests live in the repo’s{' '}
              <span className="mono text-xs text-cream">contracts/</span> directory.
            </p>
            <div className="flex flex-col gap-3.5">
              {CONTRACTS.map((c) => (
                <div key={c.name}>
                  <span className="mono text-xs font-semibold text-cream">{c.name}</span>
                  <p className="mt-0.5 text-sm text-fog">{c.role}</p>
                </div>
              ))}
            </div>
            <Card className="p-5">
              <div className="kicker">Deployed on {RITUAL_TESTNET.name}</div>
              <dl className="mt-3 flex flex-col gap-2">
                {DEPLOYED.map((d) => (
                  <div key={d.name} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                    <dt className="text-sm text-fog">{d.name}</dt>
                    <dd>
                      <a
                        href={`${EXPLORER_URL}/address/${d.addr}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mono break-all text-xs text-gold hover:underline"
                      >
                        {d.addr}
                      </a>
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </DocSection>

          <DocSection id="market" title="Market">
            <p>
              Every launch can open a market: a minimal constant-product AMM (
              <span className="mono text-xs text-cream">LaunchPool</span>) pairing the token against
              the native coin, with a 0.3% fee that accrues to LP shares. The pool has no owner, no
              fee switch, and no pause — nothing in it is Vestal-privileged.
            </p>
            <p>
              Two properties tie the market into the covenant system. First,{' '}
              <strong className="text-cream">LP shares are themselves an ERC20</strong>: the creator
              seeds liquidity, then locks the shares into the launch’s covenant — “LP locked” on a
              token page is literal custody by the same contract that vests the team allocation.
              Second, <strong className="text-cream">selling into the pool is a token transfer</strong>,
              so the covenant’s sell cap and freeze checks run on every sell at the token level, with
              no extra wiring. The price chart on each token page is rebuilt from the pool’s on-chain{' '}
              <span className="mono text-xs text-cream">Swap</span> events.
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

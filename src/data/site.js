/**
 * Site-level editorial content (copy, FAQ, comparisons). Network-wide
 * figures are aggregated from live chain reads in the pages themselves
 * (see Landing.jsx over useLaunches) — no chain numbers live here.
 */

/** "The Rug Problem" stat cards. Figures are illustrative industry copy and labeled as such in the UI. */
export const RUG_STATS = [
  {
    value: '$2.8B+',
    label: 'drained by rug pulls and exit scams since 2021',
    sub: 'Illustrative industry estimate',
  },
  {
    value: '1 in 4',
    label: 'new tokens shows insider-dump behavior within 30 days of launch',
    sub: 'Illustrative — based on public launchpad analyses',
  },
  {
    value: '0',
    label: 'launchpads whose lock rules keep enforcing after the team disappears',
    sub: 'Until now',
  },
];

export const HOW_STEPS = [
  {
    n: '01',
    title: 'Commit the terms',
    primitive: 'Covenant',
    body: 'The creator writes the covenant: how long the LP is locked, how team tokens vest, how much the dev wallet may ever sell, how often insiders are audited. Once signed, it cannot be edited — by anyone.',
  },
  {
    n: '02',
    title: 'The guardian takes custody',
    primitive: 'DKMS · TEE',
    body: 'A sovereign agent is deployed for the launch. It generates its own keys through decentralized key management inside a TEE — the LP tokens and unvested supply move to an address whose keys no human has ever seen. Not the creator. Not Vestal.',
  },
  {
    n: '03',
    title: 'Enforcement runs on-chain',
    primitive: 'Native Scheduler',
    body: 'The guardian registers its own wake-ups with Ritual’s native Scheduler — recurring execution included by the block proposer itself. It releases vesting tranches on the committed blocks and audits insider wallets every N blocks. No keeper bots, no cron jobs, no ops team.',
  },
  {
    n: '04',
    title: 'It survives everyone',
    primitive: 'Heartbeat · Consensus revival',
    body: 'The chain watches the guardian at the consensus level. Miss a heartbeat and the network itself revives the agent from its last checkpoint, keys and covenant state intact. If Vestal-the-company vanished tomorrow, every launch would keep being enforced.',
  },
];

export const COMPARISON_ROWS = [
  {
    dimension: 'Who holds the LP lock',
    traditional: 'Team multisig, or a locker contract the team can often upgrade',
    vestal: 'A sovereign agent whose keys were generated via DKMS inside a TEE — no human holds them',
  },
  {
    dimension: 'What runs the vesting schedule',
    traditional: 'Keeper bots and cron jobs someone has to pay for and keep online',
    vestal: 'Ritual’s native Scheduler — the block proposer includes the guardian’s wake-ups',
  },
  {
    dimension: 'If the infrastructure crashes',
    traditional: 'Enforcement silently stops until a human notices',
    vestal: 'Consensus detects the missed heartbeat and revives the agent from checkpoint, state intact',
  },
  {
    dimension: 'If the company shuts down',
    traditional: 'Locks expire unmanaged; promises evaporate with the team',
    vestal: 'Guardians keep running on-chain — Vestal is not in the enforcement path',
  },
  {
    dimension: 'Can insiders bend the rules',
    traditional: 'Rules are policies; teams grant themselves exceptions',
    vestal: 'The covenant is immutable; violations are frozen and the freeze is TEE-attested',
  },
  {
    dimension: 'Proof of enforcement',
    traditional: 'A dashboard the team operates — trust their database',
    vestal: 'Every action settles on-chain with a TEE attestation anyone can verify',
  },
];

export const FAQ_ITEMS = [
  {
    q: 'What happens if Vestal shuts down?',
    a: 'Nothing changes for existing launches. Guardians are sovereign agents on Ritual Chain: they hold their own keys, schedule their own execution through the native Scheduler, and are revived by consensus if they crash. Vestal operates a website and publishes contract templates — we are not in the enforcement path, and we designed it that way on purpose.',
  },
  {
    q: 'Who holds the LP keys?',
    a: 'The guardian agent itself. Its keys are generated through DKMS — decentralized key management — inside a TEE, so the private key never exists in one piece outside the enclave. No creator, no Vestal employee, and no server ever sees it. There is nothing to steal from us and nothing we could hand over.',
  },
  {
    q: 'Can the agent be bribed, persuaded, or socially engineered?',
    a: 'No. The guardian does not negotiate: its enforcement logic and the covenant it enforces are fixed at deployment, and the exact code running is TEE-attested — you can verify the build hash on every action it takes. There is no admin function, no override key, and no customer-support channel into the enclave.',
  },
  {
    q: 'What happens if the agent crashes?',
    a: 'Ritual Chain watches every persistent agent at the consensus level. If a guardian misses its heartbeat, the chain revives it from its latest checkpoint with full state — keys, covenant, pending schedule. You can see this live: revivals are counted on every Guardian Panel, and one launch on the explore page is mid-revival right now.',
  },
  {
    q: 'Can a creator change the terms after launch?',
    a: 'No. The covenant is committed before the guardian takes custody and is immutable afterward. If a creator wants different terms, the only path is a new launch with a new covenant — the old guardian keeps enforcing the old terms until they complete.',
  },
  {
    q: 'How do I verify enforcement actually happened?',
    a: 'Every guardian action — a vesting release, a wallet audit, a freeze — executes inside a TEE and settles on-chain with an attestation. The Enforcement Log on each token page links each action to its attestation hash. You are not trusting a dashboard; you are reading the chain.',
  },
  {
    q: 'What can Vestal-the-company actually do?',
    a: 'We build the frontend, the launch contracts, and the guardian template. We cannot touch LP, accelerate vesting, pause a guardian, or grant exceptions — the keys are the agent’s and the covenant is immutable. Our only privileged position is reputational: curating what appears on this site.',
  },
  {
    q: 'Is this live on mainnet?',
    a: 'Not yet. Vestal runs on Ritual Chain testnet — every launch on this site is read live from the CovenantRegistry contract there. Launch mechanics, guardian behavior, and attestations work end-to-end on testnet today; mainnet follows audits.',
  },
];

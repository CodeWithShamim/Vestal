# Vestal — the unruggable token launchpad on Ritual Chain

> **Launch terms are physics, not promises.**

Vestal is a full-stack token launchpad where the rules of a launch — LP lock, team vesting,
dev-wallet sell caps, monitoring cadence — are not published policies but **on-chain physics**.
Every launch commits a *covenant* whose enforcement lives inside the token's own transfer path
and whose custody belongs to a **sovereign AI guardian** on Ritual Chain: an agent that runs in
a TEE, holds its keys via DKMS (no human ever has them), wakes itself through the chain's native
Scheduler, and is revived from checkpoint by consensus if it ever crashes. After launch, no one —
not the creator, not Vestal, not anyone — holds an admin key over any part of the system.

This repository contains the complete stack:

| Layer | Where | What |
|---|---|---|
| **Smart contracts** | [contracts/](contracts/) | Foundry project: token, covenant, factories, registry, AMM, guardian providers. See [contracts/README.md](contracts/README.md) for contract-level detail. |
| **Chain client layer** | [src/chain/](src/chain/) | viem reads/writes: registry enumeration, covenant state, enforcement log, market data, wallet connection, the `createLaunch` write. |
| **Frontend** | [src/](src/) | React 18 + Vite + Tailwind v4 app: landing, explore grid, token detail with Guardian Panel and live market, 4-step launch wizard, docs. |

**Live on Ritual Chain testnet** (chain id `1979`, ~5 blocks/s) — the app reads all launch,
guardian, and market state directly from deployed contracts. There are no mocks in the data path.

---

## Table of contents

- [How it works — the big picture](#how-it-works--the-big-picture)
- [Architecture, step by step](#architecture-step-by-step)
  - [Step 1 — The creator commits a covenant](#step-1--the-creator-commits-a-covenant)
  - [Step 2 — One transaction makes it real](#step-2--one-transaction-makes-it-real)
  - [Step 3 — Enforcement lives in the transfer path](#step-3--enforcement-lives-in-the-transfer-path)
  - [Step 4 — The guardian watches, forever](#step-4--the-guardian-watches-forever)
  - [Step 5 — The market trades under the same covenant](#step-5--the-market-trades-under-the-same-covenant)
  - [Step 6 — The frontend is a straight read of chain state](#step-6--the-frontend-is-a-straight-read-of-chain-state)
- [What is actually enforced](#what-is-actually-enforced)
- [Contract reference](#contract-reference)
- [Frontend reference](#frontend-reference)
- [Getting started](#getting-started)
- [Deployed addresses (Ritual Chain testnet)](#deployed-addresses-ritual-chain-testnet)
- [Configuration](#configuration)
- [Testing](#testing)
- [Ritual Chain quirks worth knowing](#ritual-chain-quirks-worth-knowing)
- [Trust model & current limitations](#trust-model--current-limitations)
- [Repository layout](#repository-layout)

---

## How it works — the big picture

```
                                    FRONTEND (React + viem)
   Landing · Explore · Token detail (Guardian Panel, price chart, buy widget) · Launch wizard · Docs
        │  reads: registry, covenant, events, pool          │  writes: createLaunch, buy
        ▼                                                   ▼
┌─────────────────────────────── RITUAL CHAIN TESTNET (id 1979) ───────────────────────────────┐
│                                                                                              │
│  Creator ──► VestalLaunchFactory ──► VestalToken (fixed supply, covenant hook)               │
│                     │                      │  every transfer checked by                      │
│                     │                      ▼                                                 │
│                     ├────────────► GuardianCovenant (custody: vesting + LP, enforcement log) │
│                     │                      ▲  onlyGuardian enforcement                       │
│                     │                      │                                                 │
│                     ├── IGuardianProvider ─┴─► sovereign agent (TEE, DKMS keys)              │
│                     │        ├ RitualGuardianProvider → 0x080C provision, 0x0820 heartbeat   │
│                     │        └ MockGuardianProvider  → local anvil / pre-precompile testnet  │
│                     │                                                                        │
│                     └────────────► CovenantRegistry (append-only launch index)               │
│                                                                                              │
│  VestalPoolFactory ──► LaunchPool (native-paired constant-product AMM, ERC20 LP shares)      │
│                              └── LP shares locked in the GuardianCovenant via lockLp()       │
│                                                                                              │
│  Ritual primitives: Scheduler (self-scheduled wake-ups) · DKMS (keys only in TEE) ·          │
│                     heartbeat monitoring + consensus revival from checkpoint                 │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

The design goal, stated once and pursued everywhere: **no promise on a Vestal launch page should
depend on any human staying honest, solvent, or alive.** Ritual Chain is used because it provides
the four primitives this requires at the protocol level — TEE-hosted agents invoked via
precompiles, decentralized key management (DKMS), a native Scheduler for self-directed recurring
execution, and consensus-level heartbeat monitoring with automatic revival from checkpoints.

---

## Architecture, step by step

### Step 1 — The creator commits a covenant

The [Launch wizard](src/pages/Launch.jsx) walks the creator through four steps:

1. **Token basics** — name, symbol, description.
2. **Tokenomics** — total supply and the allocation split (Public & LP / Team-vested /
   Treasury / Community), which must sum to exactly 100% with at least 1% team allocation
   (the guardian needs something to vest).
3. **Guardian terms** — LP lock duration (days), vesting schedule (cliff + number of tranches +
   interval), dev-wallet sell cap (% per rolling 30-day window), and monitoring cadence
   (every 150 / 300 / 1,200 blocks).
4. **Review & deploy** — the creator types the token symbol as a signature, acknowledges
   immutability, and signs one transaction.

[src/chain/factory.js](src/chain/factory.js) translates the wizard's human units into contract
units — days → blocks (at ~0.2 s/block), percents → basis points — builds equal vesting tranches
(rounding remainder on the last one so the total is exact), **simulates the call first** so
covenant reverts surface as readable errors before the wallet prompt, then submits
`createLaunch` and decodes the `LaunchCreated` event from the receipt for the real
token/covenant/guardian addresses.

### Step 2 — One transaction makes it real

[`VestalLaunchFactory.createLaunch`](contracts/src/VestalLaunchFactory.sol) performs seven
actions atomically — one launch is exactly one transaction:

1. **Mint** the fixed supply into the factory.
2. **Send the creator their unvested share** — before the covenant starts watching, so the
   sell-cap window bases on real holdings.
3. **Deploy the `GuardianCovenant`**, which immediately puts the creator's wallet under audit
   (tracked from block one).
4. **Move the entire vesting allocation** into covenant custody.
5. **Bind the covenant into the token's transfer path** (`VestalToken.bindCovenant`, one-shot,
   factory-only, irreversible).
6. **Provision the sovereign agent** via the `IGuardianProvider`, committed to the covenant's
   `termsHash` (a keccak256 of the exact terms + tranches — anyone can re-hash the public terms
   to verify what the agent enforces is what was committed), and bind it as guardian.
7. **Register the launch** in the `CovenantRegistry`.

After step 7 the factory has no remaining authority over the launch — and never had a key that
could override the covenant. The factory contract itself validates the terms up front: LP lock
must end in the future, sell window and monitor cadence must be non-zero, caps must be ≤ 100%,
and vesting must be more than 0% and less than 100% of supply.

### Step 3 — Enforcement lives in the transfer path

[`VestalToken`](contracts/src/VestalToken.sol) is a fixed-supply ERC20 with exactly one twist:
`_beforeTokenTransfer` calls [`GuardianCovenant.beforeTokenTransfer`](contracts/src/GuardianCovenant.sol)
on **every transfer** (except transfers *from* the covenant itself — those moves *are* the
enforcement, not its subject). Inside the hook:

- A **frozen** wallet's outgoing transfers revert (`WalletFrozen`).
- A **tracked** wallet (the creator from block one, plus any insider the guardian adds) is held
  to a rolling sell cap: at most `devWalletCapBps` of its holdings-at-window-start per
  `sellWindowBlocks` window. Exceeding it reverts (`SellCapExceeded`) with the remaining
  allowance in the error. The window re-bases on current holdings when it rolls forward.

There is no allow-list, no admin override, no pause switch. Enforcement is a revert, not a
policy — hence "physics."

### Step 4 — The guardian watches, forever

The guardian is a persistent sovereign agent. Its liveness is layered three deep:

1. **Self-scheduled wake-ups** — the covenant registers a recurring task with Ritual's native
   Scheduler precompile (`registerWithScheduler`), so recurring execution is included by the
   block proposer itself. No keeper bots or off-chain cron jobs to bribe, break, or abandon.
   On environments where the Scheduler slot has no code yet, registration is deferred and the
   agent self-schedules from inside the TEE.
2. **Consensus revival** — Ritual Chain monitors persistent agents at the consensus level. A
   guardian that misses heartbeats is restored from its last checkpoint by the chain itself,
   state and keys intact, and logs a `Revival` action when it comes back.
3. **Permissionless failsafe** — as the final, trustless backstop, any vesting tranche left
   unclaimed `FAILSAFE_GRACE_BLOCKS` (302,400 blocks, ~7 days) past its due block becomes
   executable by **anyone** — but only to the committed recipient, and never one block early.
   Even if Vestal and Ritual both vanished, funds can be neither rushed nor stranded.

Every guardian action — wake, audit result, release, flag, freeze, checkpoint, revival — emits
an `EnforcementAction(action, atBlock, attestation, detail)` event carrying the TEE attestation
hash that binds the action to the exact guardian build. This event stream **is** the enforcement
log the frontend shows; the Guardian Panel is a straight event read. The `ActionType` enum
matches the frontend's event union (`wake | release | check_ok | flag | freeze | checkpoint |
revival`) one-to-one.

The covenant also derives a guardian status on-chain exactly like the frontend badge:
**Enforcing** if any wallet is frozen, **Reviving** if heartbeats have gone quiet for more than
3 monitor intervals, otherwise **Active**.

**Provider boundary:** the published testnet ABIs for Ritual's agent precompiles are not final,
so every touchpoint is isolated in two files — [contracts/src/interfaces/IRitual.sol](contracts/src/interfaces/IRitual.sol)
(assumed ABIs + slot addresses) and [contracts/src/providers/RitualGuardianProvider.sol](contracts/src/providers/RitualGuardianProvider.sol).
[Deploy.s.sol](contracts/script/Deploy.s.sol) auto-detects: if precompile slot `0x080C` has code
it deploys the Ritual provider; otherwise it deploys [MockGuardianProvider](contracts/src/providers/MockGuardianProvider.sol)
(guardian = deployer EOA) so the full flow runs on anvil and today's testnet unchanged. ABI
changes never reach covenant/factory/token logic.

### Step 5 — The market trades under the same covenant

[`LaunchPool`](contracts/src/LaunchPool.sol) is a minimal constant-product AMM pairing the
launch token against the chain's native coin (tRITUAL), with a 0.3% fee accruing to LP shares.
It is deliberately unprivileged: **no owner, no fee switch, no pause**. Reserves are tracked
explicitly so stray donations can't skew pricing, and a reentrancy lock guards every mutation.

Two properties tie it into the covenant system:

- **LP shares are themselves an ERC20** — so the creator seeds liquidity, then deposits the
  shares into the launch's `GuardianCovenant` via `lockLp()`. "LP locked" on the token page is
  literal custody: the same contract that vests the team allocation holds the market's
  liquidity until `lpLockUntilBlock`, and `withdrawLp` reverts one block sooner.
- **Selling into the pool is a token transfer** out of the seller's wallet — so the covenant's
  sell cap and freeze checks bite on every sell, at the token level, with zero extra wiring.

[`VestalPoolFactory`](contracts/src/VestalPoolFactory.sol) is a permissionless one-pool-per-token
registry (`poolOf`), deployed separately from the launch factory so existing launches can get
markets without redeploying the protocol. Every trade emits `Swap` with the post-trade price
(native per token, 1e18-scaled) — the frontend price chart is a straight event read.

### Step 6 — The frontend is a straight read of chain state

Data flows one way, from a single config file to the pages:

```
src/config/ritual.js         chain constants: RPC, chain id, contracts, precompiles
        │
        ├── src/chain/wallet.js     injected EIP-1193 wallet as a useSyncExternalStore store;
        │                           connect / silent reconnect / switch-or-add Ritual Chain
        ├── src/chain/launches.js   registry enumeration → Launch objects (terms, vesting,
        │                           guardian summary, chunked EnforcementAction event history)
        ├── src/chain/market.js     poolOf → reserves, price, guarded liquidity, Swap history,
        │                           client-side buy quote, simulated-then-sent buy()
        └── src/chain/factory.js    the one deploy write: createLaunch
                │
                ├── src/data/useLaunches.js   module-level store: fetch once, share everywhere;
                │                             refreshLaunches() after a deploy
                └── src/data/useMarket.js     per-token market state; refresh() after a trade
                        │
                        └── src/pages/*      Landing · Explore · TokenDetail · Launch · Docs
```

Notable choices:

- **No state libraries, no storage** (beyond one localStorage reconnect flag) — wallet and
  launch state are plain external stores consumed via `useSyncExternalStore`.
- **Launch ids are token addresses**, so `/token/:id` routes are chain addresses.
- **Event fetches are chunked** (90k-block windows, max 10 chunks, newest first) because public
  RPCs cap `eth_getLogs` ranges; tranche released-state comes from contract storage, not logs,
  so older covenants only lose timeline depth, never correctness.
- **Writes simulate first** (`simulateContract`) so contract reverts surface as readable errors
  before the wallet prompt, and confirm the receipt before reporting success.
- **SSR-safe** — `window` is only touched inside handlers/effects, so every module loads under
  the smoke/prerender script.

---

## What is actually enforced

| Guarantee | Mechanism | Escape hatch? |
|---|---|---|
| **Vesting** | Tranches live in covenant custody; only the guardian can release, never before the committed block. | Permissionless failsafe after ~7 days past due — to the committed recipient only. |
| **Dev-wallet sell cap** | Token-level revert when a tracked wallet exceeds `devWalletCapBps` of holdings per rolling `sellWindowBlocks` window. | None. |
| **Freeze** | Guardian freezes a violating wallet; all outgoing transfers revert until unfrozen. | Only the guardian can unfreeze. |
| **LP lock** | LP shares held by the covenant; `withdrawLp` reverts before `lpLockUntilBlock`. | None — not one block sooner. |
| **Terms immutability** | `termsHash` committed at launch; no setter exists for terms, covenant binding, or guardian binding. | None — there are no admin keys anywhere. |
| **Auditability** | Every guardian action emits `EnforcementAction` with a TEE attestation hash. | Failsafe releases carry a zero attestation (no TEE needed). |

---

## Contract reference

| Contract | Role |
|---|---|
| [VestalToken.sol](contracts/src/VestalToken.sol) | Fixed-supply ERC20; covenant hook on every transfer; covenant bound once by the factory, no admin, no upgrade path. |
| [GuardianCovenant.sol](contracts/src/GuardianCovenant.sol) | One per launch. Custodies vesting + LP, enforces freeze/sell-cap in the transfer hook, exposes `guardianSummary()` / `guardianStatus()` / `vesting()` views shaped for the frontend, emits the enforcement log. |
| [VestalLaunchFactory.sol](contracts/src/VestalLaunchFactory.sol) | The seven-step atomic launch (see [Step 2](#step-2--one-transaction-makes-it-real)). |
| [CovenantRegistry.sol](contracts/src/CovenantRegistry.sol) | Append-only, factory-only launch index; `allLaunches()` powers Explore; one-shot `setFactory` wiring, then the deployer holds no further power. |
| [LaunchPool.sol](contracts/src/LaunchPool.sol) | Native-paired constant-product AMM, 0.3% fee, ERC20 LP shares, no privileges. |
| [VestalPoolFactory.sol](contracts/src/VestalPoolFactory.sol) | Permissionless token → pool registry. |
| [interfaces/IRitual.sol](contracts/src/interfaces/IRitual.sol) | Assumed Ritual precompile ABIs + slot addresses — the *only* file (with the Ritual provider) that touches them. |
| [providers/RitualGuardianProvider.sol](contracts/src/providers/RitualGuardianProvider.sol) | Provisions real sovereign agents via precompile `0x080C` / heartbeats via `0x0820`. |
| [providers/MockGuardianProvider.sol](contracts/src/providers/MockGuardianProvider.sol) | Guardian = deployer EOA, for anvil and pre-precompile testnets. |
| [script/Deploy.s.sol](contracts/script/Deploy.s.sol) | Deploys registry + provider (auto-detecting mock vs Ritual) + factory, wires them. |
| [script/DemoLaunch.s.sol](contracts/script/DemoLaunch.s.sol) | Creates a live demo launch and writes guardian log entries. |
| [script/DeployMarket.s.sol](contracts/script/DeployMarket.s.sol) | Deploys the pool factory and (given `TOKEN=`) creates, seeds, and covenant-locks a pool in one run. |

Frontend ↔ contract mapping:

| Frontend surface | Contract source |
|---|---|
| `Launch[]` on Explore | `CovenantRegistry.allLaunches()` |
| Guardian block on token page | `GuardianCovenant.guardianSummary()` |
| `CovenantTerms` / `VestingTranche[]` | `covenant.terms()` / `covenant.vesting()` |
| Enforcement log | `EnforcementAction` event history |
| Guardian status badge | `covenant.guardianStatus()` (same derivation) |
| UI percents | basis points on-chain (bps / 100 = %) |
| Market card / price chart | `VestalPoolFactory.poolOf()` → `LaunchPool` reserves + `Swap` events |
| Buy widget | `LaunchPool.buy()` (0.3% fee, constant product) |
| "Guarded liquidity" figure | covenant's `LaunchPool` share balance × its slice of both reserves |

---

## Frontend reference

**Stack:** React 18 · Vite 6 · Tailwind CSS v4 · react-router 6 · viem 2. Fonts: Fraunces
(display) + Inter (body). No state libraries, no server.

**Routes** ([src/App.jsx](src/App.jsx)):

| Route | Page | What it shows |
|---|---|---|
| `/` | [Landing.jsx](src/pages/Landing.jsx) | Hero, how-it-works, comparison table, FAQ. |
| `/explore` | [Explore.jsx](src/pages/Explore.jsx) | Every registered launch, read live from the registry. |
| `/token/:id` | [TokenDetail.jsx](src/pages/TokenDetail.jsx) | The showpiece: Guardian Panel (status, heartbeat, revivals, enforcement log with attestations), covenant terms, vesting timeline, live market (price chart from Swap events, reserves, buy widget). `:id` is the token address. |
| `/launch` | [Launch.jsx](src/pages/Launch.jsx) | The 4-step wizard ending in a real `createLaunch` transaction. |
| `/docs` | [Docs.jsx](src/pages/Docs.jsx) | In-app documentation: architecture, lifecycle, contracts, FAQ, roadmap. |

**Components** ([src/components/](src/components/)): `Card`, `Badge`, `StatBlock`, `Timeline`,
`StepIndicator`, `Accordion`, `Sparkline`, `AllocationDonut`, `HeartbeatMonitor`, `TrustMeter`,
`TokenAvatar`, `FlameMark`, `Nav`, `Footer` — presentational primitives; all data arrives via
props from the pages.

**Wallet** ([src/chain/wallet.js](src/chain/wallet.js)): injected EIP-1193 provider (MetaMask
etc.) exposed as a single external store. Handles connect, silent reconnect on revisit,
account/chain-change events without reload, disconnect with best-effort permission revocation,
and switch-to-Ritual with add-chain fallback. `useWallet().onRitual` gates every write.

---

## Getting started

### Prerequisites

- Node 18+ and npm
- [Foundry](https://getfoundry.sh) (`forge`, `anvil`) for contract work
- A browser wallet (MetaMask or similar) for launching/trading

### Run the frontend against the live testnet

```bash
npm install
npm run dev       # dev server — reads the deployed testnet contracts out of the box
npm run build     # production build to dist/
npm run preview   # serve the production build
npm run smoke     # SSR-render every route; catches runtime errors vite build cannot
```

The app ships pointed at Ritual Chain testnet with the deployed addresses baked into
[src/config/ritual.js](src/config/ritual.js) — no configuration needed to browse. To launch or
buy, connect a wallet; the app offers to add/switch to Ritual Chain (chain id 1979) itself.

### Full-stack local development (anvil)

```bash
# 1. Start a local chain
anvil

# 2. Deploy the protocol (auto-selects MockGuardianProvider on anvil)
cd contracts
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# 3. Create a demo launch with guardian log entries
FACTORY=0x... forge script script/DemoLaunch.s.sol --rpc-url http://localhost:8545 --broadcast

# 4. (Optional) Deploy the market layer and seed a covenant-locked pool
TOKEN=0x... forge script script/DeployMarket.s.sol --rpc-url http://localhost:8545 --broadcast

# 5. Point the frontend at anvil without touching source — .env.local:
#    VITE_RPC_URL=http://localhost:8545
#    VITE_CHAIN_ID=31337
#    VITE_LAUNCH_FACTORY=0x...
#    VITE_COVENANT_REGISTRY=0x...
#    VITE_POOL_FACTORY=0x...
npm run dev
```

### Deploy contracts to Ritual testnet

```bash
cd contracts
forge build
forge test
forge script script/Deploy.s.sol                                        # dry run
forge script script/Deploy.s.sol --rpc-url $RITUAL_RPC_URL --broadcast  # real
```

Then copy the printed addresses into `VESTAL_CONTRACTS` in
[src/config/ritual.js](src/config/ritual.js) (or `.env.local` overrides).

---

## Deployed addresses (Ritual Chain testnet)

Chain id **1979** · RPC `https://rpc.ritualfoundation.org` · deployed 2026-07-10:

| Contract | Address |
|---|---|
| CovenantRegistry | `0xCa6B29576B41e6563Df1c9dB54C7d9943eBa6c28` |
| VestalLaunchFactory | `0x31531123eB88B51E6F64e3d910Dc14a5b9213070` |
| MockGuardianProvider | `0x3C09d834b9ad1c3e89bC37C81a622C0572aE5B18` |
| VestalPoolFactory | `0xc85e0CAdc9D39707914B1934427B5Cf2d4E689e8` |
| Demo NLT token | `0xd959047ac90112Cfe99D4F2EA1018F4b44467ad8` |
| Demo covenant | `0x7aC9D0c3a0640cD3a7F740ed667F38a701D71EF1` |
| NLT LaunchPool | `0xA543076ed721211BB511B094E948cEcE092FEd0d` |

The agent precompile slots have no code on the current testnet, so the **mock** guardian
provider is live (guardian = deployer EOA). Swap to `RitualGuardianProvider` when the
precompiles ship — nothing above the provider boundary changes.

---

## Configuration

Everything the app knows about the chain lives in [src/config/ritual.js](src/config/ritual.js);
no UI code hardcodes chain values. `VITE_*` variables in `.env.local` override it for local dev:

| Env var | Default | Purpose |
|---|---|---|
| `VITE_RPC_URL` | `https://rpc.ritualfoundation.org` | JSON-RPC endpoint |
| `VITE_CHAIN_ID` | `1979` | Chain id (wallet + chain object) |
| `VITE_LAUNCH_FACTORY` | deployed address | `createLaunch` target |
| `VITE_COVENANT_REGISTRY` | deployed address | Launch enumeration |
| `VITE_POOL_FACTORY` | deployed address | Token → market resolution |

Other constants there: `EXPLORER_URL`, `BLOCK_TIME_SECONDS` (0.2 — display countdowns only),
and the `PRECOMPILES` map (Scheduler placeholder; HTTP `0x0801`, LLM `0x0802`, sovereign agent
`0x080C`, persistent agent `0x0820`).

---

## Testing

```bash
# Contracts — 28 Foundry tests: factory wiring, vesting (guardian + failsafe paths),
# sell caps and window rolling, freeze, LP lock/withdraw, status derivation,
# enforcement log shape, and the AMM (quotes, liquidity, swaps, covenant lock)
cd contracts && forge test

# Frontend — SSR-renders /, /explore, /launch, /docs through Vite's pipeline,
# executing every page component for real
npm run smoke
```

---

## Ritual Chain quirks worth knowing

- **~5 blocks per second** (`BLOCK_TIME_SECONDS = 0.2`) — day-based UI terms translate to large
  block numbers (1 day ≈ 432,000 blocks).
- **Block timestamps are in milliseconds**, not seconds — don't feed them to `Date` math that
  assumes Unix seconds without checking.
- **Public RPC caps `eth_getLogs` to ~100k-block ranges** — all event reads in
  [src/chain/](src/chain/) chunk requests (90k windows, bounded count) for this reason.
- **Agent precompiles are not live yet** on the testnet; the deploy script auto-detects and
  falls back to the mock provider so the whole flow works today.

---

## Trust model & current limitations

Honest accounting of where the "physics" currently ends:

- **Guardian provider is mocked on testnet** — until Ritual's agent precompiles ship, the
  guardian is the deployer EOA, not a TEE agent. The covenant's *structural* guarantees
  (vesting custody, sell cap, freeze mechanics, LP lock, failsafe) hold regardless; the
  *liveness* and *attestation* guarantees arrive with the real provider.
- **Attestation hashes are recorded but not yet verifiable** in-app — a public attestation
  verifier page is on the roadmap.
- **The sell cap tracks wallets, not identities** — the guardian can track insider wallets it
  discovers, but a determined creator can pre-distribute before launch. The creator wallet
  itself is tracked from block one.
- **Unaudited testnet software.** Do not use with real value. Mainnet follows independent
  audits (see the roadmap in the in-app docs at `/docs`).

---

## Repository layout

```
vestal/
├── contracts/                  Foundry project (see contracts/README.md)
│   ├── src/
│   │   ├── VestalToken.sol           fixed-supply ERC20 + covenant hook
│   │   ├── GuardianCovenant.sol      custody + enforcement + attested log
│   │   ├── VestalLaunchFactory.sol   the one-transaction launch
│   │   ├── CovenantRegistry.sol      append-only launch index
│   │   ├── LaunchPool.sol            constant-product AMM, ERC20 LP shares
│   │   ├── VestalPoolFactory.sol     token → pool registry
│   │   ├── interfaces/               ICovenant, IGuardianProvider, IRitual (precompile boundary)
│   │   └── providers/                RitualGuardianProvider, MockGuardianProvider
│   ├── script/                 Deploy, DemoLaunch, DeployMarket
│   └── test/                   28 tests: VestalLaunch.t.sol, LaunchPool.t.sol
├── src/
│   ├── config/ritual.js        every chain constant, env-overridable
│   ├── chain/                  viem layer: wallet, launches, market, factory, abi
│   ├── data/                   store hooks (useLaunches, useMarket) + site copy + fixtures
│   ├── components/             presentational primitives
│   ├── pages/                  Landing, Explore, TokenDetail, Launch, Docs
│   ├── App.jsx                 routes
│   └── index.css               Tailwind v4 theme (ink/cream/ember palette)
├── scripts/prerender.mjs       SSR smoke test (npm run smoke)
└── vite.config.js
```

`src/data/launches.js` also keeps the JSDoc typedefs and static fixtures that document the
`Launch` read model — the chain layer maps contract state into exactly these shapes.

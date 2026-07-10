# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Vestal is a token launchpad on Ritual Chain testnet where launch terms (LP lock, team vesting, dev sell caps) are enforced on-chain by a "guardian covenant" wired into the token's transfer path. The repo is two projects in one: a Foundry contract suite in `contracts/` and a React frontend in `src/` that reads all state directly from deployed contracts — **there are no mocks in the data path**. `README.md` (root and `contracts/`) document the protocol design in depth; keep both in sync with behavior changes.

## Commands

```bash
# Frontend (repo root)
npm run dev          # Vite dev server against the live testnet contracts
npm run build        # production build
npm run smoke        # SSR-renders every static route via scripts/prerender.mjs — the frontend's test suite

# Contracts (cd contracts/)
forge build
forge test                            # full suite (VestalLaunch.t.sol, LaunchPool.t.sol)
forge test --match-test testName -vvv # single test
forge script script/Deploy.s.sol --rpc-url <url> --broadcast        # registry + provider + factory
FACTORY=0x... forge script script/DemoLaunch.s.sol --rpc-url <url> --broadcast
TOKEN=0x...   forge script script/DeployMarket.s.sol --rpc-url <url> --broadcast
```

There is no linter, no TypeScript, and no frontend unit-test framework. `npm run smoke` is the frontend check — it executes every page component for real through Vite SSR and fails on runtime errors `vite build` can't catch. Run it after frontend changes. **If you add a route in `src/App.jsx`, add it to the `routes` array in `scripts/prerender.mjs`** (only static routes — `/token/:id` takes chain addresses and can't be smoke-tested).

For local full-stack dev: run `anvil`, deploy with the scripts above (Deploy.s.sol auto-selects `MockGuardianProvider` when precompile slot `0x080C` has no code), then point the frontend at it via `VITE_*` vars in `.env.local` (template comments are already in that file). Never hardcode chain values in UI code — every chain constant lives in `src/config/ritual.js` with a `VITE_*` env override.

## Architecture: one-way data flow

```
src/config/ritual.js   chain constants (RPC, chain id, addresses, precompiles) — the only config source
   └─ src/chain/       viem layer: wallet.js, launches.js, market.js, portfolio.js, factory.js, abi.js
        └─ src/data/   store hooks (useLaunches, useMarket, usePortfolio) + typedefs/formatters + site copy
             └─ src/pages/       Landing, Explore, TokenDetail, Launch, Docs, Portfolio (routes in App.jsx)
                  └─ src/components/   purely presentational; all data arrives via props
```

Layering rules that hold everywhere:

- **Pages own data-fetching via the `src/data/` hooks; components never fetch.** Components are dumb primitives (`Card`, `Badge`, `Timeline`, …).
- **State is module-level external stores consumed via `useSyncExternalStore`** (see `src/chain/wallet.js`, `src/data/useLaunches.js`). No Redux/Zustand/context, no storage beyond the wallet-reconnect flag and theme key in localStorage. Stores fetch once and share; expose a `refresh...()` for post-write refetches (`refreshLaunches()` after a deploy, `refresh()` after a trade).
- **Launch ids are lowercase token addresses** — `/token/:id` routes are chain addresses; always `.toLowerCase()` when comparing.
- **`src/data/launches.js` is the read-model contract**: JSDoc typedefs (`Launch`, `CovenantTerms`, `Guardian`, `EnforcementEvent`) plus derived-value formatters. The chain layer maps contract state into exactly these shapes; UI depends only on the typedefs and formatters, never raw contract fields. Static fixtures in `src/data/` that were superseded by `src/chain/` are deliberately kept as test fixtures — don't delete them.

## Frontend ↔ contract sync points

- **ABIs are hand-written minimal `parseAbi` strings in `src/chain/abi.js`** — only what the frontend touches, not the full `contracts/out` artifacts. Any change to a contract's read/write surface must be mirrored there.
- **Enum order is a wire format**: `ACTION_TYPES` and `GUARDIAN_STATUSES` in `abi.js` map by index to the `ActionType`/`GuardianStatus` enums in `contracts/src/interfaces/ICovenant.sol`. Reordering either side breaks the Guardian Panel silently.
- **Units convert at the chain layer, never in UI**: on-chain basis points → UI percent (`bps / 100`), days → blocks via `BLOCK_TIME_SECONDS` (0.2s — 1 day ≈ 432,000 blocks), everything is 18-decimal, prices are native (tRITUAL) per token. `src/chain/factory.js` does the wizard→contract unit translation, including landing the bps rounding remainder on the last vesting tranche so totals are exact.
- After a testnet redeploy, update `VESTAL_CONTRACTS` in `src/config/ritual.js` and the address tables in both READMEs.

## Chain I/O conventions (src/chain/)

- **Every write follows simulate → write → `waitForTransactionReceipt` → check `receipt.status`** (see `writeAndConfirm` in `market.js`). Simulating first surfaces covenant/pool reverts as readable errors *before* the wallet prompt. ERC20 writes go through `ensureAllowance` (skip approve when allowance already covers it). Gate every write path on `useWallet().onRitual`.
- **`eth_getLogs` is chunked**: the public RPC caps ranges at ~100k blocks, so all event reads use 90k-block windows, newest first, bounded to 10 chunks. Correctness never depends on log completeness — e.g. tranche released-state comes from contract storage; logs only feed timelines.
- **The public RPC is load-balanced across backends with inconsistent log history.** `market.js` handles this with per-chunk retries, duplicate queries per chunk, and a session-level `seenSwaps` cache (keyed `txHash:logIndex`) whose union is what the UI shows; `useMarket` polls every 15s so the cache converges. Preserve this pattern for any new event reads.
- **Errors never throw to the UI.** Chain-layer failures are caught in the `src/data/` hooks, logged as `console.warn('[vestal] ...', err)`, and surfaced as a short human-readable message in store state (`error: 'Could not reach Ritual Chain — …'`). Keep the last good snapshot on failed background polls.
- **SSR-safety is mandatory** (the smoke test loads every module in Node): touch `window`/`localStorage` only inside handlers and effects, guard `import.meta.env` (see `config/ritual.js`), and dynamically `import()` chain modules inside hooks rather than at page module top-level.

## Ritual Chain quirks

- ~5 blocks/second (`BLOCK_TIME_SECONDS = 0.2`); block-time math uses it for display countdowns only.
- **Block timestamps are milliseconds, not seconds** — don't feed them to Unix-seconds `Date` math.
- Agent precompiles (`0x080C`, `0x0820`, Scheduler) are not live on the testnet yet, so the deployed guardian provider is the mock (guardian = deployer EOA).

## Contracts (contracts/)

Foundry, solc `0.8.28`, `forge fmt` line length 110, only dependency is `forge-std` (a local minimal ERC20 lives in `src/lib/` — no OpenZeppelin). Style: custom errors (never revert strings), NatSpec block comments explaining intent, section-divider comments inside contracts.

Two design invariants shape every contract decision:

1. **No admin keys anywhere.** No owner, no pause, no fee switch, no upgrade path, no setters for terms/covenant/guardian bindings (one-shot binds only). Enforcement is a revert in the token's transfer path, not a policy. Don't introduce privileged roles.
2. **The Ritual precompile boundary is two files**: `src/interfaces/IRitual.sol` (assumed ABIs + slot addresses) and `src/providers/RitualGuardianProvider.sol`. The published precompile ABIs aren't final — any precompile touchpoint must stay behind `IGuardianProvider` so ABI changes never reach covenant/factory/token logic. `Deploy.s.sol` auto-detects (code at slot `0x080C` → Ritual provider, else mock).

Other structural facts: one launch is exactly one atomic `createLaunch` transaction (mint → creator share → deploy covenant → custody vesting → bind covenant → provision guardian committed to `termsHash` → register); `LaunchPool` is a native-paired constant-product AMM with 0.3% fee, explicitly tracked reserves, reentrancy lock, and ERC20 LP shares (so covenant custody of LP is literal `balanceOf`); selling into a pool is a token transfer, which is how the covenant's sell-cap/freeze checks apply to trades with zero extra wiring; vesting has a permissionless failsafe `FAILSAFE_GRACE_BLOCKS` (~7 days) past due, payable only to the committed recipient.

## Frontend style

- JavaScript with JSDoc types (`@typedef`, `@param`, `@returns` with viem's `` `0x${string}` `` template types) — no TypeScript. `.jsx` for anything with JSX, `.js` otherwise.
- **Every module opens with a block comment** stating its role and the non-obvious constraint it handles (RPC flakiness, SSR, unit mapping). Match this density; comments explain *why*, not *what*.
- Tailwind v4 with the theme defined as `@theme` tokens in `src/index.css`: surfaces `ink/surface/raise/line/linefaint`, text `cream/fog/faint`, accent `ember/emberdim/gold`, status colors, and a 4-step `ramp` for the allocation donut. Use these tokens (`bg-ink`, `text-fog`, `border-line`), never raw hex in components. Dark is default; light theme overrides via `:root[data-theme='light']` (stamped pre-paint in `index.html`, persisted under the `vestal-theme` localStorage key). Fonts: Fraunces (display) / Inter (body). `prefers-reduced-motion` is honored globally — new animations get that for free, don't fight it.
- Shared utility classes live in `@layer components` in `index.css` and are used everywhere instead of repeated Tailwind stacks: `btn-ember` (primary CTA), `btn-ghost`, `card-lift`, `kicker` (section micro-label), `mono` (addresses/hashes), `text-ember-gradient`, `font-display`. Micro-labels not using `.kicker` follow the `text-[11px] uppercase tracking-wider text-faint` idiom.
- Number/address display goes through the formatters in `src/data/launches.js` (`fmtNative` for DEX-style subscript-zero prices, `shortAddr`, `shortHash`, `fmtBlock`, `blocksToApproxTime`) — don't reinvent formatting inline. Addresses and tx hashes link to `${EXPLORER_URL}/address/…` or `/tx/…` with `target="_blank" rel="noreferrer"`.

## Page-level write-flow patterns (see TokenDetail.jsx, Launch.jsx)

- Transaction UI state is plain local `useState` per widget: `submitting`/`step`, `error`, `txHash`. On success, call the relevant store refresh (`refreshMarket` after a trade or market open, `refreshLaunches()` after a deploy) rather than mutating local copies of chain state.
- Error messages shown to users come from viem's `err?.shortMessage || err?.message || '<fallback sentence>'` — `shortMessage` first, always with a human fallback.
- Write buttons are wrapped in the `WalletGate` pattern: not connected → connect button; connected but wrong chain → "Switch wallet to Ritual Chain"; `onRitual` → the action. Reuse/extend `WalletGate` in `TokenDetail.jsx` rather than duplicating the ladder.
- Trades apply a 1% slippage guard (`minOut = estimate * 0.99`); multi-transaction flows (`openMarket`) report progress via an `onStep` callback and are written to be idempotently re-runnable — completed stages are detected and skipped on retry.
- Creator-only UI (e.g. the open-market card) is gated by `wallet.address?.toLowerCase() === launch.creator.toLowerCase()` — an on-chain fact, not a role system.

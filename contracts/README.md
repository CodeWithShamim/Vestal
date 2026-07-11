# Vestal Contracts

Solidity layer for Vestal — the unruggable launchpad on Ritual Chain testnet.
"Launch terms are physics, not promises" is implemented here: the covenant sits
inside the token's transfer path, so enforcement is a revert, not a policy.

## Architecture

```
Creator ──► VestalLaunchFactory ──► VestalToken (fixed supply, covenant hook)
                    │                      │  every transfer checked by
                    │                      ▼
                    ├────────────► GuardianCovenant (custody: vesting + LP)
                    │                      ▲  onlyGuardian enforcement
                    │                      │
                    ├── IGuardianProvider ─┴─► sovereign agent (TEE, DKMS keys)
                    │        │                    Ritual precompiles:
                    │        ├ RitualGuardianProvider → 0x080C provision,
                    │        │                          0x0820 heartbeat/revival
                    │        └ MockGuardianProvider  → local anvil / tests
                    │
                    └────────────► CovenantRegistry (append-only launch index)
```

**One launch = one `createLaunch` transaction.** The factory mints the supply,
hands the creator their unvested share, moves the vesting allocation into a
freshly deployed `GuardianCovenant`, binds the covenant into the token's
transfer path, provisions the sovereign agent committed to `termsHash`, and
registers the launch. After that, no one — factory, creator, or Vestal — holds
any authority over the launch. There are no admin keys anywhere in the system.

## Contract inventory

| File | Role |
| ---- | ---- |
| `src/VestalToken.sol` | Fixed-supply ERC20; covenant hook on every transfer; covenant bound once by the factory — no admin, no upgrade path. |
| `src/GuardianCovenant.sol` | One per launch. Custodies vesting + LP, enforces freeze/sell-cap in the transfer hook, emits the attested enforcement log, derives `guardianStatus()` on-chain (staleness check arms only once wake-ups can be expected — Scheduler task registered or a post-deploy heartbeat). Failsafe grace: `FAILSAFE_GRACE_BLOCKS = 3_024_000` (~7 days at 0.2 s blocks). |
| `src/VestalLaunchFactory.sol` | The one-transaction launch. Validates terms and every tranche up front — zero-bps or past-due tranches revert with `InvalidTranche`. |
| `src/CovenantRegistry.sol` | Append-only, factory-only launch index; one-shot `setFactory` wiring. |
| `src/LaunchPool.sol` | Native-paired constant-product AMM, 0.3% fee, ERC20 LP shares, explicit reserves, reentrancy lock. `addLiquidity(tokenIn, minShares)` takes a slippage guard so a swap between quote and deposit can't silently dilute the depositor. |
| `src/VestalPoolFactory.sol` | Permissionless one-pool-per-token registry (`poolOf`). |
| `src/interfaces/ICovenant.sol` | Shared types + enums (`ActionType`, `GuardianStatus` — **order is the wire format** the frontend maps by index) + the transfer-hook interface. |
| `src/interfaces/IGuardianProvider.sol` | The only guardian-provisioning interface covenant/factory logic sees. |
| `src/interfaces/IRitual.sol` | Assumed Ritual precompile ABIs + slot addresses (the placeholder boundary, below). |
| `src/providers/RitualGuardianProvider.sol` | Real sovereign-agent provisioning via `0x080C`, heartbeats via `0x0820`. |
| `src/providers/MockGuardianProvider.sol` | Guardian = deployer EOA, for anvil and pre-precompile testnets. |
| `src/lib/ERC20.sol` | Minimal local ERC20 base — no OpenZeppelin dependency. |
| `script/Deploy.s.sol` | Registry + provider (auto-detects mock vs Ritual) + factory, wired. |
| `script/DemoLaunch.s.sol` | Creates a live demo launch and writes guardian log entries. |
| `script/DeployMarket.s.sol` | Deploys the pool factory and (given `TOKEN=`) creates, seeds, and covenant-locks a pool. |

## What is actually enforced

- **Vesting** — tranches live in covenant custody; only the guardian can
  release them, and never before the committed block. As a trustless backstop,
  a tranche unclaimed `FAILSAFE_GRACE_BLOCKS` (~7 days) past due becomes
  permissionlessly executable — to the committed recipient only. Funds can be
  neither rushed nor stranded, even if Vestal and Ritual both vanish.
- **Dev-wallet sell cap** — the creator's wallet (plus any insider wallet the
  guardian tracks) can sell at most `devWalletCapBps` of its holdings per
  rolling `sellWindowBlocks` window. Exceeding it reverts at the token level.
- **Freeze** — the guardian can freeze a violating wallet outright; all its
  outgoing transfers revert until unfrozen.
- **LP lock** — the creator deposits LP tokens into covenant custody; they
  cannot leave before `lpLockUntilBlock`.
- **Enforcement log** — every guardian action emits `EnforcementAction(action,
  block, attestation, detail)` whose `ActionType` enum matches the frontend's
  event union (`wake | release | check_ok | flag | freeze | checkpoint |
  revival`) one-to-one. The Guardian Panel is a straight event read.

## Frontend mapping

| Frontend (`src/data/launches.js`)      | Contract source                              |
| -------------------------------------- | -------------------------------------------- |
| `Launch[]` on Explore                  | `CovenantRegistry.allLaunches()`             |
| `Guardian` block on token page         | `GuardianCovenant.guardianSummary()`         |
| `CovenantTerms` / `VestingTranche[]`   | `covenant.terms()` / `covenant.vesting()`    |
| `EnforcementEvent[]` log               | `EnforcementAction` event history            |
| Guardian status badge                  | `covenant.guardianStatus()` (same derivation)|
| UI percents                            | basis points on-chain (bps / 100 = %)        |
| Market card / price chart              | `VestalPoolFactory.poolOf()` → `LaunchPool` reserves + `Swap` events |
| Buy widget                             | `LaunchPool.buy()` (0.3% fee, constant product) |

Contract addresses go into the frontend's `src/config/ritual.js` →
`VESTAL_CONTRACTS` after deployment.

## Ritual placeholder boundary

The published testnet ABIs for the precompiles are not final. Every touchpoint
is isolated in **two files** — `src/interfaces/IRitual.sol` (assumed ABIs +
slot addresses) and `src/providers/RitualGuardianProvider.sol` — so ABI changes
never reach covenant/factory/token logic. `Deploy.s.sol` auto-detects: if slot
`0x080C` has code it deploys the Ritual provider, otherwise the mock (guardian
= deployer) so the full flow runs on anvil today.

## Deployments

**Ritual Chain testnet** (chain id 1979, rpc.ritualfoundation.org, deployed 2026-07-11):

| Contract          | Address                                      |
| ----------------- | -------------------------------------------- |
| CovenantRegistry  | `0x56F78A7e8Afe11C69228283CCe3971F73486E7fE` |
| VestalLaunchFactory | `0x726D2c8e17d3d445c1c0088470dA2DBcCe345B35` |
| MockGuardianProvider | `0x15cce71713b686aaE99C441Ab4e3dEBf7853A889` |
| Demo NLT token    | `0x7EF4FCB9C878a9f3f7f6318d8C6229edc260ec01` |
| Demo covenant     | `0x09Ca97c97325248A64ED849A2Ec4e9A2c5F37361` |
| VestalPoolFactory | `0xCdB83Cdeba6CD12116925E6AF5cDF17d35D2530B` |
| NLT LaunchPool    | `0x6d849a7c64e4Ff693D38235e2244dDD2f1055744` |

The market layer (`LaunchPool` + `VestalPoolFactory`) is a minimal
native-paired constant-product AMM whose LP shares are ERC20 — the NLT pool's
shares are locked in the demo covenant via `lockLp()`, so "LP locked" on the
token page is literal custody. Selling into a pool is a token transfer, so the
covenant's sell cap and freezes bite on every sell with no extra wiring.
`DeployMarket.s.sol` deploys the factory and (given `TOKEN=`) creates, seeds,
and covenant-locks a pool in one run.

The agent precompile slots have no code on the current testnet, so the mock
provider is deployed (guardian = deployer EOA). Swap to RitualGuardianProvider
when the precompiles ship. Note: the chain runs ~5 blocks/s and block
timestamps are in **milliseconds**.

## Develop

```bash
forge build          # compile
forge test           # 31 tests: wiring + tranche validation, vesting, caps, freeze, LP, status, log, pool
forge script script/Deploy.s.sol                    # dry run
forge script script/Deploy.s.sol --rpc-url $RITUAL_RPC_URL --broadcast
FACTORY=0x... forge script script/DemoLaunch.s.sol --rpc-url http://localhost:8545 --broadcast
```

`DemoLaunch.s.sol` creates a live launch on anvil and writes guardian log
entries, giving the frontend real state to read while replacing mocks.

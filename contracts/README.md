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

**Ritual Chain testnet** (chain id 1979, rpc.ritualfoundation.org, deployed 2026-07-10):

| Contract          | Address                                      |
| ----------------- | -------------------------------------------- |
| CovenantRegistry  | `0xCa6B29576B41e6563Df1c9dB54C7d9943eBa6c28` |
| VestalLaunchFactory | `0x31531123eB88B51E6F64e3d910Dc14a5b9213070` |
| MockGuardianProvider | `0x3C09d834b9ad1c3e89bC37C81a622C0572aE5B18` |
| Demo NLT token    | `0xd959047ac90112Cfe99D4F2EA1018F4b44467ad8` |
| Demo covenant     | `0x7aC9D0c3a0640cD3a7F740ed667F38a701D71EF1` |
| VestalPoolFactory | `0xc85e0CAdc9D39707914B1934427B5Cf2d4E689e8` |
| NLT LaunchPool    | `0xA543076ed721211BB511B094E948cEcE092FEd0d` |

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
forge test           # 28 tests: wiring, vesting, caps, freeze, LP, status, log, pool
forge script script/Deploy.s.sol                    # dry run
forge script script/Deploy.s.sol --rpc-url $RITUAL_RPC_URL --broadcast
FACTORY=0x... forge script script/DemoLaunch.s.sol --rpc-url http://localhost:8545 --broadcast
```

`DemoLaunch.s.sol` creates a live launch on anvil and writes guardian log
entries, giving the frontend real state to read while replacing mocks.

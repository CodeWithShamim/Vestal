# Vestal — unruggable token launchpad on Ritual Chain testnet

> Launch terms are physics, not promises.

Vestal hands every token launch to a sovereign AI guardian on Ritual Chain: an agent that
holds the LP and vesting keys via DKMS, wakes itself through the native Scheduler to enforce
the committed terms, and is revived from checkpoint by consensus if it ever crashes. This repo
is the complete frontend — landing page, explore grid, token detail with Guardian Panel,
4-step launch wizard, and docs.

## Run it

```bash
npm install
npm run dev       # dev server
npm run build     # production build to dist/
npm run smoke     # SSR-renders every route; catches runtime errors
```

## Stack

React 18 + Vite + Tailwind CSS v4 + react-router. No state libraries, no storage — all state
in memory. Fonts: Fraunces (display) + Inter (body).

## Where things live

| Path | What |
|---|---|
| `src/config/ritual.js` | Chain constants: `RPC_URL`, `CHAIN_ID`, precompile addresses (`SCHEDULER`, `SOVEREIGN_AGENT_0x080C`, `PERSISTENT_AGENT_0x0820`, `HTTP_0x0801`, `LLM_0x0802`). Placeholders are marked — set them before wiring real reads. |
| `src/data/launches.js` | All launch/guardian mock data with JSDoc typedefs mirroring the intended chain read model. Swap for viem reads without touching UI. |
| `src/data/site.js` | Network stats, FAQ, comparison table, how-it-works copy. |
| `src/components/` | Reusable primitives: `Card`, `Badge`, `StatBlock`, `Timeline`, `StepIndicator`, `Accordion`, `Sparkline`, `AllocationDonut`, `HeartbeatMonitor`, `TrustMeter`. |
| `src/pages/` | `Landing`, `Explore`, `TokenDetail` (Guardian Panel showpiece), `Launch` (wizard), `Docs`. |

## Integration notes

- Wallet: the connect/deploy flows are structured mocks. Wire viem/wagmi against
  `RITUAL_TESTNET` in `src/config/ritual.js`; nothing else hardcodes chain values.
- Every illustrative figure in the UI is labeled as such; replacing `GUARDIAN_NETWORK` and
  `LAUNCHES` with live aggregations removes the labels' predicate, not the layout.
- Attestation links are stubs (`view attestation …`) pointing nowhere until the explorer
  URL is pinned in config.
# Vestal

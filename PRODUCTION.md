# Vestal — Production Run Guide

How to take Vestal from a clean checkout to a live deployment. There are three
deployable pieces, and order matters — each one depends on addresses produced by
the previous step:

1. **Contracts** — Foundry suite in `contracts/`, deployed once per release.
2. **Guardian agent** — `scripts/guardian-agent.mjs`, a long-running process
   with real uptime requirements.
3. **Frontend** — static Vite build in `dist/`, served from any static host.

> **Scope note:** "production" today means the live **Ritual Chain testnet**
> deployment — there is no mainnet target in the config. If a mainnet ships,
> the same steps apply with a new RPC URL / chain id in `src/config/ritual.js`
> and a fresh contract deploy.

---

## 1. Contracts (one-time per deploy)

```bash
cd contracts
forge build && forge test        # full suite must be green before any deploy
forge script script/Deploy.s.sol \
  --rpc-url https://rpc.ritualfoundation.org \
  --broadcast
```

`Deploy.s.sol` deploys the covenant registry, guardian provider, and launch
factory in one transaction batch. It auto-selects the provider: if precompile
slot `0x080C` has code it wires `RitualGuardianProvider`, otherwise the mock
(guardian = deployer EOA). The agent precompiles are not live on testnet yet,
so expect the mock.

The script reads `DEPLOYER_PRIVATE_KEY` from `contracts/.env`; that key needs
tRITUAL for gas.

### After every redeploy — manual sync points

These do not update themselves. Miss one and the frontend or agent points at
dead contracts:

| Where | What |
| --- | --- |
| `src/config/ritual.js` → `VESTAL_CONTRACTS` | factory, registry, pool factory, guardian provider addresses |
| `README.md` + `contracts/README.md` | the deployed-address tables |
| `scripts/guardian-agent.mjs` → `REGISTRY` fallback | or set `COVENANT_REGISTRY` in env |

Remember: **there are no admin keys, pause switches, or upgrade paths by
design.** A redeploy is the only way to change contract behavior. Launches on
the old registry keep functioning on-chain but will not appear in the new
frontend.

---

## 2. Guardian agent (must stay up)

The agent runs the sovereign guardian's job off-chain until Ritual's agent
precompiles (`0x080C` / `0x0820` / Scheduler) go live: heartbeat checkpoints,
sell-cap audits, and vesting releases for every registered covenant.

```bash
# reads contracts/.env — GUARDIAN_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY fallback)
npm run guardian
```

### Uptime requirement

`guardianStatus()` trips to **"Reviving" after 3 missed monitor intervals**.
Live launches use 150–300 block intervals (30–60 s at ~5 blocks/s), so once
started the process cannot be down for more than ~90 s without launches
visibly degrading in the UI. Run it under a supervisor that restarts on crash:

```bash
# pm2
pm2 start scripts/guardian-agent.mjs --name vestal-guardian
pm2 save

# or systemd (Linux): a unit with
#   ExecStart=/usr/bin/node /path/to/vestal/scripts/guardian-agent.mjs
#   Restart=always
#   RestartSec=5
```

### Operational rules

- **Run exactly one instance.** All transactions sign with one key and send
  strictly sequentially (nonce order); a second copy will fight over nonces.
- **Keep the guardian key funded.** Heartbeats and audits are continuous gas
  spend; the agent warns below 0.01 tRITUAL.
- **New launches are adopted automatically** — the registry is re-read every
  10 sweeps. No restart needed after a launch.
- Tunables (env): `SWEEP_MS` (default 45 000 — do not raise past ~60 000 or
  the tightest covenant trips staleness), `AUDIT_LOG_EVERY_MS` (default 30 min
  between routine on-chain audit logs; violations log instantly), `RPC_URL`,
  `GUARDIAN_PRIVATE_KEY`, `COVENANT_REGISTRY`.
- `--once` runs a single sweep and exits — useful as a smoke check before
  handing the loop to the supervisor.

---

## 3. Frontend

```bash
npm run smoke      # the frontend's test suite — SSR-renders every static route
npm run build      # outputs dist/
npm run preview    # optional: local sanity check of the built bundle
```

### Env vars are baked at build time

`VITE_RPC_URL`, `VITE_LAUNCH_FACTORY`, etc. are read by Vite **during
`npm run build`**. The defaults in `src/config/ritual.js` are the production
values, so a plain build with no `.env.local` present is correct.

⚠️ A local `.env.local` pointing at anvil **will be baked into the production
bundle** if present at build time. Build in CI, or move `.env.local` aside
before building, then verify the built app talks to
`rpc.ritualfoundation.org`.

### SPA fallback is required

Routing is client-side (react-router). Without a rewrite, `/token/0x…`,
`/explore`, etc. 404 on a static host. Rewrite all paths to `/index.html`:

| Host | Config |
| --- | --- |
| Netlify | `_redirects`: `/*  /index.html  200` |
| Vercel | `vercel.json`: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }` |
| nginx | `try_files $uri /index.html;` |

Then deploy `dist/` to the host of your choice.

---

## 4. Ongoing operations checklist

- **Monitor the guardian process and its key balance.** Until the agent
  precompiles ship and guardianship moves on-chain, this process is the single
  point of failure for launch health.
- **RPC flakiness is expected, not an incident.** The public RPC is
  load-balanced across backends with inconsistent log history. The frontend
  compensates (chunked `eth_getLogs`, per-chunk retries, session swap cache,
  15 s polling), so intermittent timeline gaps that self-heal within a poll or
  two are normal.
- **Key hygiene.** `contracts/.env` holds raw private keys — verify it is
  git-ignored, and use a dedicated guardian key in production rather than the
  deployer key, so a leak doesn't compromise the deploy identity.
- **Contract-surface changes have frontend sync points.** Mirror any ABI
  change in `src/chain/abi.js` (hand-written minimal `parseAbi` strings), and
  never reorder the `ActionType` / `GuardianStatus` enums in
  `contracts/src/interfaces/ICovenant.sol` without updating `ACTION_TYPES` /
  `GUARDIAN_STATUSES` to match — enum order is a wire format and a mismatch
  breaks the Guardian Panel silently.
- **New routes need smoke coverage.** If a route is added in `src/App.jsx`,
  add it to the `routes` array in `scripts/prerender.mjs` (static routes only).

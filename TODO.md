# Klyro — Build TODO

> Ordered by phase. Work top-to-bottom. Exit criteria are marked — don't advance until they pass.

---

## Phase A — Foundation

**Exit criteria:** a human can play a full round against the Tier 1 bot, on-chain, on Mantle Sepolia.

- [ ] **A-1** Confirm Pyth contract address on Mantle Sepolia — `foundry.toml` uses env var; verify at https://docs.pyth.network/price-feeds/contract-addresses/evm
- [ ] **A-2** Redeploy `PredictionRegistry` and `Leaderboard` with `RoundManager` as the authorized caller (see deploy script note)
- [ ] **A-3** Write `MockPyth.sol` for tests; add full round lifecycle test in `RoundManager.t.sol`
- [ ] **A-4** Add `Leaderboard.t.sol` — test streak multiplier logic and accuracy calculation
- [ ] **A-5** Run `forge build` and copy generated ABIs to `apps/web/src/lib/contracts/abis.ts`
- [ ] **A-6** Implement `usePythPrice` hook (poll Pyth Hermes HTTP API: `https://hermes.pyth.network/v2/updates/price/latest`)
- [ ] **A-7** Implement `useRound` hook (wagmi `useReadContract` on `RoundManager.getRound`)
- [ ] **A-8** Implement `useLockPrediction` hook (wagmi `useWriteContract` on `RoundManager.lockPrediction`)
- [ ] **A-9** Wire `ArenaView` to real contract reads/writes (replace mock state)
- [ ] **A-10** Build Tier 1 scripted bot service (`packages/bot/`) — Node.js/TypeScript, reads open rounds via Pyth ticks, submits UP/DOWN via `RoundManager.lockPrediction`
- [ ] **A-11** Deploy contracts to Mantle Sepolia; paste addresses into `addresses.ts` and `.env.local`
- [ ] **A-12** End-to-end smoke test: human plays one round against bot, round resolves on-chain

---

## Phase B — Fairness & Identity

**Exit criteria:** every round has a verifiable on-chain proof link; at least one agent has an ERC-8004 identity.

- [ ] **B-1** Confirm Pyth Entropy contract address on Mantle Sepolia (`packages/contracts/.env.example`)
- [ ] **B-2** Add `EntropyConsumer` helper to `RoundManager` for randomized agent matchmaking
- [ ] **B-3** Register Tier 1 bot in `AgentRegistry` with an ERC-8004 identity from the Mantle Identity Registry
- [ ] **B-4** Wire `RoundVerifyView` to real `PredictionRegistry` contract reads (remove mock data)
- [ ] **B-5** Surface the "Verify on-chain" explorer link in `ArenaView` post-round
- [ ] **B-6** Wire `AgentProfileView` to `AgentRegistry` contract reads (remove mock data)
- [ ] **B-7** Add ERC-8004 Identity Registry ABI + address to `addresses.ts`

---

## Phase C — Polish & Onboarding

**Exit criteria:** new user goes from landing → first locked prediction in under 30 seconds; result card is shareable.

- [ ] **C-1** Set up thirdweb Client ID in `.env.local` (create project at https://thirdweb.com/dashboard)
- [ ] **C-2** Wire `Providers.tsx` — configure thirdweb client with Mantle Sepolia chain
- [ ] **C-3** Add `ConnectButton` from thirdweb to `Nav.tsx` (email/social/embedded wallet)
- [ ] **C-4** Configure ERC-4337 paymaster in thirdweb dashboard (gasless for Mantle Sepolia)
- [ ] **C-5** Build `ResultCard` component — shows you vs AI, who won, price delta, rank change, share-to-X button
- [ ] **C-6** Build `ShareButton` — constructs an X intent URL with the result card image (use `og:image` endpoint)
- [ ] **C-7** Add OG image endpoint (`apps/web/src/app/og/route.tsx`) for the result card
- [ ] **C-8** Wire `LeaderboardView` to `Leaderboard.getAllPlayers()` + `getPlayer()` reads (remove mock data)
- [ ] **C-9** Mobile polish pass — test on 375px and 390px viewports; verify countdown ring, call buttons, versus layout
- [ ] **C-10** Add loading skeletons for all data-fetching views
- [ ] **C-11** Add toast/snackbar feedback for transaction states (pending, confirmed, failed)
- [ ] **C-12** Add asset picker wiring in `ArenaView` — switching asset opens a round for the selected feed

---

## Phase D — Agent Upgrade (Owner action required)

> **PAUSE** — do not start Phase D until the owner provides:
> 1. A running Hermes / OpenClaw agent instance
> 2. The agent wallet address + ERC-8004 identity on Mantle
> 3. Agent endpoint or skill-file location
>
> The Tier 1 scripted bot runs the app fully in the meantime.

- [ ] **D-1** Write OpenClaw skill/config file for the agent (reads open round + Pyth context, returns UP/DOWN)
- [ ] **D-2** Build submission interface for the agent (contract function + relay if needed)
- [ ] **D-3** Register agent in `AgentRegistry` with its ERC-8004 identity
- [ ] **D-4** Smoke test: real agent plays a round, prediction appears on-chain, leaderboard updates
- [ ] **D-5** (Stretch) Add second agent personality ("Momentum Max" or "Contrarian Cora")
- [ ] **D-6** (Stretch) Multiple agents on the leaderboard filtered by `type = agent`

---

## Phase E — Demo & Submission

- [ ] **E-1** Confirm open decisions from PRD Section 15 (project name, round length default, first asset)
- [ ] **E-2** Add favicon and OG image using Klyro brand assets
- [ ] **E-3** Record demo video (required for submission) — show full round from login to result card
- [ ] **E-4** Write X thread: pitch + demo gif + GitHub link + Mantle contract address + `#MantleAIHackathon`
- [ ] **E-5** Submit to hackathon portal; link GitHub repo and deployed app URL
- [ ] **E-6** Engage community for voting — pin tweet, post in Mantle Discord

---

## Ongoing / cross-cutting

- [ ] Keep `addresses.ts` updated after every contract redeploy
- [ ] Add `DEPLOYMENT.md` with deployed addresses and verification links after Phase A
- [ ] Consider Mantle's native 7702 support as an alternative to 4337 for gasless (check docs at build time)
- [ ] Write a simple price-feed integration test against the live Pyth Hermes endpoint

---

*Last updated: 2026-06-06*

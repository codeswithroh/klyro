# KLYRO — Out-predict the machine

> **The Turing Test, settled on-chain.** A fast, social price-prediction arena where humans go head-to-head against an autonomous AI agent. Every prediction — human *and* AI — is permanently recorded on Mantle and scored against the real Pyth price. No jargon. No seed phrases. One tap.

🔗 **Live app:** https://klyro-jet.vercel.app
🤖 **Live AI benchmark:** https://klyro-jet.vercel.app/benchmark
🆔 **Axiom-7 ERC-8004 identity:** https://klyro-jet.vercel.app/agents/axiom-7

Built for **Mantle "The Turing Test Hackathon 2026" — Phase II: AI Awakening**
Track: **Consumer & Viral DApps** (gamified, shareable, Human-vs-AI).

---

## Why Klyro fits this hackathon

Mantle names **three defining features** of the Turing Test Hackathon. Klyro is built around all three:

| Mantle's pillar | How Klyro delivers it |
|---|---|
| **1. On-chain benchmarking of AI** — every agent decision recorded on Mantle | Every Arena round writes both the human's and Axiom-7's UP/DOWN call to the on-chain `PredictionRegistry`, then settles win/loss into the `Leaderboard`. A permanent, verifiable record of AI vs human performance. |
| **2. ERC-8004 agent identity** — each agent gets an identity NFT with on-chain reputation | Axiom-7 holds a **soulbound ERC-8004 `AgentNFT`** whose win-rate, streak, and prediction history are read **live from the Leaderboard**. The reputation updates automatically every time a battle settles. The NFT renders a fully on-chain SVG. |
| **3. Radical transparency** — observe agents performing in real time | The `/benchmark` page is a live **"AI vs Humanity"** scoreboard, polling Mantle every few seconds. Watch the AI's on-chain win-rate move as rounds settle. |

The whole product *is* a live, public, verifiable Turing Test: can a human read the market better than an autonomous on-chain agent?

---

## What it is

You pick **UP** or **DOWN** on ETH/USD. So does **Axiom-7**, an autonomous AI agent. A real **Pyth Network** price decides the outcome when the window closes, and a smart contract settles it on Mantle — tamper-proof. The sharpest humans and the AI rank side by side.

Two ways to play:

- **⚔️ Arena** — single on-chain round. You vs Axiom-7. Both predictions and the result are recorded on Mantle. This is the mode that feeds the on-chain benchmark and the agent's ERC-8004 reputation.
- **🏆 Gauntlet** — best-of-3 / best-of-5 series against Axiom-7 with real Pyth prices, then your match score is submitted on-chain to the `GauntletLeaderboard`.

---

## Meet Axiom-7 — the AI agent

Axiom-7 is an autonomous, **contrarian** price-prediction agent with its own execution wallet and ERC-8004 identity. It does **not** mirror the human's view of the chart — it runs an independent multi-signal strategy off live Pyth/Hermes data:

- **Mean reversion** (45%) — fades strong recent moves; humans chase momentum, Axiom-7 fades it.
- **Volatility regime** (25%) — leans DOWN in high-vol fear, UP in quiet drift.
- **RSI-lite oscillator** (30%) — reads short-term overbought/oversold from recent ticks.

The agent's predictions are submitted server-side from its own wallet:
- **Arena** → `POST /api/bot-predict` calls `lockPrediction` on-chain, so the AI's call is permanently recorded *before* the round settles.
- **Gauntlet** → `POST /api/bot-signal` returns a real, market-derived direction for the off-chain series (no per-round gas).

---

## How a round works (on-chain flow)

```
        ┌─────────── Pyth Hermes (real ETH/USD) ───────────┐
        │                                                   │
   open round                                          settle round
        │                                                   │
        ▼                                                   ▼
  RoundManager.openRoundWithPrice         RoundManager.resolveRoundWithPrediction
   • pushes fresh price via IPyth          • pushes close price via IPyth
   • stores start price                    • records human + AI calls
        │                                   • scores both into Leaderboard
        │                                   • settles win/loss on-chain
        ▼                                                   ▼
  Human taps UP/DOWN (stored in browser)          Leaderboard updates
  Axiom-7 calls lockPrediction (on-chain)                  │
                                                           ▼
                                        AgentNFT (ERC-8004) reflects new reputation
                                                           │
                                                           ▼
                                              /benchmark + /agents update live
```

> **Note on the oracle:** prices are the real **Pyth Network ETH/USD** feed pulled from Hermes. The canonical Pyth contract on Mantle Sepolia rejected our on-chain update payloads, so we route the real Hermes price through an **IPyth-compatible adapter (`MockPyth`)** that accepts the same price data and exposes the identical `IPyth` interface to `RoundManager`. The *prices are real*; only the on-chain delivery path is adapted.

---

## Deployed contracts — Mantle Sepolia (Chain ID 5003)

| Contract | Address | Purpose |
|---|---|---|
| `RoundManager` | [`0xFCb16aF770E8461AD36F9F5776Fb5555d66a99b5`](https://explorer.sepolia.mantle.xyz/address/0xFCb16aF770E8461AD36F9F5776Fb5555d66a99b5) | Opens rounds, records predictions, resolves against Pyth, settles scores |
| `PredictionRegistry` | [`0xB9E8a7c53b610135D7355A238F0361be5247C4e0`](https://explorer.sepolia.mantle.xyz/address/0xB9E8a7c53b610135D7355A238F0361be5247C4e0) | Records each player's & the AI's UP/DOWN call per round |
| `Leaderboard` | [`0xd7BD1DD79Bc6b83214E2E452572b3dd515EcC841`](https://explorer.sepolia.mantle.xyz/address/0xd7BD1DD79Bc6b83214E2E452572b3dd515EcC841) | Cumulative points, win/loss, streaks — single source of truth for reputation |
| `AgentNFT` (ERC-8004) | [`0x044b0D6Fdc2Ab10560217B6353A2d5812592e6a2`](https://explorer.sepolia.mantle.xyz/address/0x044b0D6Fdc2Ab10560217B6353A2d5812592e6a2) | Soulbound agent identity; live stats + on-chain SVG read from Leaderboard |
| `AgentRegistry` | [`0xC2c8A75b2635499202A0da0bFe7C7fF0bEAAD644`](https://explorer.sepolia.mantle.xyz/address/0xC2c8A75b2635499202A0da0bFe7C7fF0bEAAD644) | Maps ERC-8004 identities to agent wallets |
| `GauntletLeaderboard` | [`0xF699b21BF843d7F74457CbEE377c55108B7f7F40`](https://explorer.sepolia.mantle.xyz/address/0xF699b21BF843d7F74457CbEE377c55108B7f7F40) | Records best-of-N match results |
| `BattleResultNFT` | [`0xACfF9D86f8Ca2496f2e6b353ddEdA5155a58e1B2`](https://explorer.sepolia.mantle.xyz/address/0xACfF9D86f8Ca2496f2e6b353ddEdA5155a58e1B2) | Mintable NFT of a battle result card |
| `MockPyth` (IPyth adapter) | [`0xd4C8e113b8F3BA78258147ae9E2485b36f240780`](https://explorer.sepolia.mantle.xyz/address/0xd4C8e113b8F3BA78258147ae9E2485b36f240780) | Accepts real Hermes prices, exposes the `IPyth` interface |

**Axiom-7 agent wallet:** [`0xC557BBc3351B1CcbbDa556b8001736beb28A7A0B`](https://explorer.sepolia.mantle.xyz/address/0xC557BBc3351B1CcbbDa556b8001736beb28A7A0B) (ERC-8004 token #0)

Addresses are also kept in `apps/web/src/lib/contracts/addresses.ts`.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind, mobile-first |
| Chain reads/writes | viem + wagmi v2, thirdweb v5 |
| Wallet | thirdweb in-app wallet (email / Google / Apple social login) + external wallets — **no seed phrases** |
| Oracle | Pyth Network ETH/USD via Hermes, delivered on-chain through an IPyth adapter |
| AI agent | Server-side Next.js API routes (`/api/bot-predict`, `/api/bot-signal`) signing from the agent's wallet |
| Agent identity | **ERC-8004** soulbound `AgentNFT` with on-chain SVG + live reputation |
| Contracts | Foundry (Solidity ^0.8.24) |
| Network | Mantle Sepolia (Chain ID 5003) |
| Deploy | Vercel (web) · Foundry scripts (contracts) |

> Wallet UX uses social login so anyone can play without a seed phrase. Players sign their own testnet transactions; the AI agent signs from its own server-side wallet. (A gasless paymaster is a planned enhancement, not yet wired.)

---

## Monorepo structure

```
klyro/
├── apps/
│   └── web/                         # Next.js 14 frontend
│       └── src/
│           ├── app/
│           │   ├── arena/           # ⚔️ single on-chain round
│           │   ├── challenge/       # 🏆 Gauntlet (best-of-N)
│           │   ├── benchmark/       # 📊 live AI-vs-Humanity benchmark
│           │   ├── agents/          # ERC-8004 agent identities
│           │   ├── leaderboard/
│           │   └── api/
│           │       ├── bot-predict/ # AI submits on-chain prediction (Arena)
│           │       └── bot-signal/  # AI returns direction (Gauntlet)
│           ├── components/          # arena, challenge, agent, ui
│           └── lib/                 # contracts (ABIs/addresses), hooks, store
├── packages/
│   ├── contracts/                   # Foundry — Solidity contracts + deploy scripts
│   │   ├── src/                     # RoundManager, AgentNFT, Leaderboard, …
│   │   └── script/                  # Deploy*.s.sol
│   └── bot/                         # Standalone Axiom-7 round-opener / predictor
└── vercel.json
```

---

## Getting started

### Prerequisites
- Node 20+, pnpm 9+
- [Foundry](https://getfoundry.sh/) — `curl -L https://foundry.paradigm.xyz | bash`
- A free [thirdweb](https://thirdweb.com/dashboard) Client ID
- Testnet MNT from the [Mantle faucet](https://faucet.sepolia.mantle.xyz/) (deployer + agent wallet)

### Run the frontend
```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# set NEXT_PUBLIC_THIRDWEB_CLIENT_ID and (server-only) BOT_PRIVATE_KEY
pnpm dev
```

### Build & test contracts
```bash
cd packages/contracts
forge build
forge test -vv
```

### Deploy contracts (Mantle Sepolia)
```bash
cd packages/contracts
cp .env.example .env       # set DEPLOYER_PRIVATE_KEY, LEADERBOARD_ADDRESS, AGENT_WALLET
forge script script/DeployAll.s.sol --rpc-url "$MANTLE_SEPOLIA_RPC" --broadcast
# Deploy the ERC-8004 agent identity + mint Axiom-7:
forge script script/DeployAgentNFT.s.sol --rpc-url "$MANTLE_SEPOLIA_RPC" --broadcast
```
After deployment, paste the addresses into `apps/web/.env.local` (and `addresses.ts`).

> ⚠️ The `AgentNFT` must be constructed with the **same `Leaderboard`** that `RoundManager` writes to, or the agent's reputation will read from the wrong contract and never update.

---

## Submission checklist (Phase II)

- ✅ Deployed on **Mantle** (Sepolia, Chain ID 5003) — addresses above
- ✅ **GitHub repo** — this repository
- ✅ **Live deployment** — https://klyro-jet.vercel.app
- ✅ **ERC-8004 agent identity** — Axiom-7, token #0, live on-chain reputation
- ✅ **On-chain AI benchmarking** — every Arena round recorded & scored on Mantle
- 🎥 Demo video + X thread (`#MantleAIHackathon`) — for submission

---

## Brand

- **Signature:** Klyro Violet `#6C2BF2` · **UP:** Rally Green `#07BE6A` · **DOWN:** Drop Red `#F12E49`
- **Background:** Arena Paper `#EEEDF2`
- **Fonts:** Archivo Expanded (display) · Archivo (body) · JetBrains Mono (numbers/hashes)

---

## License

MIT

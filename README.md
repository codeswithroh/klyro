# KLYRO — Out-predict the machine

> A fast, social price-prediction arena where humans go head-to-head against AI agents.  
> Every call settled fairly and verifiably on-chain. No jargon. No seed phrases. Just one tap.

Built for **Mantle "The Turing Test Hackathon 2026"** — Phase II "AI Awakening"  
Track 04 — Consumer & Viral DApps (Animoca Minds × OpenCheck)

---

## What it is

You pick an asset. You tap **UP** or **DOWN**. So does an AI agent. A Pyth Network oracle reads the closing price when the window expires — the smart contract settles the result on-chain, tamper-proof. The sharpest humans and smartest agents rank side by side on a public leaderboard.

Core features:
- **Human vs AI duels** — every round is you vs a named AI agent with an ERC-8004 on-chain identity
- **Pyth oracle** — prices and resolution are read from Pyth Network, not set by the app
- **On-chain proof** — every round links to its Mantle Sepolia transaction; anyone can verify
- **Gasless play** — thirdweb embedded wallet + ERC-4337 paymaster; no MNT required to play
- **Email/social login** — wallet created invisibly; no seed phrases shown

---

## Monorepo structure

```
klyro/
├── apps/
│   └── web/                    # Next.js 14 frontend
│       └── src/
│           ├── app/            # App Router pages
│           ├── components/     # UI, arena, leaderboard, agent
│           └── lib/            # contracts ABIs/addresses, hooks, utils
├── packages/
│   └── contracts/              # Foundry — Solidity contracts
│       ├── src/
│       │   ├── RoundManager.sol
│       │   ├── PredictionRegistry.sol
│       │   ├── Leaderboard.sol
│       │   └── AgentRegistry.sol
│       ├── test/
│       └── script/Deploy.s.sol
└── .github/workflows/ci.yml
```

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind | Fast, SEO-ready, mobile-first |
| Chain interaction | wagmi v2 + viem | Type-safe, tree-shakeable |
| Wallet / gasless | thirdweb (embedded wallet + paymaster) | Email login, no gas for players |
| Oracles | Pyth Network (Mantle Sepolia) | Live price feeds + Entropy for randomness |
| Agent identity | ERC-8004 (Mantle Identity Registry) | On-chain reputation, auditable |
| Contracts | Foundry | Fast builds, clean tests |
| Network | Mantle Sepolia (Chain ID 5003) | Hackathon target |

---

## Getting started

### Prerequisites

- Node 20+, pnpm 9+
- [Foundry](https://getfoundry.sh/) (`curl -L https://foundry.paradigm.xyz | bash`)
- A free [thirdweb](https://thirdweb.com/dashboard) Client ID
- Testnet MNT from the [Mantle faucet](https://faucet.sepolia.mantle.xyz/) (for deployer only)

### Install

```bash
pnpm install
```

### Run the frontend

```bash
cp apps/web/.env.example apps/web/.env.local
# fill in NEXT_PUBLIC_THIRDWEB_CLIENT_ID
pnpm dev
```

### Build & test contracts

```bash
cd packages/contracts
forge build
forge test -vv
```

### Deploy contracts to Mantle Sepolia

```bash
cd packages/contracts
cp .env.example .env
# fill in DEPLOYER_PRIVATE_KEY, PYTH_ADDRESS
forge script script/Deploy.s.sol --rpc-url mantle_sepolia --broadcast
```

After deployment, paste the output addresses into `apps/web/src/lib/contracts/addresses.ts` and your `.env.local`.

---

## Contracts

| Contract | Purpose |
|---|---|
| `RoundManager` | Opens rounds, locks predictions + start price, resolves against Pyth, emits events |
| `PredictionRegistry` | Records each player's UP/DOWN call per round |
| `Leaderboard` | Tracks points, win rates, and streaks for humans and agents |
| `AgentRegistry` | Maps ERC-8004 agent identities to their wallets and game records |

All contracts are deployed on **Mantle Sepolia (Chain ID 5003)**.  
Contract addresses: see `apps/web/src/lib/contracts/addresses.ts` (filled post-deployment).

---

## Build phases

| Phase | Status | Description |
|---|---|---|
| A — Foundation | In progress | Working game loop on testnet with Tier 1 scripted bot |
| B — Fairness & identity | Planned | Pyth Entropy, ERC-8004 agent identity, verify panel |
| C — Polish & onboarding | Planned | Gasless paymaster, result card, share-to-X, mobile polish |
| D — Agent upgrade | Blocked (owner action) | Swap Tier 1 bot for real OpenClaw/Hermes agent |
| E — Demo & distribution | Planned | Demo video, X thread, submission |

### Phase D — Owner action required

When you are ready to wire up a real AI agent (Phase D), the following is needed:

1. A running **Hermes / OpenClaw** agent instance
2. The agent's **wallet address** and **ERC-8004 identity** registered on Mantle
3. The agent endpoint or skill-file location so it can receive round data and submit predictions

The Tier 1 scripted bot keeps the game fully functional until then.

---

## Brand

- **Signature color:** Klyro Violet `#6C2BF2`
- **UP:** Rally Green `#07BE6A` | **DOWN:** Drop Red `#F12E49`
- **Background:** Arena Paper `#EEEDF2`
- **Fonts:** Archivo Expanded (display) · Archivo (body) · JetBrains Mono (numbers/hashes)
- Full brand guidelines: `docs/brand/` (see `Klyro Brand Identity.html`)

---

## Contributing

Branch from `dev`, open a PR against `dev`. CI runs lint + contract tests on every PR.

---

## License

MIT

// Contract addresses on Mantle Sepolia (Chain ID 5003).
// Populated by scripts/set-addresses.sh after deployment.

const ZERO = '0x0000000000000000000000000000000000000000'

export const MANTLE_SEPOLIA_CHAIN_ID = 5003

export const CONTRACTS = {
  RoundManager:          process.env.NEXT_PUBLIC_ROUND_MANAGER_ADDRESS           ?? '0xFCb16aF770E8461AD36F9F5776Fb5555d66a99b5',
  PredictionRegistry:    process.env.NEXT_PUBLIC_PREDICTION_REGISTRY_ADDRESS     ?? '0xB9E8a7c53b610135D7355A238F0361be5247C4e0',
  Leaderboard:           process.env.NEXT_PUBLIC_LEADERBOARD_ADDRESS             ?? '0xd7BD1DD79Bc6b83214E2E452572b3dd515EcC841',
  AgentRegistry:         process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS          ?? '0xC2c8A75b2635499202A0da0bFe7C7fF0bEAAD644',
  GauntletLeaderboard:   process.env.NEXT_PUBLIC_GAUNTLET_LEADERBOARD_ADDRESS    ?? '0xF699b21BF843d7F74457CbEE377c55108B7f7F40',
  AgentNFT:              process.env.NEXT_PUBLIC_AGENT_NFT_ADDRESS               ?? '0x044b0D6Fdc2Ab10560217B6353A2d5812592e6a2',
  BattleResultNFT:       process.env.NEXT_PUBLIC_BATTLE_RESULT_NFT_ADDRESS      ?? '0xACfF9D86f8Ca2496f2e6b353ddEdA5155a58e1B2',
} as const

// Axiom-7 bot wallet — used to read its actual on-chain prediction
export const AGENT_WALLET = process.env.NEXT_PUBLIC_AGENT_WALLET
  ?? '0xC557BBc3351B1CcbbDa556b8001736beb28A7A0B'

// MockPyth (IPyth adapter) on Mantle Sepolia — accepts real Hermes prices.
// The canonical Pyth v32 contract (0x98046Bd...) cannot parse Hermes' current
// accumulator (PNAU) update format and is permanently stale; do not fall back to it.
export const PYTH_ADDRESS = process.env.NEXT_PUBLIC_PYTH_ADDRESS
  ?? '0xd4C8e113b8F3BA78258147ae9E2485b36f240780'

// Pyth price feed IDs (verified against https://hermes.pyth.network/v2/price_feeds).
// Used as opaque on-chain identifiers only — see ../priceFeed.ts for where the
// actual live price comes from (Hermes requires a paid API key as of 2026-08-26).
export const PRICE_FEEDS = {
  'ETH/USD':  '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'BTC/USD':  '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'MNT/USD':  '0x4e65f5d4b78c7ba98fd8b81e83e5e3cef31ce2d5fcfc8d0c3fbba4f37ed7d2e0',
  'SOL/USD':  '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'BNB/USD':  '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f',
  'XRP/USD':  '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8',
  'DOGE/USD': '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c',
  'ADA/USD':  '0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d',
  'AVAX/USD': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
} as const

export type AssetPair = keyof typeof PRICE_FEEDS

// Contract addresses on Mantle Sepolia (Chain ID 5003).
// Populated by scripts/set-addresses.sh after deployment.

const ZERO = '0x0000000000000000000000000000000000000000'

export const MANTLE_SEPOLIA_CHAIN_ID = 5003

export const CONTRACTS = {
  RoundManager:        process.env.NEXT_PUBLIC_ROUND_MANAGER_ADDRESS        ?? ZERO,
  PredictionRegistry:  process.env.NEXT_PUBLIC_PREDICTION_REGISTRY_ADDRESS  ?? ZERO,
  Leaderboard:         process.env.NEXT_PUBLIC_LEADERBOARD_ADDRESS          ?? ZERO,
  AgentRegistry:       process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS       ?? ZERO,
} as const

// Axiom-7 bot wallet — used to read its actual on-chain prediction
export const AGENT_WALLET = process.env.NEXT_PUBLIC_AGENT_WALLET
  ?? '0xC557BBc3351B1CcbbDa556b8001736beb28A7A0B'

// Pyth Network on Mantle Sepolia
export const PYTH_ADDRESS = process.env.NEXT_PUBLIC_PYTH_ADDRESS
  ?? '0x98046Bd286715D3B0BC227Dd7a956b83D8978603'

// Pyth price feed IDs (verified at https://pyth.network/developers/price-feed-ids)
export const PRICE_FEEDS = {
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'MNT/USD': '0x4e65f5d4b78c7ba98fd8b81e83e5e3cef31ce2d5fcfc8d0c3fbba4f37ed7d2e0',
} as const

export type AssetPair = keyof typeof PRICE_FEEDS

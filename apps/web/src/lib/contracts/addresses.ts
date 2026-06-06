// Mantle Sepolia Testnet (Chain ID 5003)
// TODO: update after contract deployments

export const MANTLE_SEPOLIA_CHAIN_ID = 5003

export const CONTRACTS = {
  RoundManager: '0x0000000000000000000000000000000000000000',
  PredictionRegistry: '0x0000000000000000000000000000000000000000',
  Leaderboard: '0x0000000000000000000000000000000000000000',
  AgentRegistry: '0x0000000000000000000000000000000000000000',
} as const

// Pyth Network on Mantle Sepolia
export const PYTH_ADDRESS = '0xA2aa501b19aff244D90cc15a4Cf739D2725B5729'

// Pyth price feed IDs
export const PRICE_FEEDS = {
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'MNT/USD': '0x4e65f5d4b78c7ba98fd8b81e83e5e3cef31ce2d5fcfc8d0c3fbba4f37ed7d2e0',
} as const

export type AssetPair = keyof typeof PRICE_FEEDS

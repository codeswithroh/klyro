/**
 * RoundOpener — fetches fresh prices from Hermes, encodes them for MockPyth,
 * then calls RoundManager.openRoundWithPrice. Runs on a fixed interval when
 * ENABLE_AUTO_ROUND_OPENER=true (default: disabled — user opens from UI).
 *
 * MockPyth encoding: abi.encode(bytes32 feedId, int64 price, uint64 conf, int32 expo)
 * NOT Pyth v32 VAAs (PNAU format) — the old Wormhole-based contract is broken on Mantle Sepolia.
 */

import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  parseAbiParameters,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config } from './config.js'
import { mantleSepolia } from './chain.js'
import { ROUND_MANAGER_ABI } from './abis.js'

const HERMES_BASE = 'https://hermes.pyth.network/v2/updates/price/latest'
const ROUND_INTERVAL_MS = 70_000  // open a new round every ~70s (60s round + 10s buffer)

// MockPyth contract on Mantle Sepolia (replaces stale Pyth v32)
const MOCK_PYTH_ADDRESS = (process.env.MOCK_PYTH_ADDRESS ?? '0xd4C8e113b8F3BA78258147ae9E2485b36f240780') as `0x${string}`

const MOCK_PYTH_ABI = [
  {
    name: 'updatePriceFeeds',
    type: 'function' as const,
    stateMutability: 'payable' as const,
    inputs: [{ name: 'updateData', type: 'bytes[]' }],
    outputs: [],
  },
  {
    name: 'getUpdateFee',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [{ name: 'updateData', type: 'bytes[]' }],
    outputs: [{ name: 'feeAmount', type: 'uint256' }],
  },
] as const

// Asset feed IDs
const FEEDS: Record<string, `0x${string}`> = {
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'MNT/USD': '0x4e65f5d4b78c7ba98fd8b81e83e5e3cef31ce2d5fcfc8d0c3fbba4f37ed7d2e0',
}

const DEFAULT_ASSET = 'ETH/USD'

const account = privateKeyToAccount(config.botPrivateKey)

const publicClient = createPublicClient({
  chain: mantleSepolia,
  transport: http(config.rpcUrl),
})

const walletClient = createWalletClient({
  account,
  chain: mantleSepolia,
  transport: http(config.rpcUrl),
})

function log(msg: string) {
  console.log(`[RoundOpener][${new Date().toISOString()}] ${msg}`)
}

interface HermesResult {
  updateData: `0x${string}`[]  // MockPyth-encoded, not PNAU VAAs
  price: number                 // human-readable for logging
}

/**
 * Fetch the latest price from Hermes REST and encode it for MockPyth.
 * MockPyth accepts abi.encode(bytes32 feedId, int64 price, uint64 conf, int32 expo)
 * — NOT the binary PNAU VAA format that the old Pyth v32 requires.
 */
async function fetchAndEncode(feedId: `0x${string}`): Promise<HermesResult> {
  const url = `${HERMES_BASE}?ids[]=${feedId}&encoding=hex&parsed=true`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Hermes error: ${res.status} — ${body.slice(0, 120)}`)
  }
  const data = await res.json()

  const parsed = data.parsed?.[0]
  if (!parsed) throw new Error('No parsed price from Hermes')

  const rawPrice = BigInt(parsed.price.price)
  const conf     = BigInt(parsed.price.conf)
  const expo     = parsed.price.expo as number
  const price    = Number(rawPrice) * Math.pow(10, expo)

  const encoded = encodeAbiParameters(
    parseAbiParameters('bytes32, int64, uint64, int32'),
    [feedId, rawPrice, conf, expo],
  )

  return { updateData: [encoded], price }
}

async function pushPriceAndOpenRound(asset: string, durationSeconds: number): Promise<bigint> {
  const feedId = FEEDS[asset] as `0x${string}`
  if (!feedId) throw new Error(`Unknown asset: ${asset}`)

  log(`Fetching price for ${asset}…`)
  const { updateData, price } = await fetchAndEncode(feedId)
  log(`${asset} = $${price.toFixed(2)} — opening round via openRoundWithPrice…`)

  // MockPyth fee is always 0
  const hash = await walletClient.writeContract({
    address: config.roundManagerAddress,
    abi: ROUND_MANAGER_ABI,
    functionName: 'openRoundWithPrice',
    args: [updateData, feedId, BigInt(durationSeconds)],
    value: 0n,
    gas: 350_000n,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  log(`Round opened ✓ (${hash})`)

  // Extract roundId from the first log's topic[1]
  const roundId = BigInt(receipt.logs[0]?.topics[1] ?? '0x1')
  log(`Round #${roundId} is live`)
  return roundId
}

/**
 * pushFreshPrice — fetches the latest price from Hermes and pushes it to
 * MockPyth on-chain. Used before any contract call that reads price
 * (resolveRoundWithPrice, etc.) so getPriceNoOlderThan never throws StalePrice.
 *
 * Accepts optional client overrides so index.ts can pass its own viem clients.
 */
export async function pushFreshPrice(
  feedId: `0x${string}`,
  pubClient: PublicClient = publicClient,
  walClient: WalletClient = walletClient,
) {
  const { updateData, price } = await fetchAndEncode(feedId)

  const hash = await walClient.writeContract({
    address: MOCK_PYTH_ADDRESS,
    abi: MOCK_PYTH_ABI,
    functionName: 'updatePriceFeeds',
    args: [updateData],
    value: 0n,
    gas: 200_000n,
    account: walClient.account!,
    chain: mantleSepolia,
  })
  await pubClient.waitForTransactionReceipt({ hash })
  console.log(`[RoundOpener][${new Date().toISOString()}] MockPyth updated ✓ feed=${feedId.slice(0,10)}… price≈$${price.toFixed(2)}`)
}

/**
 * fetchMockPythUpdateData — returns encoded updateData for MockPyth without
 * pushing on-chain. Used by index.ts to build the resolveRoundWithPrice call.
 */
export async function fetchMockPythUpdateData(feedId: `0x${string}`): Promise<`0x${string}`[]> {
  const { updateData } = await fetchAndEncode(feedId)
  return updateData
}

export async function startRoundOpener(durationSeconds = 60) {
  log(`Starting round opener | interval: ${ROUND_INTERVAL_MS / 1000}s`)

  async function cycle() {
    try {
      await pushPriceAndOpenRound(DEFAULT_ASSET, durationSeconds)
    } catch (err) {
      log(`Round open failed: ${(err as Error).message}`)
    }
  }

  // Open first round immediately
  await cycle()

  // Then keep opening rounds at the interval
  setInterval(cycle, ROUND_INTERVAL_MS)
}

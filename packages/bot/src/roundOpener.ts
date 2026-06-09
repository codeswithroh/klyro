/**
 * RoundOpener — fetches fresh Pyth VAAs from Hermes, pushes them on-chain,
 * then calls RoundManager.openRound. Runs on a fixed interval so there's
 * always an active round for players to join.
 */

import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config } from './config.js'
import { mantleSepolia } from './chain.js'
import { ROUND_MANAGER_ABI } from './abis.js'

const HERMES_BASE = 'https://hermes.pyth.network/v2/updates/price/latest'
const ROUND_INTERVAL_MS = 70_000  // open a new round every ~70s (60s round + 10s buffer)

// Pyth contract address on Mantle Sepolia
const PYTH_ADDRESS = '0x98046Bd286715D3B0BC227Dd7a956b83D8978603' as const

const PYTH_ABI = [
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

async function fetchVAAs(feedIds: string[]): Promise<{ vaas: `0x${string}`[]; price: number }> {
  const idsParam = feedIds.map((id) => `ids[]=${id}`).join('&')
  const url = `${HERMES_BASE}?${idsParam}&encoding=hex&parsed=true`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Hermes error: ${res.status} — ${body.slice(0, 120)}`)
  }
  const data = await res.json()

  const vaas: `0x${string}`[] = (data.binary?.data ?? []).map((v: string) => `0x${v}` as `0x${string}`)

  // Extract ETH/USD price for logging
  const ethParsed = data.parsed?.find((p: any) =>
    p.id === feedIds[0].replace('0x', '')
  )
  const expo = ethParsed?.price?.expo ?? -8
  const rawPrice = Number(ethParsed?.price?.price ?? 0)
  const price = rawPrice * Math.pow(10, expo)

  return { vaas, price }
}

async function pushPriceAndOpenRound(asset: string, durationSeconds: number): Promise<bigint> {
  const feedId = FEEDS[asset]
  if (!feedId) throw new Error(`Unknown asset: ${asset}`)

  log(`Fetching VAAs for ${asset}…`)
  const { vaas, price } = await fetchVAAs([feedId])

  if (vaas.length === 0) throw new Error('No VAAs returned from Hermes')
  log(`Got ${vaas.length} VAA(s) | ${asset} = $${price.toFixed(2)}`)

  // Pyth fee on testnets is typically 1 wei per update.
  // getUpdateFee may revert on some RPC nodes — use 1 wei as safe fallback.
  let fee = 1n
  try {
    fee = await publicClient.readContract({
      address: PYTH_ADDRESS,
      abi: PYTH_ABI,
      functionName: 'getUpdateFee',
      args: [vaas],
    }) as bigint
  } catch {
    log('getUpdateFee unavailable, using 1 wei')
  }

  // Single-tx: push price + open round atomically via openRoundWithPrice.
  // Falls back to two-step if the deployed contract is the old one.
  log(`Opening ${asset} round via openRoundWithPrice (fee: ${fee} wei)…`)
  let receipt
  try {
    const openHash = await walletClient.writeContract({
      address: config.roundManagerAddress,
      abi: ROUND_MANAGER_ABI,
      functionName: 'openRoundWithPrice',
      args: [vaas, feedId, BigInt(durationSeconds)],
      value: fee,
      // Mantle Sepolia uses EIP-7623 calldata floor pricing — the VAA blob is
      // ~900 bytes so auto-estimated gas consistently undershoots.  600k covers
      // calldata floor + Pyth update + openRound execution with room to spare.
      gas: 350_000n,
    })
    receipt = await publicClient.waitForTransactionReceipt({ hash: openHash })
    log(`Round opened ✓ single-tx (${openHash})`)
  } catch (e: unknown) {
    const msg = (e as Error).message ?? ''
    if (msg.includes('ContractFunctionExecutionError') || msg.includes('selector') || msg.includes('not found')) {
      // Old contract — fall back to two-step
      log('openRoundWithPrice not found, falling back to two-step…')
      const updateHash = await walletClient.writeContract({
        address: PYTH_ADDRESS,
        abi: PYTH_ABI,
        functionName: 'updatePriceFeeds',
        args: [vaas],
        value: fee,
        gas: 350_000n,
      })
      await publicClient.waitForTransactionReceipt({ hash: updateHash })
      log(`Price pushed ✓ (${updateHash})`)

      log(`Opening ${asset} round (${durationSeconds}s)…`)
      const openHash = await walletClient.writeContract({
        address: config.roundManagerAddress,
        abi: ROUND_MANAGER_ABI,
        functionName: 'openRound',
        args: [feedId, BigInt(durationSeconds)],
        gas: 200_000n,
      })
      receipt = await publicClient.waitForTransactionReceipt({ hash: openHash })
      log(`Round opened ✓ two-step (${openHash})`)
    } else {
      throw e
    }
  }

  // Extract roundId from RoundOpened event log
  // Event: RoundOpened(uint256 indexed roundId, ...)
  const roundOpenedTopic = '0x' + Buffer.from('RoundOpened(uint256,bytes32,int64,uint64,uint64)').toString('hex')
  const roundId = BigInt(receipt.logs[0]?.topics[1] ?? '0x1')
  log(`Round #${roundId} is live`)
  return roundId
}

/**
 * pushFreshVAA — fetches the latest Pyth price VAA from Hermes and pushes it
 * on-chain. Used before any contract call that reads Pyth price (openRound,
 * resolveRound) so getPriceNoOlderThan never throws StalePrice.
 *
 * Accepts optional client overrides so index.ts can pass its own viem clients.
 */
export async function pushFreshVAA(
  feedId: `0x${string}`,
  pubClient: PublicClient = publicClient,
  walClient: WalletClient = walletClient,
) {
  const { vaas, price } = await fetchVAAs([feedId])
  if (vaas.length === 0) throw new Error('No VAAs from Hermes')

  let fee = 1n
  try {
    fee = await pubClient.readContract({
      address: PYTH_ADDRESS,
      abi: PYTH_ABI,
      functionName: 'getUpdateFee',
      args: [vaas],
    }) as bigint
  } catch { /* 1 wei fallback */ }

  const hash = await walClient.writeContract({
    address: PYTH_ADDRESS,
    abi: PYTH_ABI,
    functionName: 'updatePriceFeeds',
    args: [vaas],
    value: fee,
    gas: 350_000n,
    account: walClient.account!,
    chain: mantleSepolia,
  })
  await pubClient.waitForTransactionReceipt({ hash })
  console.log(`[RoundOpener][${new Date().toISOString()}] Price pushed ✓ feed=${feedId.slice(0,10)}… price≈${price.toFixed(2)}`)
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

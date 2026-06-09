/**
 * Klyro Tier 1 Bot — Axiom-7
 *
 * Watches RoundOpened events on RoundManager, waits a realistic delay,
 * then submits a momentum-based UP/DOWN prediction via lockPrediction.
 * Also polls for rounds that need resolution and calls resolveRound.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config } from './config.js'
import { mantleSepolia } from './chain.js'
import { ROUND_MANAGER_ABI } from './abis.js'
import { predictDirection } from './predictor.js'
import { startRoundOpener, pushFreshVAA } from './roundOpener.js'

// ── Clients ────────────────────────────────────────────────────────────────────

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

// ── State ──────────────────────────────────────────────────────────────────────

// roundId → closeTime (unix seconds)
const openRounds = new Map<bigint, { closeTime: bigint; feedId: `0x${string}`; submitted: boolean }>()

// ── Helpers ────────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// Random delay 2–8 seconds to simulate "thinking"
function thinkDelay() {
  return sleep(2000 + Math.random() * 6000)
}

async function submitPrediction(roundId: bigint, feedId: `0x${string}`) {
  try {
    const isUp = await predictDirection(feedId)
    log(`Round #${roundId}: predicting ${isUp ? 'UP ▲' : 'DOWN ▼'}`)

    const hash = await walletClient.writeContract({
      address: config.roundManagerAddress,
      abi: ROUND_MANAGER_ABI,
      functionName: 'lockPrediction',
      args: [roundId, isUp],
    })

    log(`Round #${roundId}: tx submitted ${hash}`)
    await publicClient.waitForTransactionReceipt({ hash })
    log(`Round #${roundId}: confirmed ✓`)
  } catch (err) {
    log(`Round #${roundId}: prediction failed — ${(err as Error).message}`)
  }
}

async function resolveIfNeeded(roundId: bigint) {
  try {
    const round = await publicClient.readContract({
      address: config.roundManagerAddress,
      abi: ROUND_MANAGER_ABI,
      functionName: 'getRound',
      args: [roundId],
    }) as unknown as { resolved: boolean; closeTime: bigint; priceFeedId: `0x${string}` }

    if (round.resolved) return

    const now = BigInt(Math.floor(Date.now() / 1000))
    if (now < round.closeTime) return

    // resolveRound calls getPriceNoOlderThan(feedId, 120) on the Pyth contract.
    // On Mantle Sepolia nobody else pushes prices, so we must refresh the feed
    // ourselves before resolving, otherwise it throws StalePrice (0x19abf40e).
    log(`Round #${roundId}: pushing fresh price before resolve…`)
    await pushFreshVAA(round.priceFeedId, publicClient, walletClient)

    log(`Round #${roundId}: resolving…`)
    const hash = await walletClient.writeContract({
      address: config.roundManagerAddress,
      abi: ROUND_MANAGER_ABI,
      functionName: 'resolveRound',
      args: [roundId],
    })
    log(`Round #${roundId}: resolve tx ${hash}`)
  } catch (err) {
    log(`Round #${roundId}: resolve failed — ${(err as Error).message}`)
  }
}

// ── Event handler ──────────────────────────────────────────────────────────────

async function handleRoundOpened(roundId: bigint, feedId: `0x${string}`, closeTime: bigint) {
  log(`RoundOpened #${roundId} | closes at ${new Date(Number(closeTime) * 1000).toISOString()}`)
  openRounds.set(roundId, { closeTime, feedId, submitted: false })

  // Wait a realistic "thinking" delay before submitting
  await thinkDelay()

  const state = openRounds.get(roundId)
  if (!state || state.submitted) return

  // Check the round is still open
  const isOpen = await publicClient.readContract({
    address: config.roundManagerAddress,
    abi: ROUND_MANAGER_ABI,
    functionName: 'isRoundOpen',
    args: [roundId],
  })

  if (!isOpen) {
    log(`Round #${roundId}: already closed, skipping`)
    return
  }

  state.submitted = true
  await submitPrediction(roundId, feedId)
}

// ── Resolve polling loop ────────────────────────────────────────────────────────

async function resolveLoop() {
  while (true) {
    await sleep(15_000) // check every 15s
    const now = BigInt(Math.floor(Date.now() / 1000))
    for (const [roundId, state] of openRounds) {
      if (now >= state.closeTime + 5n) {
        // Give 5s buffer after close time
        await resolveIfNeeded(roundId)
        if (now >= state.closeTime + 300n) {
          // Clean up rounds older than 5 minutes
          openRounds.delete(roundId)
        }
      }
    }
  }
}

// ── Startup: catch up on any open rounds ──────────────────────────────────────

async function catchUpOpenRounds() {
  const nextRoundId = await publicClient.readContract({
    address: config.roundManagerAddress,
    abi: ROUND_MANAGER_ABI,
    functionName: 'nextRoundId',
  }) as bigint

  if (nextRoundId <= 1n) return

  // Check the last 20 rounds
  const start = nextRoundId > 20n ? nextRoundId - 20n : 1n
  for (let id = start; id < nextRoundId; id++) {
    try {
      const round = await publicClient.readContract({
        address: config.roundManagerAddress,
        abi: ROUND_MANAGER_ABI,
        functionName: 'getRound',
        args: [id],
      }) as unknown as { priceFeedId: `0x${string}`; closeTime: bigint; resolved: boolean }

      if (!round.resolved) {
        const now = BigInt(Math.floor(Date.now() / 1000))
        if (now < round.closeTime) {
          // Round still open — register it for prediction
          openRounds.set(id, { closeTime: round.closeTime, feedId: round.priceFeedId, submitted: false })
          log(`Caught up: round #${id} still open`)
        } else {
          // Round closed but unresolved (e.g. from a previous bot session) — resolve it now.
          // Small delay between catchup resolutions to avoid Hermes rate-limiting.
          log(`Caught up: round #${id} closed but unresolved — resolving…`)
          await sleep(1500)
          await resolveIfNeeded(id)
        }
      }
    } catch { /* round doesn't exist yet */ }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  log(`Axiom-7 bot starting | wallet: ${account.address}`)
  log(`RoundManager: ${config.roundManagerAddress}`)

  await catchUpOpenRounds()

  // Start resolve polling in background
  resolveLoop().catch((e) => log(`resolveLoop crashed: ${e.message}`))

  // Open rounds on a fixed schedule — only when explicitly enabled.
  // Default: user opens rounds from the UI (ENABLE_AUTO_ROUND_OPENER=true to re-enable).
  if (config.enableAutoRoundOpener) {
    log('Auto round opener ENABLED — bot will open rounds every ~70s')
    startRoundOpener(60).catch((e) => log(`RoundOpener crashed: ${e.message}`))
  } else {
    log('Auto round opener DISABLED — user controls round start from UI')
  }

  // Mantle Sepolia RPC doesn't support eth_newFilter, so we poll getLogs manually.
  log('Polling for RoundOpened events every 4s…')
  await pollForRoundOpenedEvents()
}

// ── getLogs polling loop (replaces watchContractEvent) ─────────────────────────

async function pollForRoundOpenedEvents() {
  // keccak256("RoundOpened(uint256,bytes32,int64,uint64,uint64)")
  const ROUND_OPENED_TOPIC = '0x' as `0x${string}` // placeholder, computed below

  // Use encodeEventTopics from viem for correctness
  const { encodeEventTopics, parseAbiItem, decodeEventLog } = await import('viem')

  const eventAbi = parseAbiItem('event RoundOpened(uint256 indexed roundId, bytes32 priceFeedId, int64 startPrice, uint64 startTime, uint64 closeTime)')
  const [topic0] = encodeEventTopics({ abi: [eventAbi], eventName: 'RoundOpened' })

  let fromBlock = await publicClient.getBlockNumber()
  log(`Starting event poll from block ${fromBlock}`)

  while (true) {
    await sleep(4_000)
    try {
      const toBlock = await publicClient.getBlockNumber()
      if (toBlock < fromBlock) continue

      const logs = await publicClient.getLogs({
        address: config.roundManagerAddress,
        event: eventAbi,
        fromBlock,
        toBlock,
      })

      for (const l of logs) {
        const { roundId, priceFeedId, closeTime } = l.args as {
          roundId: bigint
          priceFeedId: `0x${string}`
          startPrice: bigint
          startTime: bigint
          closeTime: bigint
        }
        handleRoundOpened(roundId, priceFeedId, closeTime).catch((e) =>
          log(`handleRoundOpened error: ${e.message}`)
        )
      }

      fromBlock = toBlock + 1n
    } catch (err) {
      log(`getLogs error: ${(err as Error).message}`)
    }
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})

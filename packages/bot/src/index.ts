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
  parseAbiItem,
  type Log,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config } from './config.js'
import { mantleSepolia } from './chain.js'
import { ROUND_MANAGER_ABI } from './abis.js'
import { predictDirection } from './predictor.js'

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
    }) as { resolved: boolean; closeTime: bigint }

    if (round.resolved) return

    const now = BigInt(Math.floor(Date.now() / 1000))
    if (now < round.closeTime) return

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
      }) as { priceFeedId: `0x${string}`; closeTime: bigint; resolved: boolean }

      if (!round.resolved) {
        const now = BigInt(Math.floor(Date.now() / 1000))
        if (now < round.closeTime) {
          // Round still open — register it
          openRounds.set(id, { closeTime: round.closeTime, feedId: round.priceFeedId, submitted: false })
          log(`Caught up: round #${id} still open`)
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

  // Watch for RoundOpened events
  log('Watching for RoundOpened events…')
  publicClient.watchContractEvent({
    address: config.roundManagerAddress,
    abi: ROUND_MANAGER_ABI,
    eventName: 'RoundOpened',
    onLogs: (logs) => {
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
    },
    onError: (err) => log(`watchContractEvent error: ${err.message}`),
  })

  // Keep alive
  await new Promise(() => {})
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})

/**
 * POST /api/bot-predict
 *
 * Submits Axiom-7's prediction for an open round on-chain.
 * Called by the frontend when a new round opens, so the bot
 * always has an on-chain call without requiring a separate process.
 *
 * Body: { roundId: string, feedId: string }
 * Response: { success: boolean, direction?: 'up' | 'down', error?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createPublicClient,
  createWalletClient,
  http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const RPC_URL = process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC ?? 'https://rpc.sepolia.mantle.xyz'
const ROUND_MANAGER = process.env.NEXT_PUBLIC_ROUND_MANAGER_ADDRESS as `0x${string}` | undefined
const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY as `0x${string}` | undefined
const HERMES_BASE = 'https://hermes.pyth.network/v2/updates/price/latest'

const mantleSepolia = {
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const

// Minimal ABI for what we need
const ABI = [
  {
    name: 'lockPrediction',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [{ name: 'roundId', type: 'uint256' }, { name: 'isUp', type: 'bool' }],
    outputs: [],
  },
  {
    name: 'isRoundOpen',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [{ name: 'roundId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// Fetch ETH/USD from Hermes and return a simple prediction signal
async function computeDirection(feedId: string): Promise<boolean> {
  try {
    // Fetch 2 samples separated by a brief pause for momentum check
    const url = `${HERMES_BASE}?ids[]=${feedId}&parsed=true`

    const [r1, r2] = await Promise.all([
      fetch(url).then(r => r.json()),
      new Promise<Response>(res => setTimeout(() => res(fetch(url)), 400))
        .then(r => (r as Response).json()),
    ])

    const p1 = Number(BigInt(r1.parsed?.[0]?.price?.price ?? '0')) * Math.pow(10, r1.parsed?.[0]?.price?.expo ?? -8)
    const p2 = Number(BigInt(r2.parsed?.[0]?.price?.price ?? '0')) * Math.pow(10, r2.parsed?.[0]?.price?.expo ?? -8)

    if (p1 === 0 || p2 === 0) return Math.random() > 0.5

    // Confidence from the oracle (tight spread = more certain market)
    const conf = Number(BigInt(r2.parsed?.[0]?.price?.conf ?? '1')) * Math.pow(10, r2.parsed?.[0]?.price?.expo ?? -8)
    const relConf = conf / p2  // confidence as fraction of price

    const pctMove = (p2 - p1) / p1  // momentum signal

    // Mean-reversion: fade the move (contrarian like the bot predictor)
    const THRESHOLD = 0.00005  // 0.005% — micro-moves are noise
    let signal = 0
    if (Math.abs(pctMove) > THRESHOLD) {
      signal = -Math.sign(pctMove) * Math.min(Math.abs(pctMove) / 0.0002, 1)
    }

    // High confidence market → slight UP drift bias
    if (relConf < 0.0003) signal += 0.15

    // Add noise proportional to signal uncertainty
    signal += (Math.random() * 2 - 1) * 0.35

    return signal > 0
  } catch {
    // Fallback: random
    return Math.random() > 0.5
  }
}

// Re-introduce delay to simulate "thinking" (2–6 seconds)
function thinkDelay() {
  return new Promise<void>(res => setTimeout(res, 2000 + Math.random() * 4000))
}

export async function POST(req: NextRequest) {
  if (!ROUND_MANAGER) {
    return NextResponse.json({ success: false, error: 'ROUND_MANAGER not configured' }, { status: 500 })
  }
  if (!BOT_PRIVATE_KEY) {
    return NextResponse.json({ success: false, error: 'BOT_PRIVATE_KEY not configured' }, { status: 500 })
  }

  let roundId: bigint
  let feedId: string
  try {
    const body = await req.json()
    roundId = BigInt(body.roundId)
    feedId  = body.feedId as string
    if (!feedId || !roundId) throw new Error('missing params')
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 })
  }

  const account = privateKeyToAccount(BOT_PRIVATE_KEY)

  const publicClient = createPublicClient({
    chain: mantleSepolia as any,
    transport: http(RPC_URL),
  })

  const walletClient = createWalletClient({
    account,
    chain: mantleSepolia as any,
    transport: http(RPC_URL),
  })

  try {
    // Verify the round is still open
    const isOpen = await publicClient.readContract({
      address: ROUND_MANAGER,
      abi: ABI,
      functionName: 'isRoundOpen',
      args: [roundId],
    })

    if (!isOpen) {
      return NextResponse.json({ success: false, error: 'Round not open' }, { status: 400 })
    }

    // "Think" for a natural delay
    await thinkDelay()

    // Compute direction using multi-signal prediction
    const isUp = await computeDirection(feedId)

    // Submit on-chain
    const hash = await walletClient.writeContract({
      address: ROUND_MANAGER,
      abi: ABI,
      functionName: 'lockPrediction',
      args: [roundId, isUp],
      gas: 200_000n,
      chain: mantleSepolia as any,
      account,
    })

    await publicClient.waitForTransactionReceipt({ hash })

    console.log(`[Axiom-7] Round #${roundId}: ${isUp ? 'UP ▲' : 'DOWN ▼'} — tx ${hash}`)

    return NextResponse.json({
      success: true,
      direction: isUp ? 'up' : 'down',
      hash,
    })
  } catch (e: unknown) {
    const msg = (e as Error).message ?? ''
    // AlreadyPredicted = already submitted for this round
    if (msg.includes('AlreadyPredicted') || msg.includes('0x')) {
      return NextResponse.json({ success: false, error: 'Already predicted' }, { status: 409 })
    }
    console.error(`[Axiom-7] lockPrediction failed for round #${roundId}:`, msg)
    return NextResponse.json({ success: false, error: msg.slice(0, 200) }, { status: 500 })
  }
}

/**
 * POST /api/bot-signal
 *
 * Returns Axiom-7's direction prediction WITHOUT submitting on-chain.
 * Used by Gauntlet mode where rounds are off-chain (client-side timer).
 * Responds immediately so the calling component can apply its own think delay.
 *
 * Body: { feedId: string }
 * Response: { direction: 'up' | 'down' }
 */

import { NextRequest, NextResponse } from 'next/server'

const HERMES_BASE = 'https://hermes.pyth.network/v2/updates/price/latest'

async function computeDirection(feedId: string): Promise<'up' | 'down'> {
  try {
    // Fetch two samples ~400ms apart for micro-momentum signal
    const url = `${HERMES_BASE}?ids[]=${feedId}&parsed=true`
    const [r1, r2] = await Promise.all([
      fetch(url).then(r => r.json()),
      new Promise<Response>(res => setTimeout(() => res(fetch(url)), 400))
        .then(r => (r as Response).json()),
    ])

    const expo1 = r1.parsed?.[0]?.price?.expo ?? -8
    const expo2 = r2.parsed?.[0]?.price?.expo ?? -8
    const p1 = Number(BigInt(r1.parsed?.[0]?.price?.price ?? '0')) * Math.pow(10, expo1)
    const p2 = Number(BigInt(r2.parsed?.[0]?.price?.price ?? '0')) * Math.pow(10, expo2)

    if (p1 === 0 || p2 === 0) return Math.random() > 0.5 ? 'up' : 'down'

    // Confidence band
    const conf = Number(BigInt(r2.parsed?.[0]?.price?.conf ?? '1')) * Math.pow(10, expo2)
    const relConf = conf / p2

    // Mean-reversion signal (contrarian like the standalone bot)
    const pctMove = (p2 - p1) / p1
    const THRESHOLD = 0.00005
    let signal = 0
    if (Math.abs(pctMove) > THRESHOLD) {
      signal = -Math.sign(pctMove) * Math.min(Math.abs(pctMove) / 0.0002, 1)
    }
    if (relConf < 0.0003) signal += 0.15  // tight spread → slight UP bias

    // Noise for independence from human
    signal += (Math.random() * 2 - 1) * 0.35

    return signal > 0 ? 'up' : 'down'
  } catch {
    return Math.random() > 0.5 ? 'up' : 'down'
  }
}

export async function POST(req: NextRequest) {
  let feedId: string
  try {
    const body = await req.json()
    feedId = body.feedId as string
    if (!feedId) throw new Error('missing feedId')
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const direction = await computeDirection(feedId)
  return NextResponse.json({ direction })
}

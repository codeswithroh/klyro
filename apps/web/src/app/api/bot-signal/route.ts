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
import { fetchLivePrice } from '@/lib/priceFeed'

async function computeDirection(feedId: string): Promise<'up' | 'down'> {
  try {
    // Fetch two samples ~400ms apart for micro-momentum signal
    const [s1, s2] = await Promise.all([
      fetchLivePrice(feedId),
      new Promise<Awaited<ReturnType<typeof fetchLivePrice>>>(
        (resolve, reject) => setTimeout(() => fetchLivePrice(feedId).then(resolve, reject), 400),
      ),
    ])

    const p1 = s1.price
    const p2 = s2.price

    if (p1 === 0 || p2 === 0) return Math.random() > 0.5 ? 'up' : 'down'

    // Confidence band
    const conf = Number(s2.conf) * Math.pow(10, s2.expo)
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

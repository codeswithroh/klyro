'use client'

import { useRoundStore } from '@/lib/store/roundStore'
import { formatPrice } from '@/lib/mock/priceSimulator'
import Link from 'next/link'

const EXPLORER = 'https://explorer.sepolia.mantle.xyz'

interface RoundVerifyViewProps {
  roundId: string
}

// Mock tx hash derived from roundId — replaced with real hash in Phase B
function mockTxHash(id: string) {
  const n = parseInt(id, 10) || 4821
  return `0x${(n * 0x13f7).toString(16).padStart(8, '0')}…${(n * 0xabcd).toString(16).slice(-4)}`
}

export function RoundVerifyView({ roundId }: RoundVerifyViewProps) {
  const lastResult = useRoundStore((s) => s.lastResult)
  const storeRoundId = useRoundStore((s) => s.roundId)

  // Use lastResult if roundId matches; otherwise show a generic mock
  const isLatest = lastResult && String(lastResult.roundId) === roundId

  const rows = isLatest
    ? [
        { k: 'Asset', v: lastResult.asset },
        { k: 'Start price', v: formatPrice(lastResult.asset, lastResult.startPrice) },
        { k: 'Close price', v: formatPrice(lastResult.asset, lastResult.closePrice) },
        { k: 'Human call', v: lastResult.humanCall.toUpperCase() },
        { k: 'Agent call', v: lastResult.agentCall.toUpperCase() },
        { k: 'Outcome', v: lastResult.outcome.toUpperCase(), ok: true },
        { k: 'Tx hash', v: mockTxHash(roundId), hash: true },
        { k: 'Oracle', v: 'Pyth Network · Mantle Sepolia', hash: false },
      ]
    : [
        { k: 'Round', v: `#${roundId}` },
        { k: 'Status', v: 'Mock data — play a round to see live proof' },
        { k: 'Tx hash', v: mockTxHash(roundId), hash: true },
      ]

  return (
    <div className="min-h-screen bg-paper py-16 px-4">
      <div className="max-w-[640px] mx-auto">
        <span className="font-mono text-[12px] font-semibold tracking-[.22em] uppercase text-sig flex items-center gap-2 mb-4">
          <span className="w-[22px] h-[2px] bg-sig rounded-full" />
          Round #{roundId} · proof
        </span>
        <h1 className="font-display font-black uppercase tracking-[-0.03em] leading-[.98] mb-2"
          style={{ fontSize: 'clamp(28px, 5vw, 44px)' }}>
          On-chain<br />verification
        </h1>
        <p className="font-mono text-[11px] text-ink-3 tracking-[.06em] uppercase mb-8">
          Mock mode — all data is simulated. Real tx hashes land in Phase B.
        </p>

        <div className="bg-surface border border-line rounded-lg overflow-hidden shadow mb-6">
          {rows.map(({ k, v, ok, hash }) => (
            <div key={k} className="flex items-start justify-between gap-4 px-5 py-3.5 border-t border-line first:border-t-0 font-mono">
              <span className="text-[11px] tracking-[.1em] uppercase text-ink-3 flex-none pt-0.5">{k}</span>
              {hash ? (
                <span className="text-[12px] text-ink bg-paper border border-line rounded-[8px] px-2 py-0.5 text-right break-all">{v}</span>
              ) : (
                <span className={`text-[13px] font-semibold text-right ${ok ? 'text-up-ink' : 'text-ink'}`}>{v as string}</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          <a href={`${EXPLORER}/tx/${mockTxHash(roundId)}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold tracking-[.06em] uppercase text-white bg-sig px-5 py-3 rounded-full shadow-sig">
            View on Explorer (mock) ↗
          </a>
          <Link href="/arena"
            className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold tracking-[.06em] uppercase bg-surface text-ink border border-line-2 px-5 py-3 rounded-full">
            Back to arena
          </Link>
        </div>
      </div>
    </div>
  )
}

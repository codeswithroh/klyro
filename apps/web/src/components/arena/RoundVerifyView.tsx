'use client'

import { useReadContract } from 'wagmi'
import { CONTRACTS, PRICE_FEEDS } from '@/lib/contracts/addresses'
import { ROUND_MANAGER_ABI, PREDICTION_REGISTRY_ABI } from '@/lib/contracts/abis'
import { EXPLORER_URL } from '@/lib/contracts/chain'
import Link from 'next/link'

const CONTRACTS_LIVE = CONTRACTS.RoundManager !== '0x0000000000000000000000000000000000000000'

function feedIdToAsset(feedId: string): string {
  const entry = Object.entries(PRICE_FEEDS).find(([, v]) => v.toLowerCase() === feedId.toLowerCase())
  return entry ? entry[0] : feedId.slice(0, 10) + '…'
}

function formatOnChainPrice(raw: bigint | number): string {
  // Pyth prices for ETH/USD come as int64 with expo=-8 → divide by 1e8
  const n = Number(raw)
  return `$${(n / 1e8).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface RoundVerifyViewProps {
  roundId: string
}

export function RoundVerifyView({ roundId }: RoundVerifyViewProps) {
  const roundIdBig = BigInt(roundId)

  const { data: round, isLoading } = useReadContract({
    address: CONTRACTS.RoundManager as `0x${string}`,
    abi: ROUND_MANAGER_ABI,
    functionName: 'getRound',
    args: [roundIdBig],
    query: { enabled: CONTRACTS_LIVE },
  })

  const rows = CONTRACTS_LIVE && round ? [
    { k: 'Asset',       v: feedIdToAsset((round as any).priceFeedId) },
    { k: 'Start price', v: formatOnChainPrice((round as any).startPrice) },
    { k: 'Close price', v: (round as any).resolved ? formatOnChainPrice((round as any).closePrice) : 'Pending…' },
    { k: 'Outcome',     v: (round as any).resolved ? ((round as any).outcome ? '▲ UP' : '▼ DOWN') : 'Pending…', ok: (round as any).resolved },
    { k: 'Resolved',    v: (round as any).resolved ? 'Yes' : 'No' },
    { k: 'Close time',  v: new Date(Number((round as any).closeTime) * 1000).toISOString() },
  ] : [
    { k: 'Status', v: CONTRACTS_LIVE ? (isLoading ? 'Loading…' : 'Round not found') : 'Contracts not yet deployed' },
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
        {!CONTRACTS_LIVE && (
          <p className="font-mono text-[11px] text-ink-3 tracking-[.06em] uppercase mb-6">
            Contracts deploying — check back after deployment.
          </p>
        )}

        <div className="bg-surface border border-line rounded-lg overflow-hidden shadow mb-6">
          {rows.map(({ k, v, ok }) => (
            <div key={k} className="flex items-start justify-between gap-4 px-5 py-3.5 border-t border-line first:border-t-0 font-mono">
              <span className="text-[11px] tracking-[.1em] uppercase text-ink-3 flex-none pt-0.5">{k}</span>
              <span className={`text-[13px] font-semibold text-right ${ok ? 'text-up-ink' : 'text-ink'}`}>{v as string}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          {CONTRACTS_LIVE && (
            <a href={`${EXPLORER_URL}/address/${CONTRACTS.RoundManager}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold tracking-[.06em] uppercase text-white bg-sig px-5 py-3 rounded-full shadow-sig">
              View contract on Mantle ↗
            </a>
          )}
          <Link href="/arena"
            className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold tracking-[.06em] uppercase bg-surface text-ink border border-line-2 px-5 py-3 rounded-full">
            Back to arena
          </Link>
        </div>
      </div>
    </div>
  )
}

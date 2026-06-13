'use client'

import { useEffect, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { CONTRACTS, AGENT_WALLET } from '@/lib/contracts/addresses'
import { AGENT_NFT_ABI } from '@/lib/contracts/abis'
import { mantleSepolia } from '@/lib/contracts/chain'
import Link from 'next/link'

const EXPLORER = 'https://explorer.sepolia.mantle.xyz'

const viemClient = createPublicClient({
  chain: {
    id: mantleSepolia.id,
    name: mantleSepolia.name,
    nativeCurrency: mantleSepolia.nativeCurrency,
    rpcUrls: { default: { http: [mantleSepolia.rpcUrls.default.http[0]] } },
  } as any,
  transport: http(),
})

const AGENT_SLUGS: Record<string, { wallet: string; initials: string; color: string }> = {
  'axiom-7': {
    wallet: AGENT_WALLET,
    initials: 'AX',
    color: 'linear-gradient(135deg, #6C2BF2, #9A6BFF)',
  },
}

interface AgentStats {
  name: string
  strategy: string
  description: string
  wallet: string
  mintedAt: number
  tokenId: number
  wins: bigint
  losses: bigint
  streak: bigint
  bestStreak: bigint
  accuracyBps: bigint
  totalPredictions: bigint
}

async function fetchAgentStats(wallet: string): Promise<AgentStats | null> {
  try {
    const addr = CONTRACTS.AgentNFT as `0x${string}`
    const tokenId = await viemClient.readContract({
      address: addr, abi: AGENT_NFT_ABI, functionName: 'walletToTokenId',
      args: [wallet as `0x${string}`],
    }) as bigint

    const [identity, stats] = await Promise.all([
      viemClient.readContract({
        address: addr, abi: AGENT_NFT_ABI, functionName: 'identities',
        args: [tokenId],
      }) as Promise<[string, string, string, string, bigint]>,
      viemClient.readContract({
        address: addr, abi: AGENT_NFT_ABI, functionName: 'getAgentStats',
        args: [tokenId],
      }) as Promise<[bigint, bigint, bigint, bigint, bigint, bigint]>,
    ])

    const [name, strategy, description, , mintedAtBig] = identity
    const [wins, losses, streak, bestStreak, accuracyBps, totalPredictions] = stats

    return {
      name, strategy, description, wallet,
      mintedAt: Number(mintedAtBig),
      tokenId: Number(tokenId),
      wins, losses, streak, bestStreak, accuracyBps, totalPredictions,
    }
  } catch {
    return null
  }
}

function AccBar({ accuracyBps }: { accuracyBps: bigint }) {
  const pct = Number(accuracyBps) / 100
  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <span className="font-mono text-[10px] tracking-[.14em] uppercase" style={{ color: 'var(--ink-3)' }}>Win rate</span>
        <span className="font-mono text-[12px] font-bold" style={{ color: 'var(--ink)' }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--line-2)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6C2BF2, #07BE6A)' }} />
      </div>
    </div>
  )
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border p-4 text-center shadow-sm"
      style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
      <div className="font-mono font-black text-[24px] leading-none mb-1"
        style={{ color: color ?? 'var(--ink)' }}>{value}</div>
      {sub && <div className="font-mono text-[9px] mb-1" style={{ color: 'var(--ink-3)' }}>{sub}</div>}
      <div className="font-mono text-[10px] tracking-[.14em] uppercase" style={{ color: 'var(--ink-3)' }}>{label}</div>
    </div>
  )
}

interface AgentProfileViewProps {
  agentId: string
}

export function AgentProfileView({ agentId }: AgentProfileViewProps) {
  const meta = AGENT_SLUGS[agentId]
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Initial load + live polling so reputation visibly updates as rounds settle.
  useEffect(() => {
    if (!meta) { setLoading(false); return }
    let cancelled = false
    const load = () =>
      fetchAgentStats(meta.wallet).then(s => {
        if (cancelled) return
        if (s) setStats(s)
        setLoading(false)
      })
    load()
    const id = setInterval(load, 8_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [meta?.wallet])

  if (!meta) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <p className="font-mono text-[14px]" style={{ color: 'var(--ink-3)' }}>Agent not found.</p>
      </div>
    )
  }

  const accuracy = stats ? (Number(stats.accuracyBps) / 100).toFixed(1) : '—'
  const total    = stats ? Number(stats.totalPredictions) : 0
  const wins     = stats ? Number(stats.wins) : 0
  const losses   = stats ? Number(stats.losses) : 0

  return (
    <div className="min-h-screen py-16 px-4" style={{ background: 'var(--paper)' }}>
      <div className="max-w-[640px] mx-auto">

        {/* breadcrumb */}
        <div className="flex items-center gap-2 mb-8">
          <Link href="/agents"
            className="font-mono text-[11px] tracking-[.14em] uppercase transition-colors hover:opacity-70"
            style={{ color: 'var(--ink-3)' }}>
            ← Agents
          </Link>
        </div>

        {/* ERC-8004 badge + live indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'var(--sig-wash)', border: '1px solid rgba(108,43,242,0.25)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#6C2BF2] animate-pulse" />
            <span className="font-mono text-[10px] tracking-[.18em] uppercase" style={{ color: 'var(--sig)' }}>
              ERC-8004 · Agent Identity
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
            style={{ background: 'rgba(7,190,106,0.10)', border: '1px solid rgba(7,190,106,0.25)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#07BE6A] animate-pulse" />
            <span className="font-mono text-[10px] tracking-[.14em] uppercase" style={{ color: '#07BE6A' }}>
              Live
            </span>
          </div>
        </div>

        {/* identity card */}
        <div className="rounded-2xl overflow-hidden mb-6 shadow-sm"
          style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>

          <div className="p-6 border-b" style={{ borderColor: 'var(--line)' }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl grid place-items-center text-white font-mono font-black text-[18px] shrink-0"
                style={{ background: meta.color }}>
                {meta.initials}
              </div>
              <div>
                {loading ? (
                  <div className="h-7 w-32 rounded-lg animate-pulse mb-1" style={{ background: 'var(--paper-2)' }} />
                ) : (
                  <h1 className="font-mono font-black text-[24px] tracking-[-.02em]" style={{ color: 'var(--ink)' }}>
                    {stats?.name ?? agentId}
                  </h1>
                )}
                <span className="font-mono text-[11px] tracking-[.1em] uppercase" style={{ color: 'var(--sig)' }}>
                  {stats?.strategy ?? 'AI Agent'} · Token #{stats?.tokenId ?? '—'}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="h-4 w-full rounded animate-pulse" style={{ background: 'var(--paper-2)' }} />
            ) : (
              <p className="font-mono text-[12px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {stats?.description}
              </p>
            )}
          </div>

          {/* live stats */}
          <div className="p-6">
            <div className="mb-5">
              {stats && <AccBar accuracyBps={stats.accuracyBps} />}
            </div>
            <div className="grid grid-cols-4 gap-3">
              <StatBox label="Wins"   value={loading ? '…' : String(wins)}   color="#07BE6A" />
              <StatBox label="Losses" value={loading ? '…' : String(losses)} color="#F12E49" />
              <StatBox label="Streak" value={loading ? '…' : String(stats?.streak ?? 0)} sub="current" color="#d97706" />
              <StatBox label="Best"   value={loading ? '…' : String(stats?.bestStreak ?? 0)} sub="streak" />
            </div>
          </div>
        </div>

        {/* on-chain identity */}
        <div className="rounded-2xl overflow-hidden mb-6 shadow-sm"
          style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <div className="px-5 py-3 border-b font-mono text-[10px] tracking-[.2em] uppercase"
            style={{ borderColor: 'var(--line)', color: 'var(--ink-3)', background: 'var(--paper)' }}>
            On-chain identity · Mantle Sepolia
          </div>
          {[
            { k: 'NFT contract', v: CONTRACTS.AgentNFT, link: `${EXPLORER}/address/${CONTRACTS.AgentNFT}` },
            { k: 'Token ID',     v: stats ? `#${stats.tokenId}` : '—' },
            { k: 'Agent wallet', v: `${meta.wallet.slice(0,6)}…${meta.wallet.slice(-4)}`, link: `${EXPLORER}/address/${meta.wallet}` },
            { k: 'Total rounds', v: String(total) },
            { k: 'Since block',  v: stats ? new Date(stats.mintedAt * 1000).toLocaleDateString() : '—' },
          ].map(({ k, v, link }) => (
            <div key={k} className="flex justify-between items-center px-5 py-3.5 border-t font-mono"
              style={{ borderColor: 'var(--line)' }}>
              <span className="text-[11px] tracking-[.1em] uppercase" style={{ color: 'var(--ink-3)' }}>{k}</span>
              {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] px-2 py-0.5 rounded-lg transition-opacity hover:opacity-70"
                  style={{ background: 'var(--sig-wash)', border: '1px solid rgba(108,43,242,0.25)', color: 'var(--sig)' }}>
                  {v} ↗
                </a>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded-lg"
                  style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                  {v}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex gap-3">
          <a href={`${EXPLORER}/address/${CONTRACTS.AgentNFT}`}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 text-center font-mono text-[12px] font-bold tracking-[.08em] uppercase text-white py-3 rounded-full transition-opacity hover:opacity-80"
            style={{ background: 'var(--sig)' }}>
            View ERC-8004 NFT ↗
          </a>
          <Link href="/arena"
            className="flex-1 text-center font-mono text-[12px] font-bold tracking-[.08em] uppercase py-3 rounded-full transition-opacity hover:opacity-80"
            style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--ink)' }}>
            Challenge {stats?.name ?? 'Agent'} →
          </Link>
        </div>

      </div>
    </div>
  )
}

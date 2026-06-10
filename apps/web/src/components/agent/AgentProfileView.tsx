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

// Known agents — keyed by the slug used in the URL
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
        <span className="font-mono text-[10px] tracking-[.14em] uppercase text-white/40">Win rate</span>
        <span className="font-mono text-[12px] font-bold text-white">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6C2BF2, #00ff9d)' }} />
      </div>
    </div>
  )
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border p-4 text-center"
      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="font-mono font-black text-[24px] leading-none mb-1" style={{ color: color ?? 'white' }}>{value}</div>
      {sub && <div className="font-mono text-[9px] text-white/25 mb-1">{sub}</div>}
      <div className="font-mono text-[10px] tracking-[.14em] uppercase text-white/40">{label}</div>
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

  useEffect(() => {
    if (!meta) { setLoading(false); return }
    fetchAgentStats(meta.wallet).then(s => { setStats(s); setLoading(false) })
  }, [meta?.wallet])

  if (!meta) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050508' }}>
        <p className="font-mono text-white/30 text-[14px]">Agent not found.</p>
      </div>
    )
  }

  const accuracy = stats ? (Number(stats.accuracyBps) / 100).toFixed(1) : '—'
  const total    = stats ? Number(stats.totalPredictions) : 0
  const wins     = stats ? Number(stats.wins) : 0
  const losses   = stats ? Number(stats.losses) : 0

  return (
    <div className="min-h-screen py-16 px-4" style={{ background: '#050508' }}>
      <div className="max-w-[640px] mx-auto">

        {/* breadcrumb */}
        <div className="flex items-center gap-2 mb-8">
          <Link href="/agents" className="font-mono text-[11px] tracking-[.14em] uppercase text-white/30 hover:text-white/60 transition-colors">
            ← Agents
          </Link>
        </div>

        {/* ERC-8004 badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
          style={{ background: 'rgba(108,43,242,0.15)', border: '1px solid rgba(108,43,242,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#6C2BF2] animate-pulse" />
          <span className="font-mono text-[10px] tracking-[.18em] uppercase text-[#9A6BFF]">ERC-8004 · Agent Identity</span>
        </div>

        {/* identity card */}
        <div className="rounded-2xl overflow-hidden mb-6"
          style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>

          <div className="p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl grid place-items-center text-white font-mono font-black text-[18px] shrink-0"
                style={{ background: meta.color }}>
                {meta.initials}
              </div>
              <div>
                {loading ? (
                  <div className="h-7 w-32 rounded-lg animate-pulse mb-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
                ) : (
                  <h1 className="font-mono font-black text-[24px] tracking-[-.02em] text-white">{stats?.name ?? agentId}</h1>
                )}
                <span className="font-mono text-[11px] tracking-[.1em] uppercase text-[#6C2BF2]">
                  {stats?.strategy ?? 'AI Agent'} · Token #{stats?.tokenId ?? '—'}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="h-4 w-full rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
            ) : (
              <p className="font-mono text-[12px] text-white/40 leading-relaxed">{stats?.description}</p>
            )}
          </div>

          {/* live stats */}
          <div className="p-6">
            <div className="mb-5">
              {stats && <AccBar accuracyBps={stats.accuracyBps} />}
            </div>
            <div className="grid grid-cols-4 gap-3">
              <StatBox label="Wins"       value={loading ? '…' : String(wins)}    color="#10b981" />
              <StatBox label="Losses"     value={loading ? '…' : String(losses)}  color="#f43f5e" />
              <StatBox label="Streak"     value={loading ? '…' : String(stats?.streak ?? 0)} sub="current" color="#fbbf24" />
              <StatBox label="Best"       value={loading ? '…' : String(stats?.bestStreak ?? 0)} sub="streak"  />
            </div>
          </div>
        </div>

        {/* on-chain identity */}
        <div className="rounded-2xl overflow-hidden mb-6"
          style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="px-5 py-3 border-b font-mono text-[10px] tracking-[.2em] uppercase text-white/30"
            style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
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
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <span className="text-[11px] tracking-[.1em] uppercase text-white/30">{k}</span>
              {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] px-2 py-0.5 rounded-lg text-[#9A6BFF] hover:text-white transition-colors"
                  style={{ background: 'rgba(108,43,242,0.15)', border: '1px solid rgba(108,43,242,0.25)' }}>
                  {v} ↗
                </a>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded-lg text-white/60"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
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
            style={{ background: 'linear-gradient(135deg, #6C2BF2, #9A6BFF)' }}>
            View ERC-8004 NFT ↗
          </a>
          <Link href="/arena"
            className="flex-1 text-center font-mono text-[12px] font-bold tracking-[.08em] uppercase py-3 rounded-full transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
            Challenge {stats?.name ?? 'Agent'} →
          </Link>
        </div>

      </div>
    </div>
  )
}

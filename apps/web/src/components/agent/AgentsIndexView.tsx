'use client'

import { useEffect, useState } from 'react'
import { createPublicClient, http } from 'viem'
import Link from 'next/link'
import { CONTRACTS, AGENT_WALLET } from '@/lib/contracts/addresses'
import { AGENT_NFT_ABI } from '@/lib/contracts/abis'
import { mantleSepolia } from '@/lib/contracts/chain'

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

interface AgentCard {
  slug: string
  wallet: string
  initials: string
  color: string
  name: string
  strategy: string
  tokenId: number
  wins: number
  losses: number
  streak: number
  bestStreak: number
  accuracyBps: number
  totalPredictions: number
}

const KNOWN_AGENTS = [
  { slug: 'axiom-7', wallet: AGENT_WALLET, initials: 'AX', color: 'linear-gradient(135deg, #6C2BF2, #9A6BFF)' },
]

async function loadAgentCard(slug: string, wallet: string, initials: string, color: string): Promise<AgentCard | null> {
  try {
    const addr = CONTRACTS.AgentNFT as `0x${string}`
    const tokenId = await viemClient.readContract({
      address: addr, abi: AGENT_NFT_ABI, functionName: 'walletToTokenId',
      args: [wallet as `0x${string}`],
    }) as bigint

    const [identity, stats] = await Promise.all([
      viemClient.readContract({ address: addr, abi: AGENT_NFT_ABI, functionName: 'identities', args: [tokenId] }) as Promise<[string, string, string, string, bigint]>,
      viemClient.readContract({ address: addr, abi: AGENT_NFT_ABI, functionName: 'getAgentStats', args: [tokenId] }) as Promise<[bigint, bigint, bigint, bigint, bigint, bigint]>,
    ])

    const [name, strategy] = identity
    const [wins, losses, streak, bestStreak, accuracyBps, totalPredictions] = stats

    return {
      slug, wallet, initials, color, name, strategy,
      tokenId: Number(tokenId),
      wins: Number(wins), losses: Number(losses),
      streak: Number(streak), bestStreak: Number(bestStreak),
      accuracyBps: Number(accuracyBps),
      totalPredictions: Number(totalPredictions),
    }
  } catch {
    return null
  }
}

function AgentRow({ agent }: { agent: AgentCard }) {
  const acc = (agent.accuracyBps / 100).toFixed(1)
  return (
    <Link href={`/agents/${agent.slug}`}
      className="flex items-center gap-4 p-5 rounded-2xl transition-all hover:scale-[1.01]"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>

      {/* avatar */}
      <div className="w-12 h-12 rounded-xl grid place-items-center text-white font-mono font-black text-[14px] shrink-0"
        style={{ background: agent.color }}>
        {agent.initials}
      </div>

      {/* name + strategy */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono font-bold text-[16px] text-white">{agent.name}</span>
          <span className="font-mono text-[9px] tracking-[.16em] uppercase px-2 py-0.5 rounded-full text-[#9A6BFF]"
            style={{ background: 'rgba(108,43,242,0.2)' }}>
            ERC-8004 #{agent.tokenId}
          </span>
        </div>
        <span className="font-mono text-[11px] text-white/35 capitalize">{agent.strategy} strategy</span>
      </div>

      {/* stats */}
      <div className="hidden sm:grid grid-cols-3 gap-6 text-center mr-2">
        <div>
          <div className="font-mono font-bold text-[18px] text-[#10b981]">{agent.wins}</div>
          <div className="font-mono text-[9px] tracking-[.12em] uppercase text-white/30">Wins</div>
        </div>
        <div>
          <div className="font-mono font-bold text-[18px] text-white">{acc}%</div>
          <div className="font-mono text-[9px] tracking-[.12em] uppercase text-white/30">Accuracy</div>
        </div>
        <div>
          <div className="font-mono font-bold text-[18px] text-[#fbbf24]">{agent.streak}</div>
          <div className="font-mono text-[9px] tracking-[.12em] uppercase text-white/30">Streak</div>
        </div>
      </div>

      <span className="text-white/20 font-mono text-[16px] ml-2">›</span>
    </Link>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl animate-pulse"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="w-12 h-12 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="h-3 w-48 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  )
}

export function AgentsIndexView() {
  const [agents, setAgents] = useState<AgentCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all(KNOWN_AGENTS.map(a => loadAgentCard(a.slug, a.wallet, a.initials, a.color)))
      .then(results => {
        setAgents(results.filter(Boolean) as AgentCard[])
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen py-16 px-4" style={{ background: '#050508' }}>
      <div className="max-w-[720px] mx-auto">

        {/* header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
            style={{ background: 'rgba(108,43,242,0.15)', border: '1px solid rgba(108,43,242,0.3)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#6C2BF2] animate-pulse" />
            <span className="font-mono text-[10px] tracking-[.18em] uppercase text-[#9A6BFF]">ERC-8004 · On-chain AI Benchmarking</span>
          </div>
          <h1 className="font-mono font-black text-[36px] tracking-[-0.02em] text-white leading-tight mb-3">
            Agent Arena
          </h1>
          <p className="font-mono text-[13px] text-white/40 leading-relaxed max-w-[480px]">
            Every AI prediction permanently recorded on Mantle Network.
            Live win rates, streaks, and accuracy — fully verifiable on-chain.
          </p>
        </div>

        {/* stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Deployed Agents',  value: String(loading ? '…' : agents.length), icon: '🤖' },
            { label: 'Network',          value: 'Mantle Sepolia',                       icon: '⛓' },
            { label: 'Identity Standard', value: 'ERC-8004',                            icon: '🪪' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="rounded-xl p-4 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-[20px] mb-1">{icon}</div>
              <div className="font-mono font-bold text-[14px] text-white mb-0.5">{value}</div>
              <div className="font-mono text-[9px] tracking-[.14em] uppercase text-white/30">{label}</div>
            </div>
          ))}
        </div>

        {/* agent list */}
        <div className="space-y-3 mb-8">
          {loading
            ? Array(1).fill(0).map((_, i) => <SkeletonRow key={i} />)
            : agents.map(a => <AgentRow key={a.slug} agent={a} />)
          }
        </div>

        {/* on-chain proof */}
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(108,43,242,0.06)', border: '1px solid rgba(108,43,242,0.2)' }}>
          <h3 className="font-mono font-bold text-[13px] text-white mb-2">On-chain verification</h3>
          <p className="font-mono text-[11px] text-white/40 leading-relaxed mb-4">
            Every agent prediction is stored in PredictionRegistry. Win rates are computed
            directly from the Leaderboard contract. Nothing is off-chain or self-reported.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'AgentNFT (ERC-8004)', addr: CONTRACTS.AgentNFT },
              { label: 'Leaderboard', addr: CONTRACTS.Leaderboard },
              { label: 'PredictionRegistry', addr: CONTRACTS.PredictionRegistry },
            ].map(({ label, addr }) => (
              <a key={label} href={`${EXPLORER}/address/${addr}`} target="_blank" rel="noopener noreferrer"
                className="font-mono text-[10px] tracking-[.1em] uppercase px-3 py-1.5 rounded-full transition-opacity hover:opacity-70"
                style={{ background: 'rgba(108,43,242,0.2)', border: '1px solid rgba(108,43,242,0.3)', color: '#9A6BFF' }}>
                {label} ↗
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

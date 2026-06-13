'use client'

/**
 * BenchmarkView — "The Turing Test, settled on-chain."
 *
 * A live, verifiable Human-vs-AI benchmark. Every Arena round permanently
 * records both the human's and Axiom-7's prediction to the on-chain
 * Leaderboard; the agent's reputation lives in its ERC-8004 identity NFT,
 * which reads those stats live. This page aggregates the Leaderboard into a
 * head-to-head: all humans vs the autonomous agent, refreshed every few
 * seconds so the benchmark visibly moves as battles settle.
 *
 * Reads only — no writes. Cannot affect Arena / Gauntlet gameplay.
 */

import { useEffect, useState, useCallback } from 'react'
import { createPublicClient, http } from 'viem'
import { CONTRACTS, AGENT_WALLET } from '@/lib/contracts/addresses'
import { LEADERBOARD_ABI, AGENT_NFT_ABI } from '@/lib/contracts/abis'
import { mantleSepolia } from '@/lib/contracts/chain'
import Link from 'next/link'

const EXPLORER = 'https://explorer.sepolia.mantle.xyz'
const REFRESH_MS = 5_000

const viemClient = createPublicClient({
  chain: {
    id: mantleSepolia.id,
    name: mantleSepolia.name,
    nativeCurrency: mantleSepolia.nativeCurrency,
    rpcUrls: { default: { http: [mantleSepolia.rpcUrls.default.http[0]] } },
  } as any,
  transport: http(),
})

interface Side {
  wins: number
  losses: number
  total: number
  accBps: number   // win rate in basis points
}

interface Bench {
  agent:  Side & { streak: number; bestStreak: number }
  humans: Side & { players: number }
  totalPredictions: number
}

function accBps(wins: number, losses: number): number {
  const t = wins + losses
  return t === 0 ? 0 : Math.round((wins * 10_000) / t)
}

async function fetchBench(): Promise<Bench | null> {
  try {
    const lb = CONTRACTS.Leaderboard as `0x${string}`
    const addresses = (await viemClient.readContract({
      address: lb, abi: LEADERBOARD_ABI, functionName: 'getAllPlayers',
    })) as `0x${string}`[]

    const players = await Promise.all(
      addresses.map((addr) =>
        viemClient.readContract({
          address: lb, abi: LEADERBOARD_ABI, functionName: 'getPlayer', args: [addr],
        }) as Promise<{ points: bigint; wins: bigint; losses: bigint; streak: bigint; bestStreak: bigint }>,
      ),
    )

    const agentAddr = AGENT_WALLET.toLowerCase()
    let aW = 0, aL = 0, aStreak = 0, aBest = 0
    let hW = 0, hL = 0, hPlayers = 0

    addresses.forEach((addr, i) => {
      const p = players[i]
      const w = Number(p.wins), l = Number(p.losses)
      if (addr.toLowerCase() === agentAddr) {
        aW = w; aL = l; aStreak = Number(p.streak); aBest = Number(p.bestStreak)
      } else if (w + l > 0) {
        hW += w; hL += l; hPlayers += 1
      }
    })

    return {
      agent:  { wins: aW, losses: aL, total: aW + aL, accBps: accBps(aW, aL), streak: aStreak, bestStreak: aBest },
      humans: { wins: hW, losses: hL, total: hW + hL, accBps: accBps(hW, hL), players: hPlayers },
      totalPredictions: aW + aL + hW + hL,
    }
  } catch {
    return null
  }
}

// ── Small UI atoms ───────────────────────────────────────────────────────────

function LiveDot() {
  return <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#07BE6A] animate-pulse" />
}

function ContractRow({ k, v, link }: { k: string; v: string; link?: string }) {
  return (
    <div className="flex justify-between items-center px-5 py-3.5 border-t font-mono"
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
  )
}

// ── Combatant column ─────────────────────────────────────────────────────────

function Combatant({
  label, sub, color, accent, accPct, wins, losses, total, leading, loading,
}: {
  label: string; sub: string; color: string; accent: string
  accPct: string; wins: number; losses: number; total: number
  leading: boolean; loading: boolean
}) {
  return (
    <div className="flex-1 text-center relative">
      {leading && !loading && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[8px] uppercase tracking-[.16em] px-2 py-0.5 rounded-full"
          style={{ background: accent, color: '#fff' }}>
          Leading
        </div>
      )}
      <div className="w-14 h-14 mx-auto rounded-2xl grid place-items-center text-white font-mono font-black text-[16px] mb-3"
        style={{ background: color }}>
        {label === 'Humanity' ? '🌍' : 'AX'}
      </div>
      <div className="font-mono font-bold text-[14px]" style={{ color: 'var(--ink)' }}>{label}</div>
      <div className="font-mono text-[10px] mb-3" style={{ color: 'var(--ink-3)' }}>{sub}</div>
      <div className="font-display font-black leading-none mb-1"
        style={{ fontSize: 42, color: loading ? 'var(--ink-3)' : accent }}>
        {loading ? '…' : accPct}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[.14em] mb-3" style={{ color: 'var(--ink-3)' }}>
        win rate
      </div>
      <div className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
        <span style={{ color: '#07BE6A', fontWeight: 700 }}>{wins}W</span>
        {' · '}
        <span style={{ color: '#F12E49', fontWeight: 700 }}>{losses}L</span>
      </div>
      <div className="font-mono text-[9px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
        {total} on-chain predictions
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function BenchmarkView() {
  const [bench, setBench]     = useState<Bench | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [secsAgo, setSecsAgo] = useState(0)

  const refresh = useCallback(async () => {
    const b = await fetchBench()
    if (b) { setBench(b); setUpdatedAt(Date.now()) }
    setLoading(false)
  }, [])

  // Poll on an interval so the benchmark moves as rounds settle.
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  // "Updated Xs ago" ticker
  useEffect(() => {
    if (updatedAt === null) return
    const id = setInterval(() => setSecsAgo(Math.floor((Date.now() - updatedAt) / 1000)), 1_000)
    return () => clearInterval(id)
  }, [updatedAt])

  const agent  = bench?.agent
  const humans = bench?.humans
  const agentPct  = agent  ? (agent.accBps  / 100).toFixed(1) + '%' : '—'
  const humanPct  = humans ? (humans.accBps / 100).toFixed(1) + '%' : '—'
  const agentLeads = !!agent && !!humans && agent.total > 0 && humans.total > 0 && agent.accBps > humans.accBps
  const humanLeads = !!agent && !!humans && agent.total > 0 && humans.total > 0 && humans.accBps > agent.accBps

  return (
    <div className="min-h-screen py-14 px-4" style={{ background: 'var(--paper)' }}>
      <div className="max-w-[640px] mx-auto">

        {/* badge row */}
        <div className="flex items-center justify-between mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'var(--sig-wash)', border: '1px solid rgba(108,43,242,0.25)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#6C2BF2] animate-pulse" />
            <span className="font-mono text-[10px] tracking-[.18em] uppercase" style={{ color: 'var(--sig)' }}>
              ERC-8004 · On-chain Benchmark
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 font-mono text-[10px]" style={{ color: 'var(--ink-3)' }}>
            <LiveDot />
            {updatedAt === null ? 'connecting…' : `live · updated ${secsAgo}s ago`}
          </div>
        </div>

        {/* hero */}
        <h1 className="font-mono font-black text-[30px] tracking-[-0.02em] leading-tight mb-2"
          style={{ color: 'var(--ink)' }}>
          The Turing Test, settled on-chain.
        </h1>
        <p className="font-mono text-[13px] leading-relaxed mb-8 max-w-[520px]"
          style={{ color: 'var(--ink-2)' }}>
          Every Klyro round pits a human against <span style={{ color: 'var(--sig)', fontWeight: 600 }}>Axiom-7</span>,
          an autonomous AI agent. Both predictions are permanently recorded on Mantle and scored against the real
          Pyth price. This is the live, verifiable benchmark — who reads the market better?
        </p>

        {/* head-to-head */}
        <div className="rounded-2xl p-6 mb-5 shadow-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <div className="flex items-stretch gap-2">
            <Combatant
              label="Humanity" sub={`${humans?.players ?? 0} players`}
              color="linear-gradient(135deg,#0ea5e9,#22d3ee)" accent="#0ea5e9"
              accPct={humanPct} wins={humans?.wins ?? 0} losses={humans?.losses ?? 0}
              total={humans?.total ?? 0} leading={humanLeads} loading={loading}
            />
            <div className="flex flex-col items-center justify-center px-1">
              <span className="font-display font-black text-[20px]" style={{ color: 'var(--ink-3)' }}>VS</span>
            </div>
            <Combatant
              label="Axiom-7" sub="contrarian AI"
              color="linear-gradient(135deg,#6C2BF2,#9A6BFF)" accent="#6C2BF2"
              accPct={agentPct} wins={agent?.wins ?? 0} losses={agent?.losses ?? 0}
              total={agent?.total ?? 0} leading={agentLeads} loading={loading}
            />
          </div>

          {/* verdict line */}
          <div className="mt-6 pt-4 border-t text-center font-mono text-[11px]"
            style={{ borderColor: 'var(--line)', color: 'var(--ink-2)' }}>
            {loading ? 'Reading the chain…'
              : agentLeads ? '🤖 The machine is ahead. Humanity needs a comeback.'
              : humanLeads ? '🌍 Humans are out-predicting the AI — for now.'
              : (agent?.total ?? 0) === 0 ? 'No on-chain rounds yet. Play the Arena to seed the benchmark.'
              : '⚖️ Dead even. The next round breaks the tie.'}
          </div>
        </div>

        {/* stat row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Predictions benchmarked', value: loading ? '…' : String(bench?.totalPredictions ?? 0), color: 'var(--ink)' },
            { label: 'Axiom-7 streak', value: loading ? '…' : String(agent?.streak ?? 0), sub: `best ${agent?.bestStreak ?? 0}`, color: '#d97706' },
            { label: 'Humans tracked', value: loading ? '…' : String(humans?.players ?? 0), color: '#0ea5e9' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border p-4 text-center shadow-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
              <div className="font-mono font-black text-[24px] leading-none mb-1" style={{ color: s.color }}>{s.value}</div>
              {s.sub && <div className="font-mono text-[9px] mb-1" style={{ color: 'var(--ink-3)' }}>{s.sub}</div>}
              <div className="font-mono text-[9px] tracking-[.12em] uppercase" style={{ color: 'var(--ink-3)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* verifiable on-chain */}
        <div className="rounded-2xl overflow-hidden mb-5 shadow-sm"
          style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <div className="px-5 py-3 font-mono text-[10px] tracking-[.2em] uppercase"
            style={{ color: 'var(--ink-3)', background: 'var(--paper)' }}>
            Verifiable on Mantle Sepolia
          </div>
          <ContractRow k="ERC-8004 AgentNFT" v={`${CONTRACTS.AgentNFT.slice(0,6)}…${CONTRACTS.AgentNFT.slice(-4)}`} link={`${EXPLORER}/address/${CONTRACTS.AgentNFT}`} />
          <ContractRow k="Leaderboard"       v={`${CONTRACTS.Leaderboard.slice(0,6)}…${CONTRACTS.Leaderboard.slice(-4)}`} link={`${EXPLORER}/address/${CONTRACTS.Leaderboard}`} />
          <ContractRow k="Axiom-7 wallet"    v={`${AGENT_WALLET.slice(0,6)}…${AGENT_WALLET.slice(-4)}`} link={`${EXPLORER}/address/${AGENT_WALLET}`} />
        </div>

        {/* CTA */}
        <div className="flex gap-3">
          <Link href="/arena"
            className="flex-1 text-center font-mono text-[12px] font-bold tracking-[.08em] uppercase text-white py-3 rounded-full transition-opacity hover:opacity-80"
            style={{ background: 'var(--sig)' }}>
            Challenge Axiom-7 →
          </Link>
          <Link href="/agents/axiom-7"
            className="flex-1 text-center font-mono text-[12px] font-bold tracking-[.08em] uppercase py-3 rounded-full transition-opacity hover:opacity-80"
            style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--ink)' }}>
            View ERC-8004 Identity ↗
          </Link>
        </div>

      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useActiveAccount } from 'thirdweb/react'
import { useOnchainLeaderboard, type OnchainEntry } from '@/lib/hooks/useOnchainLeaderboard'
import { useRoundStore } from '@/lib/store/roundStore'
import { EXPLORER_URL } from '@/lib/contracts/chain'

type Filter = 'all' | 'human' | 'agent'

// ── Skeleton row while loading ────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="grid gap-3 px-5 py-3.5 border-t border-line items-center animate-pulse"
      style={{ gridTemplateColumns: '54px 1fr 92px 92px 96px' }}>
      <div className="w-7 h-5 bg-paper rounded" />
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[11px] bg-paper flex-none" />
        <div className="flex flex-col gap-1.5">
          <div className="w-24 h-3.5 bg-paper rounded" />
          <div className="w-12 h-2.5 bg-paper rounded" />
        </div>
      </div>
      <div className="w-12 h-3.5 bg-paper rounded ml-auto" />
      <div className="w-10 h-3.5 bg-paper rounded ml-auto" />
      <div className="w-8 h-3.5 bg-paper rounded ml-auto" />
    </div>
  )
}

// ── Single leaderboard row ────────────────────────────────────────────────────

function Row({ entry, isYou }: { entry: OnchainEntry; isYou: boolean }) {
  const total = entry.wins + entry.losses
  const acc   = total > 0 ? ((entry.wins / total) * 100).toFixed(1) : '—'

  return (
    <div
      className={`grid gap-3 px-5 py-3.5 border-t border-line items-center transition-colors ${isYou ? 'bg-sig-wash/40' : 'hover:bg-paper/60'}`}
      style={{ gridTemplateColumns: '54px 1fr 92px 92px 96px' }}
    >
      {/* rank */}
      <span className={`font-display font-black text-[20px] tracking-[-0.04em] ${entry.rank <= 3 ? 'text-sig' : 'text-ink-3'}`}>
        {entry.rank}
      </span>

      {/* player */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-[11px] grid place-items-center flex-none font-display font-bold text-[13px] text-white"
          style={entry.type === 'agent'
            ? { background: 'linear-gradient(135deg, var(--sig), var(--sig-2))' }
            : { background: 'var(--ink)' }}
        >
          {entry.initials}
        </div>
        <div className="min-w-0 flex-1">
          <a
            href={`${EXPLORER_URL}/address/${entry.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-display font-bold text-[15px] tracking-[-0.01em] truncate block hover:underline ${isYou ? 'text-sig' : 'hover:text-sig'} transition-colors`}
          >
            {entry.name}
          </a>
          <div className={`font-mono text-[10px] tracking-[.1em] uppercase ${entry.type === 'agent' ? 'text-sig' : 'text-ink-3'}`}>
            {entry.type}{isYou ? ' · you' : ''}
          </div>
        </div>
      </div>

      {/* points */}
      <span className="font-mono font-semibold text-[14px] text-right">
        {entry.points.toLocaleString()}
      </span>

      {/* W/L */}
      <span className="font-mono text-[13px] text-right">
        <span className="text-up-ink font-semibold">{entry.wins}</span>
        <span className="text-ink-3 mx-0.5">/</span>
        <span className="text-down-ink font-semibold">{entry.losses}</span>
      </span>

      {/* streak */}
      <span className="font-mono font-semibold text-[13px] text-ink-2 text-right">
        {entry.streak > 0 ? `🔥 ${entry.streak}` : '—'}
      </span>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function LeaderboardView() {
  const [filter, setFilter] = useState<Filter>('all')
  const account = useActiveAccount()

  // On-chain data
  const { entries, isLoading, contractsLive } = useOnchainLeaderboard(
    account?.address as `0x${string}` | undefined
  )

  // Local session score (your points from the mock store, shown even if not yet on-chain)
  const humanPoints  = useRoundStore((s) => s.humanPoints)
  const humanWins    = useRoundStore((s) => s.humanWins)
  const humanLosses  = useRoundStore((s) => s.humanLosses)
  const humanStreak  = useRoundStore((s) => s.humanStreak)

  // Use on-chain entries when available; fall back to mock store leaderboard
  const mockBoard = useRoundStore((s) => s.leaderboard)

  const displayEntries: OnchainEntry[] = contractsLive && entries.length > 0
    ? entries
    : mockBoard.map((e) => ({
        rank: e.rank,
        address: '',
        type: e.type,
        initials: e.initials,
        name: e.name,
        agentId: e.agentId,
        points: e.points,
        wins: e.wins,
        losses: e.losses,
        streak: e.streak,
        accuracyBps: e.wins + e.losses > 0
          ? Math.round((e.wins / (e.wins + e.losses)) * 10_000)
          : 0,
      }))

  const visible = displayEntries.filter((e) => filter === 'all' || e.type === filter)
  const connectedAddr = account?.address?.toLowerCase()
  const yourEntry = displayEntries.find((e) => e.address.toLowerCase() === connectedAddr)

  return (
    <div className="min-h-screen bg-paper py-16 px-4">
      <div className="max-w-[860px] mx-auto">

        {/* header */}
        <span className="font-mono text-[12px] font-semibold tracking-[.22em] uppercase text-sig flex items-center gap-2 mb-4">
          <span className="w-[22px] h-[2px] bg-sig rounded-full inline-block" />
          {contractsLive ? 'Live on-chain standings' : 'Mock standings'}
        </span>
        <h1 className="font-display font-black uppercase tracking-[-0.03em] leading-[.98] mb-3"
          style={{ fontSize: 'clamp(30px, 5vw, 50px)' }}>
          Leaderboard
        </h1>

        {/* on-chain badge */}
        {contractsLive && (
          <div className="mb-5 flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-[.1em] uppercase text-up-ink bg-up-wash px-2.5 py-1 rounded-full">
              ▦ Verified on-chain · Mantle Sepolia
            </span>
            <a href={`${EXPLORER_URL}/address/0x681F894BaAE0b9D117908eE090DAC57211AcEa93`}
              target="_blank" rel="noopener noreferrer"
              className="font-mono text-[10px] tracking-[.06em] uppercase text-sig underline">
              View contract ↗
            </a>
          </div>
        )}

        {/* your on-chain stats strip */}
        {yourEntry && (
          <div className="mb-5 bg-sig-wash border border-transparent rounded-lg px-5 py-3.5 flex items-center gap-6 flex-wrap">
            <span className="font-mono text-[11px] tracking-[.1em] uppercase text-sig-ink font-semibold">Your stats</span>
            {[
              { label: 'Points',   v: yourEntry.points.toLocaleString() },
              { label: 'Wins',     v: yourEntry.wins },
              { label: 'Losses',   v: yourEntry.losses },
              { label: 'Accuracy', v: `${(yourEntry.accuracyBps / 100).toFixed(1)}%` },
              { label: 'Rank',     v: `#${yourEntry.rank}` },
            ].map(({ label, v }) => (
              <div key={label}>
                <span className="font-mono font-bold text-[16px] text-sig-ink">{v}</span>
                <span className="font-mono text-[10px] uppercase tracking-[.1em] text-sig ml-1.5">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* session stats strip (when no wallet connected but rounds played) */}
        {!yourEntry && humanWins + humanLosses > 0 && (
          <div className="mb-5 bg-paper border border-line rounded-lg px-5 py-3.5 flex items-center gap-6 flex-wrap">
            <span className="font-mono text-[11px] tracking-[.1em] uppercase text-ink-2 font-semibold">This session</span>
            {[
              { label: 'Points',   v: humanPoints.toLocaleString() },
              { label: 'Wins',     v: humanWins },
              { label: 'Losses',   v: humanLosses },
            ].map(({ label, v }) => (
              <div key={label}>
                <span className="font-mono font-bold text-[16px] text-ink">{v}</span>
                <span className="font-mono text-[10px] uppercase tracking-[.1em] text-ink-3 ml-1.5">{label}</span>
              </div>
            ))}
            <span className="font-mono text-[10px] text-ink-3">Connect wallet to appear on-chain</span>
          </div>
        )}

        {/* filter pills */}
        <div className="flex gap-2 mb-6">
          {(['all', 'human', 'agent'] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`font-mono text-[11px] font-semibold tracking-[.12em] uppercase px-4 py-2 rounded-full border transition-colors ${filter === f ? 'bg-sig text-white border-transparent shadow-sig' : 'bg-surface border-line-2 text-ink-2 hover:text-ink'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* table */}
        <div className="bg-surface border border-line rounded-lg overflow-hidden shadow">
          {/* header */}
          <div className="grid gap-3 px-5 py-3 bg-paper border-b border-line font-mono text-[10px] tracking-[.14em] uppercase text-ink-3"
            style={{ gridTemplateColumns: '54px 1fr 92px 92px 96px' }}>
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Points</span>
            <span className="text-right">W / L</span>
            <span className="text-right">Streak</span>
          </div>

          {/* rows */}
          {isLoading && contractsLive ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : visible.length === 0 ? (
            <div className="px-5 py-10 text-center font-mono text-[12px] text-ink-3 uppercase tracking-[.1em]">
              {contractsLive
                ? 'No rounds played yet — be the first!'
                : 'No players yet'}
            </div>
          ) : (
            visible.map((entry) => (
              <Row
                key={entry.address || entry.name}
                entry={entry}
                isYou={!!connectedAddr && entry.address.toLowerCase() === connectedAddr}
              />
            ))
          )}
        </div>

        {/* refresh hint */}
        {contractsLive && (
          <p className="mt-4 text-center font-mono text-[10px] text-ink-3 uppercase tracking-[.08em]">
            Auto-refreshes every 10s · Data sourced directly from Mantle Sepolia
          </p>
        )}
      </div>
    </div>
  )
}

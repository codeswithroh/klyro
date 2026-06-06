'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRoundStore } from '@/lib/store/roundStore'

type Filter = 'all' | 'human' | 'agent'

export function LeaderboardView() {
  const [filter, setFilter] = useState<Filter>('all')
  const leaderboard = useRoundStore((s) => s.leaderboard)
  const humanPoints = useRoundStore((s) => s.humanPoints)
  const humanWins   = useRoundStore((s) => s.humanWins)
  const humanLosses = useRoundStore((s) => s.humanLosses)

  const visible = leaderboard.filter((e) => filter === 'all' || e.type === filter)
  const total = humanWins + humanLosses
  const acc = total > 0 ? ((humanWins / total) * 100).toFixed(1) : '—'

  return (
    <div className="min-h-screen bg-paper py-16 px-4">
      <div className="max-w-[860px] mx-auto">
        <span className="font-mono text-[12px] font-semibold tracking-[.22em] uppercase text-sig flex items-center gap-2 mb-4">
          <span className="w-[22px] h-[2px] bg-sig rounded-full inline-block" />
          Live standings
        </span>
        <h1 className="font-display font-black uppercase tracking-[-0.03em] leading-[.98] mb-3"
          style={{ fontSize: 'clamp(30px, 5vw, 50px)' }}>
          Leaderboard
        </h1>

        {/* your stats strip */}
        {total > 0 && (
          <div className="mb-6 bg-sig-wash border border-transparent rounded-lg px-5 py-3.5 flex items-center gap-6 flex-wrap">
            <span className="font-mono text-[11px] tracking-[.1em] uppercase text-sig-ink font-semibold">Your stats</span>
            {[
              { label: 'Points', v: humanPoints.toLocaleString() },
              { label: 'Wins', v: humanWins },
              { label: 'Losses', v: humanLosses },
              { label: 'Accuracy', v: `${acc}%` },
            ].map(({ label, v }) => (
              <div key={label}>
                <span className="font-mono font-bold text-[16px] text-sig-ink">{v}</span>
                <span className="font-mono text-[10px] uppercase tracking-[.1em] text-sig ml-1.5">{label}</span>
              </div>
            ))}
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
          <div className="grid gap-3 px-5 py-3 bg-paper border-b border-line font-mono text-[10px] tracking-[.14em] uppercase text-ink-3"
            style={{ gridTemplateColumns: '54px 1fr 92px 92px 96px' }}>
            <span>#</span><span>Player</span>
            <span className="text-right">Points</span>
            <span className="text-right">W / L</span>
            <span className="text-right">Streak</span>
          </div>

          {visible.map((entry) => (
            <div key={entry.name}
              className={`grid gap-3 px-5 py-3.5 border-t border-line items-center ${entry.name === 'You' && entry.points > 0 ? 'bg-sig-wash/30' : ''}`}
              style={{ gridTemplateColumns: '54px 1fr 92px 92px 96px' }}>
              <span className={`font-display font-black text-[20px] tracking-[-0.04em] ${entry.rank <= 3 ? 'text-sig' : 'text-ink-3'}`}>
                {entry.rank}
              </span>

              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-[11px] grid place-items-center flex-none font-display font-bold text-[13px] text-white ${entry.type === 'human' ? 'bg-ink' : ''}`}
                  style={entry.type === 'agent' ? { background: 'linear-gradient(135deg, var(--sig), var(--sig-2))' } : undefined}>
                  {entry.initials}
                </div>
                <div className="min-w-0 flex-1">
                  {entry.type === 'agent' && entry.agentId ? (
                    <Link href={`/agents/${entry.agentId}`}
                      className="font-display font-bold text-[15px] tracking-[-0.01em] truncate hover:text-sig transition-colors block">
                      {entry.name}
                    </Link>
                  ) : (
                    <div className={`font-display font-bold text-[15px] tracking-[-0.01em] truncate ${entry.name === 'You' ? 'text-sig' : ''}`}>
                      {entry.name}
                    </div>
                  )}
                  <div className={`font-mono text-[10px] tracking-[.1em] uppercase ${entry.type === 'human' ? 'text-ink-3' : 'text-sig'}`}>
                    {entry.type}{entry.name === 'You' ? ' · you' : ''}
                  </div>
                </div>
              </div>

              <span className="font-mono font-semibold text-[14px] text-right">{entry.points.toLocaleString()}</span>
              <span className="font-mono text-[13px] text-right text-ink-2">
                <span className="text-up-ink font-semibold">{entry.wins}</span>
                <span className="text-ink-3 mx-0.5">/</span>
                <span className="text-down-ink font-semibold">{entry.losses}</span>
              </span>
              <span className="font-mono font-semibold text-[13px] text-ink-2 text-right">
                {entry.streak > 0 ? `🔥 ${entry.streak}` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

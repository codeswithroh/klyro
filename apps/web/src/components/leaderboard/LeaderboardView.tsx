'use client'

// TODO (Phase A+B): Replace mock data with Leaderboard contract reads

import { useState } from 'react'
import Link from 'next/link'

type Filter = 'all' | 'human' | 'agent'

const MOCK_ENTRIES = [
  { rank: 1, type: 'human' as const, initials: 'RS', name: 'rohit.eth',   points: 2410, acc: 73.2, streak: 8 },
  { rank: 2, type: 'agent' as const, initials: 'AX', name: 'Axiom-7',    points: 2280, acc: 71.4, streak: 5,  id: 'axiom-7' },
  { rank: 3, type: 'human' as const, initials: 'SK', name: 'satoshi_k',  points: 1990, acc: 68.1, streak: 3 },
  { rank: 4, type: 'agent' as const, initials: 'MM', name: 'Momentum Max', points: 1870, acc: 66.7, streak: 0, id: 'momentum-max' },
  { rank: 5, type: 'human' as const, initials: 'AL', name: 'alpha_lena', points: 1740, acc: 64.5, streak: 2 },
  { rank: 6, type: 'agent' as const, initials: 'CC', name: 'Contrarian Cora', points: 1630, acc: 62.0, streak: 1, id: 'contrarian-cora' },
]

export function LeaderboardView() {
  const [filter, setFilter] = useState<Filter>('all')

  const visible = MOCK_ENTRIES.filter((e) => filter === 'all' || e.type === filter)

  return (
    <div className="min-h-screen bg-paper py-16 px-4">
      <div className="max-w-[860px] mx-auto">
        <span className="font-mono text-[12px] font-semibold tracking-[.22em] uppercase text-sig flex items-center gap-2 mb-4">
          <span className="w-[22px] h-[2px] bg-sig rounded-full" />
          Live standings
        </span>
        <h1 className="font-display font-black uppercase text-[clamp(30px,5vw,50px)] tracking-[-0.03em] leading-[.98] mb-8">
          Leaderboard
        </h1>

        {/* filter pills */}
        <div className="flex gap-2 mb-6">
          {(['all', 'human', 'agent'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-mono text-[11px] font-semibold tracking-[.12em] uppercase px-4 py-2 rounded-full border transition-colors ${filter === f ? 'bg-sig text-white border-transparent shadow-sig' : 'bg-surface border-line-2 text-ink-2 hover:text-ink'}`}
            >
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
            <span className="text-right">Accuracy</span>
            <span className="text-right">Streak</span>
          </div>

          {visible.map((entry) => (
            <div
              key={entry.name}
              className="grid gap-3 px-5 py-3.5 border-t border-line items-center"
              style={{ gridTemplateColumns: '54px 1fr 92px 92px 96px' }}
            >
              <span className={`font-display font-black text-[20px] tracking-[-0.04em] ${entry.rank <= 3 ? 'text-sig' : 'text-ink-3'}`}>
                {entry.rank}
              </span>

              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-[11px] grid place-items-center flex-none font-display font-bold text-[13px] text-white ${entry.type === 'human' ? 'bg-ink' : ''}`}
                  style={entry.type === 'agent' ? { background: 'linear-gradient(135deg, var(--sig), var(--sig-2))' } : undefined}
                >
                  {entry.initials}
                </div>
                <div className="min-w-0 flex-1">
                  {entry.type === 'agent' && entry.id ? (
                    <Link href={`/agents/${entry.id}`}
                      className="font-display font-bold text-[15px] tracking-[-0.01em] truncate hover:text-sig transition-colors block">
                      {entry.name}
                    </Link>
                  ) : (
                    <div className="font-display font-bold text-[15px] tracking-[-0.01em] truncate">{entry.name}</div>
                  )}
                  <div className={`font-mono text-[10px] tracking-[.1em] uppercase ${entry.type === 'human' ? 'text-ink-3' : 'text-sig'}`}>
                    {entry.type}
                  </div>
                </div>
              </div>

              <span className="font-mono font-semibold text-[14px] text-right">{entry.points.toLocaleString()}</span>
              <span className="font-mono font-bold text-[14px] text-right">{entry.acc}%</span>
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

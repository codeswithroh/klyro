'use client'

// TODO (Phase A): Wire up RoundManager contract reads/writes
// TODO (Phase C): Replace with real wallet + gasless flow via thirdweb
// This component is a UI skeleton — all on-chain integration wired in subsequent phases.

import { useState } from 'react'
import { CountdownRing } from './CountdownRing'
import Link from 'next/link'

type CallState = 'idle' | 'up' | 'down' | 'locked'

export function ArenaView() {
  const [call, setCall] = useState<CallState>('idle')
  const [seconds] = useState(47)

  function handleCall(direction: 'up' | 'down') {
    if (call !== 'idle') return
    setCall(direction)
    // TODO: submit prediction to RoundManager contract
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        {/* header */}
        <div className="flex items-center justify-between mb-5 font-mono text-[11px] text-ink-3">
          <span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-up mr-2 animate-pulse"
              style={{ boxShadow: '0 0 0 3px var(--up-wash)' }} />
            LIVE ROUND · #4821
          </span>
          <Link href="/round/4821" className="underline text-sig hover:text-sig-ink transition-colors">
            Verify on-chain ▦
          </Link>
        </div>

        <div className="bg-surface rounded-xl border border-line shadow-lg overflow-hidden">
          <div className="px-5 py-5">
            {/* asset */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full grid place-items-center text-white font-display font-bold text-[14px]"
                  style={{ background: 'conic-gradient(from 200deg, var(--sig), var(--sig-2))' }}>
                  Ξ
                </div>
                <div>
                  <div className="font-display font-bold text-[15px]">ETH / USD</div>
                  <div className="font-mono text-[10px] text-ink-3">Pyth oracle · Mantle Sepolia</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-[17px]">$3,418.20</div>
                <div className="font-mono text-[11px] text-up font-semibold">▲ 0.42%</div>
              </div>
            </div>

            {/* countdown */}
            <div className="flex flex-col items-center gap-2 my-4">
              <CountdownRing seconds={seconds} total={60} size={120} />
              <p className="font-mono text-[10px] text-ink-3 uppercase tracking-[.2em]">
                Window closes — lock your call
              </p>
            </div>

            {/* versus */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 mb-5">
              <div className="bg-paper rounded border border-line p-3 flex flex-col gap-1.5 items-center text-center">
                <div className="w-9 h-9 rounded-[10px] bg-ink grid place-items-center text-white font-display font-bold text-[13px]">
                  YOU
                </div>
                <div className="font-mono text-[9px] tracking-[.12em] uppercase text-ink-3">Human</div>
                {call !== 'idle' ? (
                  <div className={`font-display font-bold text-[13px] uppercase flex items-center gap-1 ${call === 'up' ? 'text-up' : 'text-down'}`}>
                    {call === 'up' ? '▲ UP' : '▼ DOWN'}
                  </div>
                ) : (
                  <div className="font-mono text-[9px] text-ink-3">—</div>
                )}
              </div>

              <div className="w-9 h-9 rounded-full bg-surface border-2 border-ink grid place-items-center font-display font-black text-[13px]">
                VS
              </div>

              <div className="bg-paper rounded border border-line p-3 flex flex-col gap-1.5 items-center text-center">
                <div className="w-9 h-9 rounded-[10px] grid place-items-center text-white font-display font-bold text-[13px]"
                  style={{ background: 'linear-gradient(135deg, var(--sig), var(--sig-2))' }}>
                  AX
                </div>
                <div className="font-mono text-[9px] tracking-[.12em] uppercase text-sig">Axiom-7</div>
                <div className="font-mono text-[9px] text-ink-3">Thinking…</div>
              </div>
            </div>

            {/* call buttons */}
            {call === 'idle' ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleCall('up')}
                  className="call-btn bg-up text-white rounded-[14px] flex flex-col items-center py-5 font-display font-bold text-[20px] uppercase tracking-[-0.01em] gap-1 transition-transform active:scale-[.97]"
                >
                  <span className="text-[24px] leading-none">▲</span>
                  UP
                  <small className="font-mono text-[10px] font-medium tracking-[.1em] opacity-85">price rises</small>
                </button>
                <button
                  onClick={() => handleCall('down')}
                  className="call-btn bg-down text-white rounded-[14px] flex flex-col items-center py-5 font-display font-bold text-[20px] uppercase tracking-[-0.01em] gap-1 transition-transform active:scale-[.97]"
                >
                  <span className="text-[24px] leading-none">▼</span>
                  DOWN
                  <small className="font-mono text-[10px] font-medium tracking-[.1em] opacity-85">price falls</small>
                </button>
              </div>
            ) : (
              <div className={`rounded-[14px] py-4 text-center font-display font-bold text-[18px] uppercase tracking-[-0.01em] text-white ${call === 'up' ? 'bg-up' : 'bg-down'}`}>
                {call === 'up' ? '▲ UP locked' : '▼ DOWN locked'}
                <div className="font-mono text-[10px] font-normal tracking-[.1em] mt-1 opacity-85">
                  Committed on-chain
                </div>
              </div>
            )}
          </div>
        </div>

        {/* asset picker */}
        <div className="mt-4 flex gap-2 justify-center">
          {['ETH/USD', 'BTC/USD', 'MNT/USD'].map((asset) => (
            <button key={asset}
              className={`font-mono text-[11px] font-semibold tracking-[.1em] uppercase px-3 py-1.5 rounded-full border transition-colors ${asset === 'ETH/USD' ? 'bg-sig-wash text-sig-ink border-transparent' : 'bg-surface border-line-2 text-ink-2 hover:text-ink'}`}>
              {asset}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

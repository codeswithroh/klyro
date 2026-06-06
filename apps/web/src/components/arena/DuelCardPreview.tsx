'use client'

import { useEffect, useState } from 'react'
import { CountdownRing } from './CountdownRing'
import { globalPriceSimulator, formatPrice } from '@/lib/mock/priceSimulator'

const ROUND_SECONDS = 60

export function DuelCardPreview() {
  const [seconds, setSeconds] = useState(ROUND_SECONDS)
  const [price, setPrice] = useState(globalPriceSimulator.current('ETH/USD'))

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => (s <= 1 ? ROUND_SECONDS : s - 1))
      setPrice(globalPriceSimulator.tick('ETH/USD'))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="w-[340px] bg-surface rounded-xl border border-line shadow-lg overflow-hidden">
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-3 font-mono text-[11px] text-ink-3">
        <span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-up mr-2"
            style={{ boxShadow: '0 0 0 4px var(--up-wash)' }} />
          LIVE ROUND · #4821
        </span>
        <span>◢◣ KLYRO</span>
      </div>

      <div className="px-4 pb-5">
        {/* asset */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full grid place-items-center text-white font-display font-bold text-[13px]"
              style={{ background: 'conic-gradient(from 200deg, var(--sig), var(--sig-2))' }}>
              Ξ
            </div>
            <div>
              <div className="font-display font-bold text-[15px] tracking-[-0.01em]">ETH</div>
              <div className="font-mono text-[10px] text-ink-3">ETH / USD · oracle</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono font-bold text-[16px]">{formatPrice('ETH/USD', price)}</div>
            <div className="font-mono text-[11px] text-up font-semibold">▲ live</div>
          </div>
        </div>

        {/* countdown */}
        <div className="flex flex-col items-center gap-1.5 my-3">
          <CountdownRing seconds={seconds} total={ROUND_SECONDS} size={116} />
          <div className="font-mono text-[10px] text-ink-3 uppercase tracking-[.2em]">
            Window closes — lock your call
          </div>
        </div>

        {/* versus */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 mb-4">
          <div className="bg-paper rounded border border-line p-3 flex flex-col gap-1.5 items-center text-center">
            <div className="w-9 h-9 rounded-[10px] bg-ink grid place-items-center text-white font-display font-bold text-[14px]">YOU</div>
            <div className="font-mono text-[10px] tracking-[.12em] uppercase text-ink-3">Human</div>
            <div className="font-display font-bold text-[13px] uppercase text-up flex items-center gap-1">▲ UP</div>
          </div>

          <div className="w-9 h-9 rounded-full bg-surface border-2 border-ink grid place-items-center font-display font-black text-[14px] tracking-[-0.02em]">
            VS
          </div>

          <div className="bg-paper rounded border border-line p-3 flex flex-col gap-1.5 items-center text-center">
            <div className="w-9 h-9 rounded-[10px] grid place-items-center text-white font-display font-bold text-[14px]"
              style={{ background: 'linear-gradient(135deg, var(--sig), var(--sig-2))' }}>
              AX
            </div>
            <div className="font-mono text-[10px] tracking-[.12em] uppercase text-sig">Agent · Axiom-7</div>
            <div className="font-display font-bold text-[13px] uppercase text-down flex items-center gap-1">▼ DOWN</div>
          </div>
        </div>

        {/* call buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button className="call-btn bg-up text-white rounded flex flex-col items-center py-4 font-display font-bold text-[18px] uppercase tracking-[-0.01em] gap-1 transition-transform">
            <span className="text-[22px] leading-none">▲</span>
            UP
            <small className="font-mono text-[10px] font-medium tracking-[.1em] opacity-85">price rises</small>
          </button>
          <button className="call-btn bg-down text-white rounded flex flex-col items-center py-4 font-display font-bold text-[18px] uppercase tracking-[-0.01em] gap-1 transition-transform">
            <span className="text-[22px] leading-none">▼</span>
            DOWN
            <small className="font-mono text-[10px] font-medium tracking-[.1em] opacity-85">price falls</small>
          </button>
        </div>
      </div>
    </div>
  )
}

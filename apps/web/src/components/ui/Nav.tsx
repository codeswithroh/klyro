'use client'

import Link from 'next/link'
import { Wordmark } from './Wordmark'

export function Nav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-line"
      style={{ background: 'color-mix(in srgb, var(--paper) 82%, transparent)', backdropFilter: 'blur(14px) saturate(1.3)' }}>
      <div className="max-w-[1160px] mx-auto px-7 py-3.5 flex items-center justify-between gap-5">
        <Link href="/" className="no-underline text-inherit">
          <Wordmark size={22} />
        </Link>

        <div className="hidden md:flex gap-1">
          {[
            { href: '/arena', label: 'Arena' },
            { href: '/leaderboard', label: 'Board' },
          ].map((l) => (
            <Link key={l.href} href={l.href}
              className="font-mono text-[12px] font-medium tracking-[.04em] uppercase no-underline text-ink-2 px-3 py-1.5 rounded-full transition-colors hover:bg-surface hover:text-ink">
              {l.label}
            </Link>
          ))}
        </div>

        <Link href="/arena"
          className="font-mono text-[12px] font-semibold tracking-[.06em] uppercase text-white bg-ink px-4 py-2 rounded-full no-underline">
          Play now ▦
        </Link>
      </div>
    </nav>
  )
}

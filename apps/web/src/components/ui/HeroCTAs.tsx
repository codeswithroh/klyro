'use client'

/**
 * HeroCTAs — wallet-gated CTA buttons for the landing page.
 *
 * If the user already has a wallet connected, clicking navigates immediately.
 * If not, we open the Thirdweb connect modal. Once they connect, we navigate
 * to the destination they originally clicked.
 */

import { useRouter } from 'next/navigation'
import { useActiveAccount, useConnectModal } from 'thirdweb/react'
import { createWallet, inAppWallet } from 'thirdweb/wallets'
import { thirdwebClient } from '@/lib/contracts/thirdweb-client'
import { defineChain } from 'thirdweb'
import { mantleSepolia } from '@/lib/contracts/chain'

const twChain = defineChain({
  id: mantleSepolia.id,
  rpc: mantleSepolia.rpcUrls.default.http[0],
  nativeCurrency: mantleSepolia.nativeCurrency,
})

const wallets = [
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  inAppWallet({ auth: { options: ['email', 'google', 'apple'] } }),
]

function useGatedNav() {
  const router      = useRouter()
  const account     = useActiveAccount()
  const { connect } = useConnectModal()

  return async function navigate(href: string) {
    if (account) {
      router.push(href)
      return
    }
    try {
      await connect({ client: thirdwebClient, chain: twChain, wallets })
      // connect() resolves after the user connects — navigate now
      router.push(href)
    } catch {
      // user dismissed the modal — do nothing
    }
  }
}

// ── Hero buttons (Arena / Gauntlet / Leaderboard) ────────────────────────────

export function HeroCTAs() {
  const nav = useGatedNav()

  return (
    <div className="mt-8 flex gap-3 flex-wrap">
      <button
        onClick={() => nav('/arena')}
        className="font-mono font-semibold text-[13px] tracking-[.04em] uppercase bg-sig text-white px-5 py-3.5 rounded-full shadow-sig transition-transform active:translate-y-px cursor-pointer">
        Enter the arena →
      </button>

      <button
        onClick={() => nav('/challenge')}
        className="font-mono font-semibold text-[13px] tracking-[.04em] uppercase px-5 py-3.5 rounded-full border transition-transform active:translate-y-px cursor-pointer"
        style={{ background: 'rgba(108,43,242,0.12)', borderColor: 'rgba(108,43,242,0.35)', color: '#9A6BFF' }}>
        ⚔️ Gauntlet Mode
      </button>

      {/* Leaderboard is public — no wallet needed */}
      <a href="/leaderboard"
        className="font-mono font-semibold text-[13px] tracking-[.04em] uppercase bg-surface text-ink border border-line-2 px-5 py-3.5 rounded-full transition-transform active:translate-y-px">
        View leaderboard
      </a>
    </div>
  )
}

// ── Bottom CTA strip ─────────────────────────────────────────────────────────

export function BottomCTA() {
  const nav = useGatedNav()

  return (
    <button
      onClick={() => nav('/arena')}
      className="inline-flex font-mono font-semibold text-[14px] tracking-[.04em] uppercase bg-sig text-white px-8 py-4 rounded-full shadow-sig transition-transform active:translate-y-px cursor-pointer">
      Play now — it&apos;s free
    </button>
  )
}

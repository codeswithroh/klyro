'use client'

import { ConnectButton } from 'thirdweb/react'
import { createWallet, inAppWallet } from 'thirdweb/wallets'
import { thirdwebClient } from '@/lib/contracts/thirdweb-client'
import { defineChain } from 'thirdweb'
import { mantleSepolia } from '@/lib/contracts/chain'

const twChain = defineChain({
  id: mantleSepolia.id,
  rpc: mantleSepolia.rpcUrls.default.http[0],
  nativeCurrency: mantleSepolia.nativeCurrency,
})

// Wallets in order of preference:
// 1. MetaMask / any injected wallet (for users who have one)
// 2. Email / social via thirdweb in-app wallet (for new users)
// No smart wallet — user pays gas directly from their own wallet.
// Paymaster can be added later for a gasless experience.
const wallets = [
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  inAppWallet({
    auth: { options: ['email', 'google', 'apple'] },
  }),
]

const btnStyle = {
  fontFamily: 'var(--mono)',
  fontWeight: 600,
  fontSize: '12px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  borderRadius: '999px',
  padding: '8px 16px',
  border: 'none',
  cursor: 'pointer',
}

export function WalletButton() {
  return (
    <ConnectButton
      client={thirdwebClient}
      chain={twChain}
      wallets={wallets}
      theme="light"
      connectButton={{
        label: 'Play now',
        style: { ...btnStyle, background: 'var(--ink)', color: '#fff' },
      }}
      detailsButton={{
        style: { ...btnStyle, background: 'var(--sig-wash)', color: 'var(--sig-ink)' },
      }}
    />
  )
}

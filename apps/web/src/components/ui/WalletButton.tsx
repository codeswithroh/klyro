'use client'

import { ConnectButton } from 'thirdweb/react'
import { inAppWallet, smartWallet } from 'thirdweb/wallets'
import { thirdwebClient } from '@/lib/contracts/thirdweb-client'
import { mantleSepolia } from '@/lib/contracts/chain'
import { defineChain } from 'thirdweb'

// Map our viem chain to a thirdweb chain
const twChain = defineChain({
  id: mantleSepolia.id,
  rpc: mantleSepolia.rpcUrls.default.http[0],
  nativeCurrency: mantleSepolia.nativeCurrency,
})

// Gasless smart wallet wrapping an in-app (email/social) wallet
const wallets = [
  smartWallet({
    chain: twChain,
    gasless: true,
    factoryAddress: '0x2e5f11F1CE16A6B78cBcE9f58Cc89F7BF2C2E3c', // AccountFactory — will update post-deploy if thirdweb provides a Mantle Sepolia factory
  }),
  inAppWallet({
    auth: {
      options: ['email', 'google', 'apple'],
    },
  }),
]

export function WalletButton() {
  return (
    <ConnectButton
      client={thirdwebClient}
      chain={twChain}
      wallets={wallets}
      theme="light"
      connectButton={{
        label: 'Play now ▦',
        style: {
          fontFamily: 'var(--mono)',
          fontWeight: 600,
          fontSize: '12px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          background: 'var(--ink)',
          color: '#fff',
          borderRadius: '999px',
          padding: '8px 16px',
          border: 'none',
        },
      }}
      detailsButton={{
        style: {
          fontFamily: 'var(--mono)',
          fontWeight: 600,
          fontSize: '12px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          background: 'var(--sig-wash)',
          color: 'var(--sig-ink)',
          borderRadius: '999px',
          padding: '8px 16px',
          border: 'none',
        },
      }}
    />
  )
}

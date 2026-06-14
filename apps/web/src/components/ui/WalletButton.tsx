'use client'

import { ConnectButton } from 'thirdweb/react'
import { thirdwebClient } from '@/lib/contracts/thirdweb-client'
import { twChain, wallets } from '@/lib/contracts/wallets'

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
        label: 'Connect',
        style: { ...btnStyle, background: 'var(--ink)', color: '#fff' },
      }}
      detailsButton={{
        style: { ...btnStyle, background: 'var(--sig-wash)', color: 'var(--sig-ink)' },
      }}
    />
  )
}

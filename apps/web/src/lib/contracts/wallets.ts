'use client'

/**
 * Centralized thirdweb wallet configuration.
 *
 * Single source of truth for the connect wallet list + chain, so every connect
 * surface (Nav button, landing CTAs, Gauntlet "save score") behaves identically.
 *
 * Gasless / Account Abstraction:
 *   When NEXT_PUBLIC_SPONSOR_GAS === 'true' AND Account Abstraction is enabled
 *   for the thirdweb client ID in the dashboard, the in-app (email/social) wallet
 *   becomes an ERC-4337 smart account with gas sponsored by the app — players
 *   never need MNT. The flag defaults OFF so behavior is unchanged until both
 *   the dashboard toggle and the env flag are set together.
 */

import { createWallet, inAppWallet } from 'thirdweb/wallets'
import { defineChain } from 'thirdweb'
import { mantleSepolia } from './chain'

export const twChain = defineChain({
  id: mantleSepolia.id,
  rpc: mantleSepolia.rpcUrls.default!.http[0],
  nativeCurrency: mantleSepolia.nativeCurrency,
})

const SPONSOR_GAS = process.env.NEXT_PUBLIC_SPONSOR_GAS === 'true'

// In-app (email / Google / Apple) wallet for new users — no seed phrase.
// Upgrades to a gas-sponsored smart account when SPONSOR_GAS is enabled.
const socialWallet = SPONSOR_GAS
  ? inAppWallet({
      auth: { options: ['email', 'google', 'apple'] },
      smartAccount: { chain: twChain, sponsorGas: true },
    })
  : inAppWallet({
      auth: { options: ['email', 'google', 'apple'] },
    })

export const wallets = [
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  socialWallet,
]

export const GASLESS_ENABLED = SPONSOR_GAS

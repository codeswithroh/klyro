/**
 * POST /api/gas-drip
 *
 * Sends a dust amount of MNT to a near-empty wallet so social-login users can
 * pay for their own on-chain Arena/Gauntlet transactions without ever visiting
 * a faucet — the "gasless feel" without Account Abstraction (thirdweb's AA
 * bundler does not support Mantle Sepolia / chain 5003).
 *
 * Body:     { address: string }
 * Response: { funded: boolean, hash?: string, skipped?: string }
 *
 * Guards (anti-abuse, hackathon-grade):
 *   - valid checksum/format address only
 *   - only funds wallets BELOW a min balance (already-funded → skip)
 *   - fixed small amount per drip, capped
 *   - refuses if the drip wallet itself is running low
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createPublicClient, createWalletClient, http, parseEther, isAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const RPC_URL  = process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC ?? 'https://rpc.sepolia.mantle.xyz'
// Funded wallet that pays the drips. Server-only — never exposed to the client.
const DRIP_KEY = (process.env.DRIP_PRIVATE_KEY ?? process.env.BOT_PRIVATE_KEY) as `0x${string}` | undefined

const DRIP_AMOUNT     = parseEther('5')     // sent per drip — covers many rounds of play
const MIN_BALANCE     = parseEther('1')     // only drip if the recipient is below this
const DRIP_WALLET_MIN = parseEther('5')     // refuse to drip if our wallet can't cover one drip

const mantleSepolia = {
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const

export async function POST(req: NextRequest) {
  if (!DRIP_KEY) {
    return NextResponse.json({ funded: false, error: 'DRIP wallet not configured' }, { status: 500 })
  }

  let address: string
  try {
    const body = await req.json()
    address = body.address as string
    if (!address || !isAddress(address)) throw new Error('invalid address')
  } catch {
    return NextResponse.json({ funded: false, error: 'Invalid address' }, { status: 400 })
  }

  const account = privateKeyToAccount(DRIP_KEY)
  const publicClient = createPublicClient({ chain: mantleSepolia as any, transport: http(RPC_URL) })
  const walletClient = createWalletClient({ account, chain: mantleSepolia as any, transport: http(RPC_URL) })

  try {
    // Skip wallets that already have gas — this is the primary anti-abuse guard.
    const recipientBalance = await publicClient.getBalance({ address: address as `0x${string}` })
    if (recipientBalance >= MIN_BALANCE) {
      return NextResponse.json({ funded: false, skipped: 'already-funded' })
    }

    // Protect the drip wallet from running dry.
    const dripBalance = await publicClient.getBalance({ address: account.address })
    if (dripBalance < DRIP_WALLET_MIN) {
      return NextResponse.json({ funded: false, skipped: 'drip-wallet-low' }, { status: 503 })
    }

    const hash = await walletClient.sendTransaction({
      to: address as `0x${string}`,
      value: DRIP_AMOUNT,
      chain: mantleSepolia as any,
      account,
    })
    await publicClient.waitForTransactionReceipt({ hash })

    console.log(`[gas-drip] funded ${address} with 5 MNT, tx ${hash}`)
    return NextResponse.json({ funded: true, hash })
  } catch (e: unknown) {
    const msg = (e as Error).message ?? 'drip failed'
    console.error('[gas-drip] failed:', msg)
    return NextResponse.json({ funded: false, error: msg.slice(0, 200) }, { status: 500 })
  }
}

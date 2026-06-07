'use client'

/**
 * useOpenRound
 *
 * Lets the frontend open a round without the bot:
 *  1. Fetch fresh VAA from Pyth Hermes
 *  2. Call updatePriceFeeds on Pyth (payable, fee = 1 wei)
 *  3. Call openRound on RoundManager
 *
 * Uses thirdweb sendTransaction (matches the connected wallet).
 */

import { useState } from 'react'
import { useSendTransaction, useActiveAccount } from 'thirdweb/react'
import { prepareContractCall, prepareTransaction, getContract, toWei } from 'thirdweb'
import { defineChain } from 'thirdweb'
import { thirdwebClient } from '../contracts/thirdweb-client'
import { CONTRACTS, PYTH_ADDRESS, PRICE_FEEDS, type AssetPair } from '../contracts/addresses'
import { ROUND_MANAGER_ABI } from '../contracts/abis'
import { mantleSepolia } from '../contracts/chain'

const twChain = defineChain({
  id: mantleSepolia.id,
  rpc: mantleSepolia.rpcUrls.default.http[0],
  nativeCurrency: mantleSepolia.nativeCurrency,
})

const HERMES = 'https://hermes.pyth.network/v2/updates/price/latest'

const PYTH_ABI = [
  {
    name: 'updatePriceFeeds',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'updateData', type: 'bytes[]' }],
    outputs: [],
  },
] as const

async function fetchVAA(feedId: string): Promise<`0x${string}`> {
  const res = await fetch(`${HERMES}?ids[]=${feedId}&encoding=hex&parsed=false`)
  if (!res.ok) throw new Error(`Hermes error: ${res.status}`)
  const data = await res.json()
  const hex = data.binary?.data?.[0]
  if (!hex) throw new Error('No VAA returned from Hermes')
  return `0x${hex}` as `0x${string}`
}

export function useOpenRound() {
  const account = useActiveAccount()
  const { mutateAsync: sendTx } = useSendTransaction()
  const [isOpening, setIsOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function openRound(asset: AssetPair = 'ETH/USD', durationSeconds = 60) {
    if (!account) { setError('Connect your wallet first'); return }
    setIsOpening(true)
    setError(null)

    try {
      const feedId = PRICE_FEEDS[asset]

      // Step 1: fetch VAA
      setStatus('Fetching price from Pyth…')
      const vaa = await fetchVAA(feedId)

      // Step 2: push price to Pyth on-chain
      setStatus('Pushing price on-chain…')
      const pythContract = getContract({
        client: thirdwebClient,
        chain: twChain,
        address: PYTH_ADDRESS as `0x${string}`,
        abi: PYTH_ABI as any,
      })

      const updateTx = prepareContractCall({
        contract: pythContract,
        method: 'function updatePriceFeeds(bytes[] updateData)',
        params: [[vaa]],
        value: BigInt(1),  // 1 wei fee
      })
      await sendTx(updateTx)

      // Step 3: open round
      setStatus('Opening round…')
      const rmContract = getContract({
        client: thirdwebClient,
        chain: twChain,
        address: CONTRACTS.RoundManager as `0x${string}`,
        abi: ROUND_MANAGER_ABI as any,
      })

      const openTx = prepareContractCall({
        contract: rmContract,
        method: 'function openRound(bytes32 priceFeedId, uint256 durationSeconds) returns (uint256 roundId)',
        params: [feedId as `0x${string}`, BigInt(durationSeconds)],
      })
      await sendTx(openTx)
      setStatus(null)
    } catch (e) {
      setError((e as Error).message?.slice(0, 120) ?? 'Unknown error')
      setStatus(null)
    } finally {
      setIsOpening(false)
    }
  }

  return { openRound, isOpening, status, error }
}

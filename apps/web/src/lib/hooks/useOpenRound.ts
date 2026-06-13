'use client'

/**
 * useOpenRound — opens a round via RoundManager.openRoundWithPrice.
 *
 * Strategy: always fetch a fresh VAA from Pyth Hermes right before submitting,
 * then call openRoundWithPrice so the tx atomically pushes the fresh price
 * on-chain and opens the round in one shot.
 *
 * openRound (no price) fails whenever the on-chain Pyth feed is stale
 * (getPriceNoOlderThan reverts). There is no active pusher on Mantle Sepolia,
 * so the stored price goes stale quickly. Pushing our own VAA from Hermes
 * is the correct fix.
 *
 * The Pyth update fee on Mantle Sepolia testnet is 1 wei per update.
 */

import { useState } from 'react'
import { sendTransaction, prepareContractCall, getContract, waitForReceipt, readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { defineChain } from 'thirdweb'
import { thirdwebClient } from '../contracts/thirdweb-client'
import { CONTRACTS, PRICE_FEEDS, PYTH_ADDRESS, type AssetPair } from '../contracts/addresses'
import { ROUND_MANAGER_ABI } from '../contracts/abis'
import { mantleSepolia } from '../contracts/chain'

const HERMES_BASE = 'https://hermes.pyth.network/v2/updates/price/latest'

const twChain = defineChain({
  id: mantleSepolia.id,
  rpc: mantleSepolia.rpcUrls.default.http[0],
  nativeCurrency: mantleSepolia.nativeCurrency,
})

// Minimal ABI fragment to call pyth.getUpdateFee(bytes[] updateData)
const PYTH_FEE_ABI = [
  {
    type: 'function',
    name: 'getUpdateFee',
    inputs: [{ name: 'updateData', type: 'bytes[]', internalType: 'bytes[]' }],
    outputs: [{ name: 'feeAmount', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
] as const

async function fetchFreshVAA(feedId: string): Promise<`0x${string}`[]> {
  const url = `${HERMES_BASE}?ids[]=${feedId}&encoding=hex`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Hermes fetch failed: ${res.status}`)
  const data = await res.json()
  const vaas: string[] = data.binary?.data ?? []
  if (vaas.length === 0) throw new Error('No VAA returned from Hermes')
  // Ensure 0x prefix
  return vaas.map((v) => (v.startsWith('0x') ? v : `0x${v}`) as `0x${string}`)
}

export function useOpenRound() {
  const account = useActiveAccount()
  const [isOpening, setIsOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function openRound(asset: AssetPair = 'ETH/USD', durationSeconds = 60) {
    if (!account) { setError('Connect your wallet first'); return }
    setIsOpening(true)
    setError(null)

    try {
      const feedId = PRICE_FEEDS[asset]

      // 1. Fetch a fresh VAA from Hermes right before the tx
      setStatus('Fetching price update…')
      const updateData = await fetchFreshVAA(feedId)

      // 2. Get the Pyth update fee (1 wei on testnet, but ask the contract to be safe)
      const pythContract = getContract({
        client: thirdwebClient,
        chain: twChain,
        address: PYTH_ADDRESS as `0x${string}`,
        abi: PYTH_FEE_ABI,
      })
      let updateFee: bigint = 1n
      try {
        updateFee = await readContract({
          contract: pythContract,
          method: 'getUpdateFee',
          params: [updateData],
        })
      } catch {
        // fallback to 1 wei if the fee call fails (testnet default)
        updateFee = 1n
      }

      // 3. Call openRoundWithPrice — atomically pushes price + opens round
      const rmContract = getContract({
        client: thirdwebClient,
        chain: twChain,
        address: CONTRACTS.RoundManager as `0x${string}`,
        abi: ROUND_MANAGER_ABI as any,
      })

      setStatus('Opening round on-chain…')
      const openTx = prepareContractCall({
        contract: rmContract,
        method: 'function openRoundWithPrice(bytes[] updateData, bytes32 priceFeedId, uint256 durationSeconds) payable returns (uint256 roundId)',
        params: [updateData, feedId as `0x${string}`, BigInt(durationSeconds)],
        value: updateFee,
      })

      const result = await sendTransaction({ transaction: openTx, account })
      const hash = (result as any)?.transactionHash as `0x${string}` | undefined

      if (hash) {
        setStatus('Confirming on Mantle…')
        const receipt = await waitForReceipt({
          transactionHash: hash,
          client: thirdwebClient,
          chain: twChain,
        })
        if (receipt.status === 'reverted') {
          throw new Error('Transaction reverted on-chain')
        }
      }

      setStatus(null)
    } catch (e) {
      const msg = (e as Error).message ?? ''
      if (msg.toLowerCase().includes('hermes')) {
        setError('Could not fetch price update — check your connection')
      } else if (msg.toLowerCase().includes('reverted')) {
        setError('Transaction reverted — try again')
      } else if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('user denied')) {
        setError('Transaction cancelled')
      } else {
        setError(msg.slice(0, 120) || 'Transaction failed')
      }
      setStatus(null)
      throw e  // re-throw so ArenaView's catch clears waitingOpen
    } finally {
      setIsOpening(false)
    }
  }

  return { openRound, isOpening, status, error }
}

'use client'

/**
 * useResolveRound
 *
 * Settles a closed round via RoundManager.resolveRound, then reads back
 * the result via two strategies:
 *
 *   SUCCESS PATH — parse the RoundResolved event from the receipt.
 *     This is the authoritative source: the event is written atomically
 *     with the state change, so it never returns stale data.
 *
 *   ALREADY_RESOLVED PATH — the bot beat us; the receipt doesn't contain
 *     our event. Fall back to viem's readContract (wagmi-style, no thirdweb
 *     cache) which reliably reads the committed on-chain state.
 *
 * Also reads the bot's actual on-chain prediction from PredictionRegistry
 * so the UI can determine WIN / LOSE / DRAW correctly.
 */

import { useState } from 'react'
import {
  sendTransaction,
  prepareContractCall,
  getContract,
  waitForReceipt,
  readContract,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { defineChain } from 'thirdweb'
import { createPublicClient, http, decodeEventLog } from 'viem'
import { thirdwebClient } from '../contracts/thirdweb-client'
import { CONTRACTS, AGENT_WALLET, PYTH_ADDRESS } from '../contracts/addresses'
import { ROUND_MANAGER_ABI, PREDICTION_REGISTRY_ABI } from '../contracts/abis'
import { mantleSepolia } from '../contracts/chain'
import type { Call } from '../store/roundStore'

const twChain = defineChain({
  id: mantleSepolia.id,
  rpc: mantleSepolia.rpcUrls.default.http[0],
  nativeCurrency: mantleSepolia.nativeCurrency,
})

const HERMES_BASE = 'https://hermes.pyth.network/v2/updates/price/latest'

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
  return vaas.map((v) => (v.startsWith('0x') ? v : `0x${v}`) as `0x${string}`)
}

// viem public client — used for fresh contract reads (no thirdweb cache)
const viemClient = createPublicClient({
  chain: {
    id: mantleSepolia.id,
    name: mantleSepolia.name,
    nativeCurrency: mantleSepolia.nativeCurrency,
    rpcUrls: { default: { http: [mantleSepolia.rpcUrls.default.http[0]] } },
  } as any,
  transport: http(),
})

export interface ResolvedRoundData {
  roundId: bigint
  outcome: boolean      // true = price went UP
  closePrice: bigint    // raw int64 from contract (divide by 1e8 for USD)
  agentCall: Call | null
}

// Parse RoundResolved event from receipt logs
function parseRoundResolvedEvent(
  logs: readonly { topics: readonly `0x${string}`[]; data: `0x${string}` }[],
  expectedRoundId: bigint,
): { closePrice: bigint; outcome: boolean } | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: ROUND_MANAGER_ABI,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        eventName: 'RoundResolved',
      }) as any
      if (decoded.args.roundId === expectedRoundId) {
        return {
          closePrice: BigInt(decoded.args.closePrice),
          outcome: decoded.args.outcome as boolean,
        }
      }
    } catch {
      // not this event, continue
    }
  }
  return null
}

// Read bot's prediction from PredictionRegistry via viem (no cache)
async function readAgentCall(roundId: bigint): Promise<Call | null> {
  try {
    const [predicted, isUp] = await Promise.all([
      viemClient.readContract({
        address: CONTRACTS.PredictionRegistry as `0x${string}`,
        abi: PREDICTION_REGISTRY_ABI,
        functionName: 'hasPredicted',
        args: [roundId, AGENT_WALLET as `0x${string}`],
      }),
      viemClient.readContract({
        address: CONTRACTS.PredictionRegistry as `0x${string}`,
        abi: PREDICTION_REGISTRY_ABI,
        functionName: 'prediction',
        args: [roundId, AGENT_WALLET as `0x${string}`],
      }),
    ])
    if (!predicted) return null
    return isUp ? 'up' : 'down'
  } catch {
    return null
  }
}

// Read settled round result via viem (fallback for AlreadyResolved path)
async function readRoundViaViem(roundId: bigint): Promise<{ closePrice: bigint; outcome: boolean } | null> {
  try {
    const round = await viemClient.readContract({
      address: CONTRACTS.RoundManager as `0x${string}`,
      abi: ROUND_MANAGER_ABI,
      functionName: 'getRound',
      args: [roundId],
    }) as any
    return {
      closePrice: BigInt(round.closePrice),
      outcome: round.outcome as boolean,
    }
  } catch {
    return null
  }
}

export function useResolveRound() {
  const account = useActiveAccount()
  const [isResolving, setIsResolving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)

  async function resolveRound(
    roundId: bigint,
    _priceFeedId: `0x${string}`,
  ): Promise<ResolvedRoundData | null> {
    if (!account) { setError('Connect your wallet first'); return null }
    setIsResolving(true)
    setError(null)
    setResolved(false)

    const rmContract = getContract({
      client: thirdwebClient,
      chain: twChain,
      address: CONTRACTS.RoundManager as `0x${string}`,
      abi: ROUND_MANAGER_ABI as any,
    })

    try {
      // Fetch a fresh VAA so resolveRoundWithPrice can push an up-to-date
      // price on-chain before settling. resolveRound() (no price) reverts
      // with StalePrice for the same reason openRound() does — no active
      // pusher on Mantle Sepolia keeps the feed fresh.
      setStatus('Fetching price update…')
      const updateData = await fetchFreshVAA(_priceFeedId)

      // Get the Pyth update fee
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
      } catch { updateFee = 1n }

      setStatus('Settling round…')
      const tx = prepareContractCall({
        contract: rmContract,
        method: 'function resolveRoundWithPrice(bytes[] updateData, uint256 roundId) payable',
        params: [updateData, roundId],
        value: updateFee,
        gas: BigInt(300_000),
      })
      const result = await sendTransaction({ transaction: tx, account })
      const receipt = await waitForReceipt({ ...result, client: thirdwebClient, chain: twChain })

      // Parse closePrice + outcome from the RoundResolved event in the receipt.
      // This is the authoritative, cache-free source of truth.
      setStatus('Reading result…')
      const eventData = parseRoundResolvedEvent(receipt.logs as any, roundId)

      let closePrice: bigint
      let outcome: boolean
      if (eventData) {
        closePrice = eventData.closePrice
        outcome    = eventData.outcome
      } else {
        // Event not found in receipt — unusual, fall back to viem read
        const fallback = await readRoundViaViem(roundId)
        if (!fallback) throw new Error('Could not read round result after settlement')
        closePrice = fallback.closePrice
        outcome    = fallback.outcome
      }

      const agentCall = await readAgentCall(roundId)
      setStatus(null)
      setResolved(true)
      return { roundId, outcome, closePrice, agentCall }

    } catch (e: unknown) {
      const msg = (e as Error).message ?? ''

      // AlreadyResolved = bot beat us to settlement; our tx reverted so
      // there's no receipt with an event. Read the settled data via viem.
      if (msg.includes('AlreadyResolved') || msg.includes('0x646cf558')) {
        try {
          setStatus('Reading result…')
          const [roundResult, agentCall] = await Promise.all([
            readRoundViaViem(roundId),
            readAgentCall(roundId),
          ])
          if (roundResult) {
            setStatus(null)
            setResolved(true)
            return { roundId, outcome: roundResult.outcome, closePrice: roundResult.closePrice, agentCall }
          }
        } catch {
          // fall through to generic error
        }
      }

      setError(msg.slice(0, 120) ?? 'Unknown error')
      setStatus(null)
      return null
    } finally {
      setIsResolving(false)
    }
  }

  return { resolveRound, isResolving, status, error, resolved }
}

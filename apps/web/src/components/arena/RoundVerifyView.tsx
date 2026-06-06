'use client'

// TODO (Phase B): Pull real round data from PredictionRegistry contract

const EXPLORER = 'https://explorer.sepolia.mantle.xyz'

interface RoundVerifyViewProps {
  roundId: string
}

const MOCK_ROUND = {
  id: '4821',
  asset: 'ETH/USD',
  startPrice: '$3,418.20',
  closePrice: '$3,431.55',
  startTs: '2026-06-06T12:00:00Z',
  closeTs: '2026-06-06T12:01:00Z',
  humanCall: 'UP',
  agentCall: 'DOWN',
  outcome: 'UP',
  txHash: '0x9f3a...3ac1',
  entropyHash: '0x7b2d...8ef3',
}

export function RoundVerifyView({ roundId }: RoundVerifyViewProps) {
  const round = MOCK_ROUND

  return (
    <div className="min-h-screen bg-paper py-16 px-4">
      <div className="max-w-[640px] mx-auto">
        <span className="font-mono text-[12px] font-semibold tracking-[.22em] uppercase text-sig flex items-center gap-2 mb-4">
          <span className="w-[22px] h-[2px] bg-sig rounded-full" />
          Round #{roundId} · proof
        </span>
        <h1 className="font-display font-black uppercase text-[clamp(28px,5vw,44px)] tracking-[-0.03em] leading-[.98] mb-8">
          On-chain<br />verification
        </h1>

        {/* Proof table */}
        <div className="bg-surface border border-line rounded-lg overflow-hidden shadow mb-6">
          {[
            { k: 'Asset', v: round.asset },
            { k: 'Start price', v: round.startPrice },
            { k: 'Close price', v: round.closePrice },
            { k: 'Human call', v: round.humanCall },
            { k: 'Agent call', v: round.agentCall },
            { k: 'Outcome', v: round.outcome, ok: true },
            { k: 'Tx hash', v: round.txHash, hash: true },
            { k: 'Entropy hash', v: round.entropyHash, hash: true },
          ].map(({ k, v, ok, hash }) => (
            <div key={k} className="flex items-start justify-between gap-4 px-5 py-3.5 border-t border-line first:border-t-0 font-mono">
              <span className="text-[11px] tracking-[.1em] uppercase text-ink-3 flex-none pt-0.5">{k}</span>
              {hash ? (
                <span className="text-[12px] text-ink bg-paper border border-line rounded-[8px] px-2 py-0.5 text-right break-all">{v}</span>
              ) : (
                <span className={`text-[13px] font-semibold text-right ${ok ? 'text-up-ink' : 'text-ink'}`}>{v}</span>
              )}
            </div>
          ))}
        </div>

        <a
          href={`${EXPLORER}/tx/${round.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold tracking-[.06em] uppercase text-white bg-sig px-5 py-3 rounded-full shadow-sig"
        >
          View on Mantle Explorer ↗
        </a>
      </div>
    </div>
  )
}

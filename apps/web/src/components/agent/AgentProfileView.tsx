'use client'

// TODO (Phase B): Pull from AgentRegistry contract + ERC-8004 Identity Registry

const EXPLORER = 'https://explorer.sepolia.mantle.xyz'

const MOCK_AGENTS: Record<string, {
  name: string
  initials: string
  strategy: string
  wins: number
  losses: number
  acc: number
  streak: number
  identityAddr: string
  walletAddr: string
}> = {
  'axiom-7': {
    name: 'Axiom-7',
    initials: 'AX',
    strategy: 'Short-term momentum from Pyth price ticks (5-tick EMA crossover)',
    wins: 142,
    losses: 54,
    acc: 72.4,
    streak: 5,
    identityAddr: '0xABCD…1234',
    walletAddr: '0x1234…ABCD',
  },
}

interface AgentProfileViewProps {
  agentId: string
}

export function AgentProfileView({ agentId }: AgentProfileViewProps) {
  const agent = MOCK_AGENTS[agentId]

  if (!agent) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <p className="font-mono text-ink-3 text-[14px]">Agent not found.</p>
      </div>
    )
  }

  const total = agent.wins + agent.losses

  return (
    <div className="min-h-screen bg-paper py-16 px-4">
      <div className="max-w-[640px] mx-auto">
        <span className="font-mono text-[12px] font-semibold tracking-[.22em] uppercase text-sig flex items-center gap-2 mb-6">
          <span className="w-[22px] h-[2px] bg-sig rounded-full" />
          Agent profile
        </span>

        {/* identity card */}
        <div className="bg-surface border border-line rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-[18px] grid place-items-center text-white font-display font-black text-[22px]"
              style={{ background: 'linear-gradient(135deg, var(--sig), var(--sig-2))' }}>
              {agent.initials}
            </div>
            <div>
              <h1 className="font-display font-black text-[26px] tracking-[-0.03em] uppercase">{agent.name}</h1>
              <span className="font-mono text-[11px] tracking-[.1em] uppercase text-sig">AI Agent · ERC-8004</span>
            </div>
          </div>

          <p className="text-ink-2 text-[14px] leading-[1.55] mb-5">{agent.strategy}</p>

          {/* stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Wins', value: agent.wins, color: 'text-up-ink' },
              { label: 'Losses', value: agent.losses, color: 'text-down-ink' },
              { label: 'Accuracy', value: `${agent.acc}%`, color: 'text-ink' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-paper rounded border border-line p-3 text-center">
                <div className={`font-mono font-bold text-[20px] ${color}`}>{value}</div>
                <div className="font-mono text-[10px] tracking-[.14em] uppercase text-ink-3 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* on-chain identity */}
        <div className="bg-surface border border-line rounded-lg shadow overflow-hidden mb-6">
          <div className="px-5 py-3 bg-paper border-b border-line font-mono text-[10px] tracking-[.2em] uppercase text-ink-3">
            On-chain identity (ERC-8004)
          </div>
          {[
            { k: 'Identity address', v: agent.identityAddr },
            { k: 'Wallet address', v: agent.walletAddr },
            { k: 'Total rounds', v: String(total) },
            { k: 'Current streak', v: agent.streak > 0 ? `${agent.streak} wins` : 'None' },
          ].map(({ k, v }) => (
            <div key={k} className="flex justify-between items-center px-5 py-3.5 border-t border-line first:border-t-0 font-mono">
              <span className="text-[11px] tracking-[.1em] uppercase text-ink-3">{k}</span>
              <span className="text-[12px] bg-paper border border-line rounded-[8px] px-2 py-0.5">{v}</span>
            </div>
          ))}
        </div>

        <a
          href={`${EXPLORER}/address/${agent.walletAddr}`}
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

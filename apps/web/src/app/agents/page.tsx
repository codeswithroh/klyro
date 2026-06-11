import dynamic from 'next/dynamic'

export const metadata = {
  title: 'AI Agents — Klyro',
  description: 'ERC-8004 on-chain AI agent identities. Verifiable win rates, streaks, and prediction accuracy — permanently benchmarked on Mantle.',
}

const AgentsIndexView = dynamic(
  () => import('@/components/agent/AgentsIndexView').then((m) => m.AgentsIndexView),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-paper py-16 px-4">
        <div className="max-w-[860px] mx-auto">
          <div className="h-4 w-32 bg-paper-2 rounded animate-pulse mb-4" />
          <div className="h-10 w-48 bg-paper-2 rounded animate-pulse mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-paper-2 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    ),
  }
)

export default function AgentsPage() {
  return <AgentsIndexView />
}

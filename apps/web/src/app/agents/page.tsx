import { AgentsIndexView } from '@/components/agent/AgentsIndexView'

export const metadata = {
  title: 'AI Agents — Klyro',
  description: 'ERC-8004 on-chain AI agent identities. Verifiable win rates, streaks, and prediction accuracy — permanently benchmarked on Mantle.',
}

export default function AgentsPage() {
  return <AgentsIndexView />
}

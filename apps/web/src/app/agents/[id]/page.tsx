import { AgentProfileView } from '@/components/agent/AgentProfileView'

export const metadata = { title: 'Agent Profile — Klyro' }

export default function AgentPage({ params }: { params: { id: string } }) {
  return <AgentProfileView agentId={params.id} />
}

import { LeaderboardView } from '@/components/leaderboard/LeaderboardView'

// Dynamic: leaderboard reads live chain data and uses wallet hooks
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Leaderboard — Klyro' }

export default function LeaderboardPage() {
  return <LeaderboardView />
}

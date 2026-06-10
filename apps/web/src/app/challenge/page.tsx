import { ChallengeView } from '@/components/challenge/ChallengeView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Gauntlet — Klyro',
  description: 'Multi-round challenge mode. Best of 3 or 5 rounds — Human vs Axiom-7 AI on Mantle.',
}

export default function ChallengePage() {
  return <ChallengeView />
}

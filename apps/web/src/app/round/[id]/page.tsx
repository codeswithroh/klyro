import { RoundVerifyView } from '@/components/arena/RoundVerifyView'

export const metadata = { title: 'Round Proof — Klyro' }

export default function RoundPage({ params }: { params: { id: string } }) {
  return <RoundVerifyView roundId={params.id} />
}

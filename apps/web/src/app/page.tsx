import Link from 'next/link'
import { Wordmark } from '@/components/ui/Wordmark'
import { DuelCardPreview } from '@/components/arena/DuelCardPreview'

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-7 pt-16 pb-20 max-w-[1160px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
          <div>
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <span className="font-mono text-[11px] font-semibold tracking-[.14em] uppercase px-3 py-1.5 rounded-full bg-sig-wash text-sig-ink">
                Brand Identity v1
              </span>
              <span className="font-mono text-[11px] font-semibold tracking-[.14em] uppercase px-3 py-1.5 rounded-full border border-line-2 bg-surface text-ink-2">
                Mantle Sepolia
              </span>
              <span className="font-mono text-[11px] font-semibold tracking-[.14em] uppercase px-3 py-1.5 rounded-full border border-line-2 bg-surface text-ink-2">
                Human <span className="text-ink-3">vs</span> AI
              </span>
            </div>

            <div className="flex items-center font-display font-black uppercase leading-[.8] tracking-[-0.045em]"
              style={{ fontSize: 'clamp(72px, 16vw, 180px)' }}>
              KLYR<span className="wm-ring" style={{ width: '0.82em', height: '0.82em', margin: '0 0.005em' }}><i /></span>
            </div>

            <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[1.02] mt-6"
              style={{ fontSize: 'clamp(20px, 3.4vw, 38px)', maxWidth: '18ch' }}>
              Call it <span className="text-up">up</span>. Call it <span className="text-down">down</span>.
              <br />Out-predict the machine.
            </h1>

            <p className="mt-5 text-ink-2 text-[17px] leading-relaxed max-w-[46ch]">
              A fast, social price-prediction arena where humans go head-to-head against AI agents.
              Every call settled fairly and verifiably on-chain. No jargon. No seed phrases. Just one tap.
            </p>

            <div className="mt-8 flex gap-3 flex-wrap">
              <Link href="/arena"
                className="font-mono font-semibold text-[13px] tracking-[.04em] uppercase bg-sig text-white px-5 py-3.5 rounded-full shadow-sig transition-transform active:translate-y-px">
                Enter the arena →
              </Link>
              <Link href="/leaderboard"
                className="font-mono font-semibold text-[13px] tracking-[.04em] uppercase bg-surface text-ink border border-line-2 px-5 py-3.5 rounded-full transition-transform active:translate-y-px">
                View leaderboard
              </Link>
            </div>
          </div>

          <div className="flex justify-center order-first lg:order-last">
            <DuelCardPreview />
          </div>
        </div>
      </section>

      {/* Why it's fair */}
      <section className="border-t border-line py-20">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="mb-10">
            <span className="font-mono text-[12px] font-semibold tracking-[.22em] uppercase text-sig flex items-center gap-2">
              <span className="w-[22px] h-[2px] bg-sig rounded-full inline-block" />
              How it works
            </span>
            <h2 className="font-display font-extrabold uppercase tracking-[-0.03em] leading-[.98] mt-4"
              style={{ fontSize: 'clamp(30px, 4.4vw, 52px)' }}>
              Provably fair.<br />Every round.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                n: '1',
                title: 'Lock your call',
                body: 'Pick UP or DOWN before the countdown ends. Both you and the AI commit on-chain — no takebacks.',
              },
              {
                n: '2',
                title: 'Oracle resolves',
                body: 'When the window closes, a Pyth Network price feed reads the result. The smart contract settles autonomously.',
              },
              {
                n: '3',
                title: 'Verify yourself',
                body: 'Every round links to its Mantle Sepolia transaction. Trust is provable, not promised.',
              },
            ].map((step) => (
              <div key={step.n} className="bg-surface border border-line rounded-lg p-6 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-sig text-white font-display font-black text-[13px] grid place-items-center mb-4">
                  {step.n}
                </div>
                <h4 className="font-display font-extrabold uppercase text-[16px] tracking-[-0.01em]">{step.title}</h4>
                <p className="mt-2 text-ink-2 text-[14px] leading-[1.55]">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="border-t border-line py-20">
        <div className="max-w-[1160px] mx-auto px-7 text-center">
          <p className="font-mono text-[12px] font-semibold tracking-[.22em] uppercase text-ink-3 mb-4">
            30 seconds to your first prediction
          </p>
          <Link href="/arena"
            className="inline-flex font-mono font-semibold text-[14px] tracking-[.04em] uppercase bg-sig text-white px-8 py-4 rounded-full shadow-sig transition-transform active:translate-y-px">
            Play now — it's free
          </Link>
        </div>
      </section>
    </>
  )
}

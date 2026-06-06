import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

const W = 1200
const H = 630

// Brand tokens
const SIG    = '#6C2BF2'
const SIG2   = '#9A6BFF'
const UP     = '#07BE6A'
const DOWN   = '#F12E49'
const INK    = '#131119'
const PAPER  = '#EEEDF2'
const INK2   = '#565463'
const INK3   = '#8B8995'
const UP_WASH   = '#DBF7E9'
const UP_INK    = '#04713F'
const SIG_WASH  = '#EDE6FF'
const SIG_INK   = '#3B1690'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl

  const won      = searchParams.get('won') === 'true'
  const asset    = searchParams.get('asset') ?? 'ETH/USD'
  const delta    = searchParams.get('delta') ?? '+0.00%'
  const dir      = searchParams.get('dir') ?? 'up'
  const opponent = searchParams.get('opponent') ?? 'Axiom-7'
  const points   = searchParams.get('points') ?? '0'
  const streak   = searchParams.get('streak') ?? '0'
  const mode     = searchParams.get('mode') ?? 'result'

  const [archivo700, archivo900] = await Promise.all([
    fetch(new URL('/fonts/archivo-700.ttf', origin)).then((r) => r.arrayBuffer()),
    fetch(new URL('/fonts/archivo-900.ttf', origin)).then((r) => r.arrayBuffer()),
  ])

  const fonts = [
    { name: 'Archivo', data: archivo700, weight: 700 as const, style: 'normal' as const },
    { name: 'Archivo', data: archivo900, weight: 900 as const, style: 'normal' as const },
  ]

  // ── Default / landing card ─────────────────────────────────────────────────
  if (mode === 'default') {
    return new ImageResponse(
      (
        <div style={{ width: W, height: H, background: PAPER, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', padding: '64px 72px', fontFamily: '"Archivo"' }}>

          {/* wordmark row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: '"Archivo"', fontWeight: 900, fontSize: 52, letterSpacing: '-0.04em', textTransform: 'uppercase', color: INK }}>
              KLYRO
            </span>
            <span style={{ fontFamily: '"Archivo"', fontWeight: 700, fontSize: 14, letterSpacing: '0.2em', textTransform: 'uppercase', color: SIG, padding: '6px 14px', background: SIG_WASH, borderRadius: 999 }}>
              Mantle Sepolia
            </span>
          </div>

          {/* headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', fontFamily: '"Archivo"', fontWeight: 900, fontSize: 96, lineHeight: 0.9, letterSpacing: '-0.04em', textTransform: 'uppercase' }}>
              <span style={{ color: INK }}>OUT-PREDICT</span>
              <span style={{ color: SIG }}>THE MACHINE.</span>
            </div>
            <div style={{ fontFamily: '"Archivo"', fontWeight: 700, fontSize: 26, color: INK2, marginTop: 16, maxWidth: 680, lineHeight: 1.4 }}>
              Human vs AI price predictions — settled on-chain. No seed phrase. No gas.
            </div>
          </div>

          {/* footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ fontFamily: '"Archivo"', fontWeight: 900, fontSize: 18, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff', background: SIG, padding: '14px 28px', borderRadius: 999 }}>
              Play now
            </div>
            <div style={{ fontFamily: '"Archivo"', fontWeight: 700, fontSize: 16, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK3 }}>
              klyro.xyz
            </div>
            <div style={{ fontFamily: '"Archivo"', fontWeight: 700, fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', color: SIG, background: SIG_WASH, padding: '6px 14px', borderRadius: 999 }}>
              #MantleAI
            </div>
          </div>
        </div>
      ),
      { width: W, height: H, fonts }
    )
  }

  // ── Result card ─────────────────────────────────────────────────────────────
  const outcomeColor = won ? UP : DOWN
  const deltaColor   = dir === 'up' ? UP : DOWN
  const streakNum    = parseInt(streak, 10)
  const pointsNum    = parseInt(points, 10)

  // Agent initials from name
  const agentInitials = opponent.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  // Human's call direction: if won, they called correctly i.e. same as dir
  const humanDir = won ? dir : (dir === 'up' ? 'down' : 'up')
  const agentDir = won ? (dir === 'up' ? 'down' : 'up') : dir // agent called opposite of winner

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, background: PAPER, display: 'flex', flexDirection: 'column', fontFamily: '"Archivo"', position: 'relative' }}>

        {/* top accent bar */}
        <div style={{ width: W, height: 10, background: outcomeColor, display: 'flex' }} />

        {/* main body */}
        <div style={{ display: 'flex', flex: 1, padding: '44px 64px', gap: 56, alignItems: 'center' }}>

          {/* LEFT: outcome + stats */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 0 }}>

            {/* BIG outcome */}
            <div style={{ display: 'flex', flexDirection: 'column', fontFamily: '"Archivo"', fontWeight: 900, fontSize: 108, lineHeight: 0.86, letterSpacing: '-0.045em', textTransform: 'uppercase', color: outcomeColor }}>
              <span>YOU</span>
              <span>{won ? 'WON.' : 'LOST.'}</span>
            </div>

            {/* asset + delta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 28 }}>
              <span style={{ fontFamily: '"Archivo"', fontWeight: 900, fontSize: 28, letterSpacing: '-0.01em', color: INK }}>
                {asset}
              </span>
              <span style={{ fontFamily: '"Archivo"', fontWeight: 900, fontSize: 28, color: deltaColor }}>
                {dir === 'up' ? '+' : ''}{delta}
              </span>
            </div>

            {/* vs line */}
            <div style={{ fontFamily: '"Archivo"', fontWeight: 700, fontSize: 22, color: INK2, marginTop: 12 }}>
              {won ? `Beat ${opponent}` : `Lost to ${opponent}`}
            </div>

            {/* badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 28 }}>
              {pointsNum > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', background: SIG_WASH, borderRadius: 999, padding: '8px 20px' }}>
                  <span style={{ fontFamily: '"Archivo"', fontWeight: 900, fontSize: 18, color: SIG_INK }}>+{points} pts</span>
                </div>
              )}
              {streakNum >= 2 && (
                <div style={{ display: 'flex', alignItems: 'center', background: UP_WASH, borderRadius: 999, padding: '8px 20px' }}>
                  <span style={{ fontFamily: '"Archivo"', fontWeight: 900, fontSize: 18, color: UP_INK }}>{streak}x streak</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: duel card */}
          <div style={{ display: 'flex', flexDirection: 'column', width: 340, background: '#fff', borderRadius: 28, border: '1px solid #E0DFE8', overflow: 'hidden' }}>

            {/* card header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: PAPER }}>
              <span style={{ fontFamily: '"Archivo"', fontWeight: 900, fontSize: 18, letterSpacing: '-0.04em', textTransform: 'uppercase', color: INK }}>KLYRO</span>
              <span style={{ fontFamily: '"Archivo"', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK3 }}>{asset}</span>
            </div>

            {/* duel row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px', gap: 10 }}>

              {/* human */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, background: PAPER, borderRadius: 14, padding: '16px 10px', border: `2px solid ${outcomeColor}` }}>
                <div style={{ display: 'flex', width: 44, height: 44, borderRadius: 14, background: outcomeColor, alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: '"Archivo"', fontWeight: 900, fontSize: 14, color: '#fff' }}>YOU</span>
                </div>
                <span style={{ fontFamily: '"Archivo"', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: INK3 }}>Human</span>
                <span style={{ fontFamily: '"Archivo"', fontWeight: 900, fontSize: 16, textTransform: 'uppercase', color: humanDir === 'up' ? UP : DOWN }}>
                  {humanDir === 'up' ? 'UP' : 'DOWN'}
                </span>
              </div>

              {/* VS badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: '#fff', border: `2px solid ${INK}` }}>
                <span style={{ fontFamily: '"Archivo"', fontWeight: 900, fontSize: 12, color: INK }}>VS</span>
              </div>

              {/* agent */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, background: PAPER, borderRadius: 14, padding: '16px 10px', border: '1px solid #E0DFE8' }}>
                <div style={{ display: 'flex', width: 44, height: 44, borderRadius: 14, background: SIG, alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: '"Archivo"', fontWeight: 900, fontSize: 14, color: '#fff' }}>{agentInitials}</span>
                </div>
                <span style={{ fontFamily: '"Archivo"', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: SIG }}>{opponent}</span>
                <span style={{ fontFamily: '"Archivo"', fontWeight: 900, fontSize: 16, textTransform: 'uppercase', color: agentDir === 'up' ? UP : DOWN }}>
                  {agentDir === 'up' ? 'UP' : 'DOWN'}
                </span>
              </div>
            </div>

            {/* on-chain badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px 18px' }}>
              <span style={{ fontFamily: '"Archivo"', fontWeight: 700, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: SIG_INK, background: SIG_WASH, padding: '5px 14px', borderRadius: 999 }}>
                Settled on-chain · Mantle
              </span>
            </div>
          </div>
        </div>

        {/* footer bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 64px 28px' }}>
          <span style={{ fontFamily: '"Archivo"', fontWeight: 900, fontSize: 26, letterSpacing: '-0.04em', textTransform: 'uppercase', color: INK }}>KLYRO</span>
          <span style={{ fontFamily: '"Archivo"', fontWeight: 700, fontSize: 15, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK3 }}>Can you out-predict the machine?</span>
          <span style={{ fontFamily: '"Archivo"', fontWeight: 700, fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', color: SIG_INK, background: SIG_WASH, padding: '6px 14px', borderRadius: 999 }}>#MantleAI</span>
        </div>
      </div>
    ),
    { width: W, height: H, fonts }
  )
}

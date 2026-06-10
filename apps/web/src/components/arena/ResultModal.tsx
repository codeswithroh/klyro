'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useActiveAccount, useSendTransaction } from 'thirdweb/react'
import { prepareContractCall, getContract, defineChain } from 'thirdweb'
import { thirdwebClient } from '@/lib/contracts/thirdweb-client'
import { mantleSepolia } from '@/lib/contracts/chain'
import { CONTRACTS } from '@/lib/contracts/addresses'
import { BATTLE_RESULT_NFT_ABI } from '@/lib/contracts/abis'
import { createPublicClient, http } from 'viem'
import type { Call } from '@/lib/store/roundStore'

const twChain = defineChain({
  id: mantleSepolia.id,
  rpc: mantleSepolia.rpcUrls.default.http[0],
  nativeCurrency: mantleSepolia.nativeCurrency,
})

// ── Speed multiplier ─────────────────────────────────────────────────────────

export function getDurationMultiplier(duration: number): number {
  if (duration <= 15) return 4
  if (duration <= 30) return 2
  if (duration <= 45) return 1.5
  return 1
}

export function getDurationLabel(duration: number): string {
  if (duration <= 15) return '4× speed bonus'
  if (duration <= 30) return '2× speed bonus'
  if (duration <= 45) return '1.5× speed bonus'
  return 'standard'
}

export function calcPoints(verdict: 'win' | 'lose' | 'draw', duration: number): number {
  const base = verdict === 'win' ? 100 : verdict === 'draw' ? 25 : 0
  return Math.round(base * getDurationMultiplier(duration))
}

// ── Strategy type + badge classifier ────────────────────────────────────────

export interface BattleAnalysis {
  strategyType: string
  strategyDesc: string
  badge: string
  badgeIcon: string
}

export function classifyBattle(
  humanCall: Call,
  agentCall: Call | null,
  outcome: Call,
  verdict: 'win' | 'lose' | 'draw',
): BattleAnalysis {
  const agreedWithBot = agentCall !== null && humanCall === agentCall
  const humanRight = humanCall === outcome
  const agentRight = agentCall !== null && agentCall === outcome

  if (verdict === 'win') {
    if (!agreedWithBot) {
      return humanCall === 'up'
        ? { strategyType: 'Momentum Alpha',  strategyDesc: 'Rode the bull — left the AI behind',    badge: 'AI Slayer',      badgeIcon: '🗡️' }
        : { strategyType: 'Contrarian Alpha', strategyDesc: 'Bet against the trend — nailed it',      badge: 'AI Slayer',      badgeIcon: '🗡️' }
    }
    return { strategyType: 'Sharp Consensus', strategyDesc: 'Synced with the machine — both won',      badge: 'Market Oracle',  badgeIcon: '🔮' }
  }

  if (verdict === 'lose') {
    return humanCall === 'up'
      ? { strategyType: 'Bull Conviction',  strategyDesc: 'Held the long — market disagreed this time', badge: 'Level Up', badgeIcon: '⬆️' }
      : { strategyType: 'Bear Conviction',  strategyDesc: 'Took the short — timing was off',             badge: 'Level Up', badgeIcon: '⬆️' }
  }

  if (humanRight && agentRight)
    return { strategyType: 'Parallel Intelligence', strategyDesc: 'Both called it — no edge separated you', badge: 'Mind Sync',  badgeIcon: '🧠' }
  if (!humanRight && !agentRight)
    return { strategyType: 'Volatile Market',  strategyDesc: 'Market surprised everyone',            badge: 'Chaos Pair', badgeIcon: '⚡' }
  return   { strategyType: 'Neutral Ground',   strategyDesc: 'No edge either way',                    badge: 'Balanced',   badgeIcon: '⚖️' }
}

// ── Canvas download card ──────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function downloadBattleCard(opts: {
  verdict: 'win' | 'lose' | 'draw'
  humanCall: Call
  agentCall: Call | null
  outcome: Call
  startPrice: number
  closePrice: number
  roundId: bigint | number
  duration: number
  analysis: BattleAnalysis
  pts: number
}) {
  const { verdict, humanCall, agentCall, outcome, startPrice, closePrice,
          roundId, duration, analysis, pts } = opts

  const W = 800, H = 1060
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  const accent = verdict === 'win' ? '#10b981' : verdict === 'lose' ? '#f43f5e' : '#fbbf24'
  const accentDim = verdict === 'win' ? 'rgba(16,185,129,0.15)' : verdict === 'lose' ? 'rgba(244,63,94,0.15)' : 'rgba(251,191,36,0.15)'
  const accentBorder = verdict === 'win' ? 'rgba(16,185,129,0.4)' : verdict === 'lose' ? 'rgba(244,63,94,0.4)' : 'rgba(251,191,36,0.4)'

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#02040A'); bg.addColorStop(1, '#0A0418')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // Glow blob
  const glow = ctx.createRadialGradient(W/2, H*0.35, 0, W/2, H*0.35, 420)
  glow.addColorStop(0, accent + '22'); glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)

  // Card border
  ctx.strokeStyle = accentBorder; ctx.lineWidth = 2
  roundRect(ctx, 16, 16, W-32, H-32, 28)
  ctx.stroke()

  // Header row
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  roundRect(ctx, 40, 36, W-80, 54, 27)
  ctx.fill()
  ctx.font = 'bold 18px monospace'; ctx.fillStyle = accent
  ctx.textAlign = 'left'; ctx.fillText('KLYRO', 68, 69)
  ctx.font = '14px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.textAlign = 'center'; ctx.fillText('BATTLE CARD', W/2, 69)
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillText(`Round #${roundId}`, W-68, 69)

  // Verdict
  const vLabel = verdict === 'win' ? 'YOU WON' : verdict === 'lose' ? 'YOU LOST' : "IT'S A DRAW"
  ctx.textAlign = 'center'
  ctx.font = 'bold 72px monospace'; ctx.fillStyle = accent
  ctx.shadowColor = accent; ctx.shadowBlur = 40
  ctx.fillText(vLabel, W/2, 210)
  ctx.shadowBlur = 0

  // Strategy type pill
  ctx.fillStyle = accentDim
  roundRect(ctx, W/2 - 180, 228, 360, 38, 19)
  ctx.fill()
  ctx.strokeStyle = accentBorder; ctx.lineWidth = 1
  roundRect(ctx, W/2 - 180, 228, 360, 38, 19)
  ctx.stroke()
  ctx.font = '15px monospace'; ctx.fillStyle = accent
  ctx.fillText(analysis.strategyType, W/2, 252)

  // Separator
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(60, 290); ctx.lineTo(W-60, 290); ctx.stroke()

  // YOU vs AXIOM-7
  ctx.font = '13px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillText('YOU  vs  AXIOM-7', W/2, 322)

  // Calls
  const humanColor = humanCall === 'up' ? '#10b981' : '#f43f5e'
  const agentColor = agentCall === 'up' ? '#10b981' : '#f43f5e'
  ctx.font = 'bold 36px monospace'
  ctx.textAlign = 'left'; ctx.fillStyle = humanColor
  ctx.fillText((humanCall === 'up' ? '▲ HIGHER' : '▼ LOWER'), 100, 370)
  if (agentCall) {
    ctx.textAlign = 'right'; ctx.fillStyle = agentColor
    ctx.fillText((agentCall === 'up' ? '▲ HIGHER' : '▼ LOWER'), W-100, 370)
  } else {
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.fillText('No call', W-100, 370)
  }

  // Points
  ctx.font = 'bold 52px monospace'
  ctx.textAlign = 'left'; ctx.fillStyle = '#10b981'
  ctx.fillText(String(pts), 100, 440)
  ctx.font = '16px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillText('pts', 100 + ctx.measureText(String(pts)).width + 8, 440)
  if (verdict === 'lose') {
    ctx.font = 'bold 52px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#f43f5e'
    ctx.fillText('100', W-100, 440)
    ctx.font = '16px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.textAlign = 'right'; ctx.fillText('pts', W-100, 462)
  }

  // Separator
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(60, 475); ctx.lineTo(W-60, 475); ctx.stroke()

  // ETH move
  const pct = startPrice > 0 ? ((closePrice - startPrice) / startPrice) * 100 : 0
  const deltaStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(3)}%`
  const moveColor = pct >= 0 ? '#10b981' : '#f43f5e'
  ctx.textAlign = 'center'
  ctx.font = '14px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillText('ETH PRICE MOVEMENT', W/2, 512)
  ctx.font = 'bold 40px monospace'; ctx.fillStyle = moveColor
  ctx.fillText(`${pct >= 0 ? '▲' : '▼'} ${deltaStr}`, W/2, 562)
  ctx.font = '14px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillText(
    `$${startPrice.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}  →  $${closePrice.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
    W/2, 592,
  )
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillText(`${duration}s round · ${getDurationLabel(duration)}`, W/2, 616)

  // Separator
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath(); ctx.moveTo(60, 645); ctx.lineTo(W-60, 645); ctx.stroke()

  // Badge
  ctx.font = '52px serif'; ctx.textAlign = 'center'
  ctx.fillText(analysis.badgeIcon, W/2, 720)
  ctx.font = 'bold 22px monospace'; ctx.fillStyle = accent
  ctx.fillText(analysis.badge, W/2, 756)
  ctx.font = '14px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillText('Badge earned this round', W/2, 782)

  // Footer separator
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.beginPath(); ctx.moveTo(60, 820); ctx.lineTo(W-60, 820); ctx.stroke()

  // Footer
  ctx.font = '13px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.fillText('Settled on Mantle Network · Human vs AI', W/2, 858)
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = accent; ctx.globalAlpha = 0.5
  ctx.fillText('klyro.xyz', W/2, 886)
  ctx.globalAlpha = 1

  // Trigger download
  const link = document.createElement('a')
  link.download = `klyro-battle-${roundId}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

// ── Confetti ─────────────────────────────────────────────────────────────────

interface Piece { x:number;y:number;vx:number;vy:number;color:string;w:number;h:number;rot:number;rv:number }

function useConfetti(active: boolean, canvasRef: React.RefObject<HTMLCanvasElement>) {
  const pieces = useRef<Piece[]>([]); const raf = useRef(0); const frame = useRef(0)
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
    const cv = canvas
    const pal = ['#10b981','#34d399','#fbbf24','#f59e0b','#9A6BFF','#6C2BF2','#00ff9d','#fff','#f472b6','#60a5fa']
    pieces.current = [0.3,0.7].flatMap(ox => Array.from({length:90},()=>({
      x: cv.width*ox+(Math.random()-.5)*40, y: cv.height*.35,
      vx:(Math.random()-.5)*12, vy:-(6+Math.random()*10),
      color:pal[Math.floor(Math.random()*pal.length)],
      w:6+Math.random()*10, h:4+Math.random()*6,
      rot:Math.random()*Math.PI*2, rv:(Math.random()-.5)*.25,
    })))
    function draw() {
      ctx.clearRect(0,0,cv.width,cv.height)
      frame.current++
      pieces.current = pieces.current.filter(p=>p.y<cv.height+30)
      for (const p of pieces.current) {
        p.vy+=.22; p.vx*=.99
        p.x+=p.vx+Math.sin(frame.current*.04+p.y*.01)*.8; p.y+=p.vy; p.rot+=p.rv
        ctx.save(); ctx.globalAlpha=Math.max(0,1-p.y/(cv.height*1.1))
        ctx.translate(p.x,p.y); ctx.rotate(p.rot)
        ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h)
        ctx.restore()
      }
      if (pieces.current.length>0) raf.current=requestAnimationFrame(draw)
    }
    raf.current=requestAnimationFrame(draw)
    return ()=>{cancelAnimationFrame(raf.current);pieces.current=[]}
  },[active,canvasRef])
}

interface Drop{x:number;y:number;speed:number;len:number;alpha:number}
function useRain(active:boolean,canvasRef:React.RefObject<HTMLCanvasElement>){
  const drops=useRef<Drop[]>([]); const raf=useRef(0)
  useEffect(()=>{
    if(!active)return
    const canvas=canvasRef.current; if(!canvas)return
    const ctx=canvas.getContext('2d')!
    canvas.width=window.innerWidth; canvas.height=window.innerHeight
    const cv=canvas
    drops.current=Array.from({length:80},()=>({x:Math.random()*cv.width,y:Math.random()*cv.height,speed:4+Math.random()*6,len:12+Math.random()*20,alpha:.15+Math.random()*.35}))
    function draw(){
      ctx.clearRect(0,0,cv.width,cv.height)
      for(const d of drops.current){
        d.y+=d.speed; if(d.y>cv.height+d.len)d.y=-d.len
        ctx.save();ctx.globalAlpha=d.alpha;ctx.strokeStyle='#f43f5e';ctx.lineWidth=1
        ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-1,d.y+d.len);ctx.stroke();ctx.restore()
      }
      raf.current=requestAnimationFrame(draw)
    }
    raf.current=requestAnimationFrame(draw)
    return ()=>cancelAnimationFrame(raf.current)
  },[active,canvasRef])
}

// ── Mint hook ─────────────────────────────────────────────────────────────────

type MintState = 'idle'|'checking'|'minting'|'done'|'error'

function useMintBattle(
  playerAddress:string|undefined,
  roundId:bigint|number,
  humanCall:Call, outcome:Call,
  verdict:'win'|'lose'|'draw',
){
  const [mintState,setMintState]=useState<MintState>('idle')
  const [alreadyMinted,setAlreadyMinted]=useState(false)
  const [mintedTokenId,setMintedTokenId]=useState<number|null>(null)
  const [mintError,setMintError]=useState<string|null>(null)
  const {mutateAsync:sendTx}=useSendTransaction()

  useEffect(()=>{
    if(!playerAddress)return
    const viemClient=createPublicClient({
      chain:{id:mantleSepolia.id,name:mantleSepolia.name,nativeCurrency:mantleSepolia.nativeCurrency,
        rpcUrls:{default:{http:[mantleSepolia.rpcUrls.default.http[0]]}}}as any,
      transport:http(),
    })
    setMintState('checking')
    viemClient.readContract({
      address:CONTRACTS.BattleResultNFT as `0x${string}`,
      abi:BATTLE_RESULT_NFT_ABI,
      functionName:'hasMinted',
      args:[playerAddress as `0x${string}`,BigInt(roundId)],
    }).then(has=>{setAlreadyMinted(!!has);setMintState('idle')}).catch(()=>setMintState('idle'))
  },[playerAddress,roundId])

  const mint=useCallback(async()=>{
    if(!playerAddress)return
    setMintState('minting'); setMintError(null)
    try{
      const verdictNum=verdict==='win'?0:verdict==='lose'?1:2
      const contract=getContract({client:thirdwebClient,chain:twChain,address:CONTRACTS.BattleResultNFT as `0x${string}`,abi:BATTLE_RESULT_NFT_ABI as any})
      const tx=prepareContractCall({
        contract,
        method:'function mintBattle(address player,uint256 roundId,bool humanCall,bool outcome,uint8 verdict) returns (uint256 tokenId)',
        params:[playerAddress as `0x${string}`,BigInt(roundId),humanCall==='up',outcome==='up',verdictNum],
      })
      const receipt=await sendTx(tx as any)
      try{
        const log=(receipt as any).logs?.find((l:any)=>l.topics?.[0]==='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef')
        if(log?.topics?.[3])setMintedTokenId(parseInt(log.topics[3],16))
      }catch{}
      setAlreadyMinted(true); setMintState('done')
    }catch(e:unknown){
      const msg=(e as Error).message??'Mint failed'
      if(msg.includes('AlreadyMinted')){setAlreadyMinted(true);setMintState('done')}
      else{setMintError(msg.slice(0,80));setMintState('error')}
    }
  },[playerAddress,roundId,humanCall,outcome,verdict,sendTx])

  return{mintState,alreadyMinted,mintedTokenId,mintError,mint}
}

// ── Flavour text ──────────────────────────────────────────────────────────────

const WIN_MSGS  = ['The AI is writing its resignation letter 🤖','Axiom-7 is in shambles. You destroyed it.','Peak performance. The algorithm weeps.','Touch grass? Never. Win again? Always.']
const LOSE_MSGS = ['The AI is doing a victory lap.','Axiom-7 predicted your failure. It was right.','L + ratio + you got rekt by a bot 💀','The algorithm sends its regards.']
const DRAW_MSGS = ['You two have the same brain cell, apparently.','The AI copied your homework. Classic.','Synchronized stupidity / genius. Unclear which.','Call it a truce. For now.']

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ResultModalProps {
  verdict: 'win'|'lose'|'draw'
  humanCall: Call
  agentCall: Call|null
  outcome: Call
  startPrice: number
  closePrice: number
  roundId: bigint|number
  txHash?: string
  duration?: number   // seconds — used for multiplier
  onPlayAgain: () => void
}

// ── Main component ────────────────────────────────────────────────────────────

export function ResultModal({
  verdict, humanCall, agentCall, outcome,
  startPrice, closePrice, roundId, txHash,
  duration = 60,
  onPlayAgain,
}: ResultModalProps) {
  const [mounted,setMounted]=useState(false)
  const [downloading,setDownloading]=useState(false)
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const account=useActiveAccount()

  const msgPool=verdict==='win'?WIN_MSGS:verdict==='lose'?LOSE_MSGS:DRAW_MSGS
  const msgRef=useRef(msgPool[Math.floor(Math.random()*msgPool.length)])

  const analysis=classifyBattle(humanCall,agentCall,outcome,verdict)
  const pts=calcPoints(verdict,duration)
  const agentPts=calcPoints(verdict==='win'?'lose':verdict==='lose'?'win':'draw',duration)

  const {mintState,alreadyMinted,mintedTokenId,mintError,mint}=useMintBattle(
    account?.address,roundId,humanCall,outcome,verdict,
  )

  useEffect(()=>{const t=setTimeout(()=>setMounted(true),40);return()=>clearTimeout(t)},[])
  useConfetti(verdict==='win'&&mounted,canvasRef as React.RefObject<HTMLCanvasElement>)
  useRain(verdict==='lose'&&mounted,canvasRef as React.RefObject<HTMLCanvasElement>)

  const pct=startPrice>0?((closePrice-startPrice)/startPrice)*100:0
  const deltaText=`${pct>=0?'+':''}${pct.toFixed(3)}%`

  const accent    = verdict==='win'?'#10b981':verdict==='lose'?'#f43f5e':'#fbbf24'
  const glowColor = verdict==='win'?'rgba(16,185,129,0.2)':verdict==='lose'?'rgba(244,63,94,0.2)':'rgba(251,191,36,0.18)'
  const bgColor   = verdict==='win'?'rgba(0,12,6,0.97)':verdict==='lose'?'rgba(12,0,4,0.97)':'rgba(8,6,0,0.97)'
  const cardBg    = verdict==='win'?'linear-gradient(160deg,#010f06,#021a0c)':verdict==='lose'?'linear-gradient(160deg,#0f0105,#1c0207)':'linear-gradient(160deg,#0d0900,#1a1000)'
  const borderCol = verdict==='win'?'rgba(16,185,129,0.4)':verdict==='lose'?'rgba(244,63,94,0.4)':'rgba(251,191,36,0.38)'

  // Share to X
  const BASE_URL=typeof window!=='undefined'?window.location.origin:'https://klyro.xyz'
  const shareText=verdict==='win'
    ?`I just out-predicted Axiom-7 AI on @KlyroHQ! ${humanCall==='up'?'▲ HIGHER':'▼ LOWER'} — ETH moved ${deltaText} in ${duration}s. Earned ${pts} pts + ${analysis.badgeIcon} ${analysis.badge} badge. #Klyro #Mantle #HumanVsAI`
    :verdict==='lose'
    ?`Axiom-7 AI got me on @KlyroHQ — called ${humanCall==='up'?'▲ HIGHER':'▼ LOWER'} but ETH went ${outcome==='up'?'▲':'▼'} ${deltaText}. Rematch time. #Klyro #Mantle`
    :`Drew with Axiom-7 AI on @KlyroHQ — ${analysis.strategyType} in ${duration}s. #Klyro #Mantle`
  const tweetUrl=`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText+'\n'+BASE_URL+'/round/'+roundId)}`

  const ctaLabel=verdict==='win'?'🔁  Play Again':verdict==='lose'?'🔄  Rematch':'⚖️  Break the Tie'
  const ctaBg=verdict==='win'?'linear-gradient(135deg,#059669,#10b981)':verdict==='lose'?'linear-gradient(135deg,#6C2BF2,#7c3af5)':'linear-gradient(135deg,#b45309,#d97706)'
  const EXPLORER='https://explorer.sepolia.mantle.xyz'

  function handleDownload(){
    setDownloading(true)
    downloadBattleCard({verdict,humanCall,agentCall,outcome,startPrice,closePrice,roundId,duration,analysis,pts})
    setTimeout(()=>setDownloading(false),800)
  }

  const drawReason=agentCall===null?'Bot didn\'t predict this round'
    :humanCall===agentCall?`Both called ${humanCall==='up'?'▲ Higher':'▼ Lower'} — no edge`:''

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{background:bgColor,backdropFilter:'blur(12px)',
        opacity:mounted?1:0,transition:'opacity 0.4s ease',overflowY:'auto'}}>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{zIndex:0}}/>

      <div className="relative z-10 w-full max-w-[380px] my-4"
        style={{
          background:cardBg,
          border:`1px solid ${borderCol}`,
          borderRadius:24,
          boxShadow:`0 0 80px ${glowColor},0 0 200px ${glowColor},0 24px 60px rgba(0,0,0,0.85)`,
          transform:mounted?'translateY(0) scale(1)':'translateY(32px) scale(0.93)',
          transition:'transform 0.45s cubic-bezier(0.34,1.56,0.64,1)',
          overflow:'hidden',
        }}>

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="font-mono text-[10px] tracking-[.18em] uppercase text-white/25">Klyro Battle</span>
          <span className="font-mono text-[10px] text-white/20">Round #{Number(roundId)}</span>
        </div>

        {/* ── Verdict hero ── */}
        <div className="px-5 pb-4 text-center">
          <div className="font-display font-black leading-none uppercase"
            style={{
              fontSize:54,
              color:accent,
              textShadow:`0 0 40px ${accent},0 0 80px ${glowColor}`,
              animation:verdict==='win'?'rPulseG 1.8s ease-in-out infinite':verdict==='lose'?'rShake .5s cubic-bezier(.36,.07,.19,.97) .5s both':'rPulseY 1.8s ease-in-out infinite',
            }}>
            {verdict==='win'?'YOU WON':verdict==='lose'?'YOU LOST':"DRAW"}
          </div>
          <p className="font-mono text-[11px] text-white/35 italic mt-1.5 leading-snug">{msgRef.current}</p>
          {verdict==='draw'&&drawReason&&(
            <p className="font-mono text-[10px] text-[#fbbf24]/45 mt-1">{drawReason}</p>
          )}
        </div>

        {/* ── Strategy + Badge ── */}
        <div className="mx-5 mb-4 rounded-2xl p-4 flex items-center gap-4"
          style={{background:`${accent}10`,border:`1px solid ${accent}25`}}>
          <div className="text-[42px] leading-none">{analysis.badgeIcon}</div>
          <div className="flex-1 min-w-0">
            <div className="font-mono font-bold text-[14px] truncate" style={{color:accent}}>{analysis.strategyType}</div>
            <div className="font-mono text-[10px] text-white/35 leading-snug mt-0.5 truncate">{analysis.strategyDesc}</div>
            <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full"
              style={{background:`${accent}20`,border:`1px solid ${accent}35`}}>
              <span className="font-mono text-[9px] font-bold tracking-[.12em] uppercase" style={{color:accent}}>{analysis.badge}</span>
            </div>
          </div>
          {/* Speed badge */}
          {duration<60&&(
            <div className="shrink-0 text-center">
              <div className="font-mono font-black text-[18px]" style={{color:accent}}>{getDurationMultiplier(duration)}×</div>
              <div className="font-mono text-[8px] text-white/30 uppercase tracking-[.08em]">speed</div>
            </div>
          )}
        </div>

        {/* ── Score comparison ── */}
        <div className="mx-5 mb-4 rounded-2xl overflow-hidden"
          style={{background:'rgba(255,255,255,0.035)',border:'1px solid rgba(255,255,255,0.07)'}}>

          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_1fr] px-4 pt-3 pb-2">
            <div className="text-center">
              <div className="font-mono text-[9px] tracking-[.14em] uppercase text-white/30 mb-1">You</div>
              <div className="font-display font-black text-[17px]"
                style={{color:humanCall==='up'?'#10b981':'#f43f5e'}}>
                {humanCall==='up'?'▲':'▼'} {humanCall==='up'?'Higher':'Lower'}
              </div>
            </div>
            <div className="flex items-center px-3">
              <span className="font-mono text-[11px] text-white/20 font-bold">VS</span>
            </div>
            <div className="text-center">
              <div className="font-mono text-[9px] tracking-[.14em] uppercase text-white/30 mb-1">Axiom-7</div>
              {agentCall
                ?<div className="font-display font-black text-[17px]"
                    style={{color:agentCall==='up'?'#10b981':'#f43f5e'}}>
                    {agentCall==='up'?'▲':'▼'} {agentCall==='up'?'Higher':'Lower'}
                  </div>
                :<div className="font-mono text-[12px] text-white/20 italic">No call</div>
              }
            </div>
          </div>

          {/* Pts bar */}
          <div className="grid grid-cols-[1fr_auto_1fr] px-4 py-3 border-t"
            style={{borderColor:'rgba(255,255,255,0.06)'}}>
            <div className="text-center">
              <div className="font-display font-black text-[32px] leading-none"
                style={{color:pts>0?'#10b981':'rgba(255,255,255,0.25)'}}>{pts}</div>
              <div className="font-mono text-[9px] text-white/25 mt-0.5 uppercase tracking-[.1em]">pts</div>
            </div>
            <div className="flex items-center px-2">
              <div className="w-px h-10 bg-white/10"/>
            </div>
            <div className="text-center">
              <div className="font-display font-black text-[32px] leading-none"
                style={{color:agentPts>0?'#f43f5e':'rgba(255,255,255,0.25)'}}>{agentPts}</div>
              <div className="font-mono text-[9px] text-white/25 mt-0.5 uppercase tracking-[.1em]">pts</div>
            </div>
          </div>

          {/* Price row */}
          <div className="flex items-center justify-between px-4 py-3 border-t"
            style={{borderColor:'rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.02)'}}>
            <div className="text-center">
              <div className="font-mono text-[9px] text-white/25 mb-0.5">OPEN</div>
              <div className="font-mono text-[12px] text-white font-semibold tabular-nums">
                ${startPrice.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
              </div>
            </div>
            <div className="text-center">
              <div className="font-mono font-bold text-[15px]" style={{color:pct>=0?'#10b981':'#f43f5e'}}>{deltaText}</div>
              <div className="font-mono text-[9px] text-white/20">{duration}s</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-[9px] text-white/25 mb-0.5">CLOSE</div>
              <div className="font-mono text-[12px] text-white font-semibold tabular-nums">
                ${closePrice.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
              </div>
            </div>
          </div>
        </div>

        {/* ── Action row ── */}
        <div className="px-5 pb-2 space-y-2">

          {/* Download + Mint + Share */}
          <div className="grid grid-cols-3 gap-2">

            {/* Download card */}
            <button onClick={handleDownload} disabled={downloading}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all disabled:opacity-60"
              style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span className="font-mono text-[9px] text-white/40 uppercase tracking-[.08em]">{downloading?'…':'Card'}</span>
            </button>

            {/* Mint NFT */}
            {account
              ?<button
                  onClick={mintState==='idle'||mintState==='error'?mint:undefined}
                  disabled={mintState==='checking'||mintState==='minting'||mintState==='done'||alreadyMinted}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all disabled:opacity-60"
                  style={{
                    background:mintState==='done'||alreadyMinted?'rgba(16,185,129,0.12)':'rgba(108,43,242,0.18)',
                    border:`1px solid ${mintState==='done'||alreadyMinted?'rgba(16,185,129,0.35)':'rgba(108,43,242,0.35)'}`,
                  }}>
                  {mintState==='minting'
                    ?<div className="w-4 h-4 rounded-full border-2 border-[#9A6BFF] border-t-transparent animate-spin"/>
                    :<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={mintState==='done'||alreadyMinted?'#10b981':'#9A6BFF'} strokeWidth="2" strokeLinecap="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                      </svg>
                  }
                  <span className="font-mono text-[9px] uppercase tracking-[.08em]"
                    style={{color:mintState==='done'||alreadyMinted?'#10b981':'#9A6BFF'}}>
                    {mintState==='done'||alreadyMinted?'Minted':'Mint'}
                  </span>
                </button>
              :<div className="flex flex-col items-center gap-1 py-2.5 rounded-xl opacity-30"
                  style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  <span className="font-mono text-[9px] text-white/40 uppercase tracking-[.08em]">Mint</span>
                </div>
            }

            {/* Share to X */}
            <a href={tweetUrl} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-opacity hover:opacity-80"
              style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}>
              <svg width="15" height="15" viewBox="0 0 1200 1227" fill="white" opacity="0.6">
                <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"/>
              </svg>
              <span className="font-mono text-[9px] text-white/40 uppercase tracking-[.08em]">Share</span>
            </a>
          </div>

          {mintError&&<p className="font-mono text-[10px] text-[#f43f5e] text-center">{mintError}</p>}
          {(mintState==='done'||alreadyMinted)&&mintedTokenId!==null&&(
            <a href={`${EXPLORER}/token/${CONTRACTS.BattleResultNFT}?a=${account?.address}`}
              target="_blank" rel="noopener noreferrer"
              className="block text-center font-mono text-[10px] text-[#9A6BFF]/60 hover:text-[#9A6BFF] transition-colors">
              View NFT on Mantle Explorer ↗
            </a>
          )}

          {/* Play again */}
          <button onClick={onPlayAgain}
            className="w-full py-3.5 rounded-xl font-mono font-bold text-[13px] uppercase tracking-[.08em] text-white transition-all active:scale-[.97] hover:brightness-110"
            style={{background:ctaBg,boxShadow:`0 0 28px ${glowColor}`}}>
            {ctaLabel}
          </button>

          {txHash&&(
            <a href={`https://sepolia.mantlescan.xyz/tx/${txHash}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 font-mono text-[10px] text-white/18 hover:text-white/45 uppercase tracking-[.08em] pb-1 transition-colors">
              ▦ View on Mantle ↗
            </a>
          )}
        </div>

      </div>

      <style>{`
        @keyframes rPulseG{0%,100%{text-shadow:0 0 40px #10b981,0 0 80px rgba(16,185,129,.25)}50%{text-shadow:0 0 60px #10b981,0 0 120px rgba(16,185,129,.5)}}
        @keyframes rPulseY{0%,100%{text-shadow:0 0 40px #fbbf24,0 0 80px rgba(251,191,36,.2)}50%{text-shadow:0 0 60px #fbbf24,0 0 120px rgba(251,191,36,.4)}}
        @keyframes rShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-7px) rotate(-2deg)}30%{transform:translateX(6px) rotate(2deg)}45%{transform:translateX(-5px) rotate(-1deg)}60%{transform:translateX(4px) rotate(1deg)}75%{transform:translateX(-2px)}}
      `}</style>
    </div>
  )
}

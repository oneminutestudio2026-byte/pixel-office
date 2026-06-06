import { useRef, useEffect, useState } from 'react'
import { AGENTS } from '../data/agents'
import Character from './Character'

// ── Depth helpers ─────────────────────────────────────────────────
// Room: back wall bottom at y≈295, front at y≈460 in 900×580 space
const DEPTH_BACK = 295
const DEPTH_FRONT = 462

function depthScale(sceneY) {
  const t = Math.max(0, Math.min(1, (sceneY - DEPTH_BACK) / (DEPTH_FRONT - DEPTH_BACK)))
  return 0.48 + t * 0.40   // 0.48 at back → 0.88 at front
}

// ── Responsive character overlay ─────────────────────────────────
function CharacterOverlay({ agents, agentStates, selectedAgent, onCharacterClick }) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState({ s: 1, ox: 0, oy: 0 })

  useEffect(() => {
    const VW = 900, VH = 580
    function measure() {
      if (!containerRef.current) return
      const { width, height } = containerRef.current.getBoundingClientRect()
      const s = Math.min(width / VW, height / VH)
      setScale({ s, ox: (width - VW * s) / 2, oy: (height - VH * s) / 2 })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0"
      style={{ pointerEvents: 'none', transformStyle: 'preserve-3d' }}>
      {agents.map(agent => {
        const ds = depthScale(agent.sceneY)
        const effective = scale.s * ds
        const sx = agent.sceneX * scale.s + scale.ox
        const sy = agent.sceneY * scale.s + scale.oy
        const state = agentStates[agent.id] || 'idle'
        const taskText = state !== 'idle' ? (agent.tasks?.[state] ?? null) : null
        // CSS 3D depth: ตัวละครหน้าโผล่ออกมาจากจอ, หลังอยู่ลึกลงไป
        const zFactor = Math.max(0, Math.min(1, (agent.sceneY - DEPTH_BACK) / (DEPTH_FRONT - DEPTH_BACK)))
        const zDepth  = zFactor * 45  // 0px (back) → 45px (front)

        return (
          <div
            key={agent.id}
            style={{
              position: 'absolute',
              left: sx - 42 * effective,
              top: sy - 108 * effective,
              transform: `translateZ(${zDepth}px) scale(${effective})`,
              transformOrigin: 'top left',
              transformStyle: 'preserve-3d',
              pointerEvents: 'all',
              zIndex: Math.round(agent.sceneY),
            }}
          >
            <Character
              agent={agent}
              state={state}
              isSelected={selectedAgent === agent.id}
              onClick={() => onCharacterClick(agent.id)}
              taskText={taskText}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Desk unit (perspective-scaled) ───────────────────────────────
function Desk({ cx, cy, monitorColor = '#1E40AF', elevated = false }) {
  const depth = Math.max(0, Math.min(1, (cy - DEPTH_BACK) / (DEPTH_FRONT - DEPTH_BACK)))
  const w  = 80  + depth * 95    // 80–175 px wide
  const th = 9   + depth * 12    // desk surface thickness
  const bh = 20  + depth * 30    // desk body height
  const mw = 48  + depth * 52    // monitor width
  const mh = 32  + depth * 38    // monitor height
  const ky = 3   + depth * 5     // keyboard height

  const surfY = cy   // desk surface top-face is at cy

  return (
    <g>
      {/* Elevated boss platform */}
      {elevated && (
        <>
          <rect x={cx-w/2-14} y={surfY+bh+th} width={w+28} height={12+depth*8} rx={3} fill="#6B3B1E" opacity={0.9}/>
          <rect x={cx-w/2-14} y={surfY+bh+th} width={w+28} height={4} rx={2} fill="#C68B55" opacity={0.6}/>
        </>
      )}

      {/* Chair seat (behind desk, drawn first) */}
      <ellipse cx={cx} cy={surfY+bh+th+8+depth*10} rx={w*0.28} ry={5+depth*7} fill="#1A0905" opacity={0.65}/>
      <rect x={cx-w*0.22} y={surfY+bh+th-2} width={w*0.44} height={10+depth*14} rx={2} fill="#2D1508" opacity={0.8}/>

      {/* Desk body */}
      <rect x={cx-w/2+5} y={surfY+th} width={w-10} height={bh} rx={3} fill="#4E2910"/>

      {/* Desk surface top face */}
      <rect x={cx-w/2} y={surfY} width={w} height={th} rx={2} fill="#8B5E3C"/>
      {/* Front-edge highlight (warm wood) */}
      <rect x={cx-w/2} y={surfY+th-3} width={w} height={3} rx={1} fill="#C68B55"/>

      {/* Desk surface details — papers / items */}
      <rect x={cx-w/2+8} y={surfY+1} width={w*0.28} height={th-2} rx={1} fill="white" opacity={0.12}/>
      <rect x={cx+w/2-8-w*0.18} y={surfY+1} width={w*0.18} height={th-2} rx={1} fill="#F59E0B" opacity={0.2}/>

      {/* Keyboard */}
      <rect x={cx-mw*0.38} y={surfY-ky} width={mw*0.76} height={ky+1} rx={1} fill="#1E293B" opacity={0.8}/>

      {/* Monitor stand */}
      <rect x={cx-3} y={surfY-ky-7} width={6} height={7} fill="#1E293B"/>
      <rect x={cx-12} y={surfY-ky-9} width={24} height={3} rx={1} fill="#0F172A"/>

      {/* Monitor bezel */}
      <rect x={cx-mw/2-3} y={surfY-ky-9-mh-1} width={mw+6} height={mh+3} rx={4} fill="#0C0E14"/>

      {/* Monitor screen */}
      <rect x={cx-mw/2} y={surfY-ky-8-mh} width={mw} height={mh} rx={2} fill={monitorColor} opacity={0.92}/>

      {/* Screen glow */}
      <rect x={cx-mw/2} y={surfY-ky-8-mh} width={mw} height={mh} rx={2} fill="white" opacity={0.06}/>

      {/* Screen content lines */}
      {[0.15, 0.32, 0.50, 0.66].map((t, i) => (
        <rect key={i}
          x={cx - mw/2 + 5}
          y={surfY - ky - 8 - mh + mh * t}
          width={mw * [0.65, 0.45, 0.70, 0.38][i]}
          height={2} rx={1} fill="white" opacity={0.28}
        />
      ))}

      {/* Monitor bottom camera dot */}
      <circle cx={cx} cy={surfY-ky-9-mh-3} r={1.5} fill="#374151"/>
    </g>
  )
}

// ── Window with sunset/city view ─────────────────────────────────
function SunsetWindow({ x, y, w, h }) {
  const id = `win-${x}`
  return (
    <g>
      {/* Window recess/depth */}
      <rect x={x-3} y={y-3} width={w+6} height={h+6} rx={5} fill="#120600"/>

      {/* Sky gradient */}
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0A0A1A"/>
          <stop offset="30%"  stopColor="#1A0535"/>
          <stop offset="60%"  stopColor="#7B1D1D"/>
          <stop offset="85%"  stopColor="#C2410C"/>
          <stop offset="100%" stopColor="#F97316"/>
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={`url(#${id}-sky)`}/>

      {/* City silhouette */}
      {[
        [0, h*0.62, w*0.12, h*0.38],
        [w*0.10, h*0.55, w*0.08, h*0.45],
        [w*0.17, h*0.60, w*0.10, h*0.40],
        [w*0.26, h*0.50, w*0.09, h*0.50],
        [w*0.34, h*0.58, w*0.12, h*0.42],
        [w*0.45, h*0.48, w*0.08, h*0.52],
        [w*0.52, h*0.56, w*0.14, h*0.44],
        [w*0.65, h*0.52, w*0.09, h*0.48],
        [w*0.73, h*0.60, w*0.11, h*0.40],
        [w*0.83, h*0.54, w*0.17, h*0.46],
      ].map(([bx, by, bw, bh2], i) => (
        <rect key={i} x={x+bx} y={y+by} width={bw} height={bh2} fill="#0D0608"/>
      ))}

      {/* Building lights */}
      {[[0.04,0.58],[0.22,0.52],[0.48,0.44],[0.68,0.50],[0.87,0.50]].map(([fx,fy],i) => (
        <rect key={i} x={x+w*fx} y={y+h*fy} width={3} height={3} rx={0.5} fill="#FDE68A" opacity={0.9}>
          <animate attributeName="opacity" values="0.9;0.4;0.9" dur={`${1.8+i*0.4}s`} repeatCount="indefinite"/>
        </rect>
      ))}

      {/* Moon */}
      <circle cx={x+w*0.78} cy={y+h*0.18} r={6} fill="#FEF3C7" opacity={0.85}/>
      <circle cx={x+w*0.78+4} cy={y+h*0.18-2} r={5} fill="#2D0A00" opacity={0.6}/>

      {/* Horizon glow */}
      <rect x={x} y={y+h*0.78} width={w} height={h*0.22} rx={3}
        fill="url(#horizon-glow)" opacity={0.6}/>

      {/* Window frame */}
      <rect x={x} y={y} width={w} height={h} rx={3} fill="none"
        stroke="#5C3010" strokeWidth="3"/>
      {/* Center divider */}
      <line x1={x+w/2} y1={y} x2={x+w/2} y2={y+h} stroke="#5C3010" strokeWidth="2"/>
      <line x1={x} y1={y+h*0.45} x2={x+w} y2={y+h*0.45} stroke="#5C3010" strokeWidth="2"/>

      {/* Glass reflection */}
      <rect x={x+4} y={y+4} width={w*0.18} height={h*0.35} rx={2} fill="white" opacity={0.04}/>
    </g>
  )
}

// ── Wall bookshelf ────────────────────────────────────────────────
function WallBookshelf({ x, y, w, h }) {
  const books = ['#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#84CC16','#F43F5E','#06B6D4']
  const shelves = 3
  const shelfH = h / shelves
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill="#2D1406"/>
      {Array.from({length: shelves}, (_, si) => {
        const sy = y + si * shelfH
        const booksOnShelf = Math.floor(w / 14)
        return (
          <g key={si}>
            {Array.from({length: booksOnShelf}, (_, bi) => (
              <rect key={bi}
                x={x+3+bi*14} y={sy+4}
                width={11} height={shelfH-8}
                rx={1} fill={books[(si*4+bi) % books.length]} opacity={0.88}/>
            ))}
            <rect x={x} y={sy+shelfH-4} width={w} height={4} rx={1} fill="#1A0804"/>
          </g>
        )
      })}
      <rect x={x} y={y} width={w} height={3} rx={1} fill="#5C2D0A"/>
    </g>
  )
}

// ── Forest portal (circular opening in tree trunk) ────────────────
function ForestPortal({ cx, cy, rx, ry, id }) {
  return (
    <g>
      <defs>
        <radialGradient id={`forest-${id}`} cx="45%" cy="55%" r="65%">
          <stop offset="0%"   stopColor="#2D6B1A"/>
          <stop offset="35%"  stopColor="#1A4A10"/>
          <stop offset="70%"  stopColor="#0D2E08"/>
          <stop offset="100%" stopColor="#051505"/>
        </radialGradient>
        <clipPath id={`pclip-${id}`}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry}/>
        </clipPath>
      </defs>
      {/* Forest bg */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#forest-${id})`}/>
      <g clipPath={`url(#pclip-${id})`}>
        {/* Tree silhouettes */}
        {[[-40,0,10],[-18,-12,9],[10,-5,10],[33,-18,8]].map(([dx,dy,tw],i)=>(
          <rect key={i} x={cx+dx} y={cy+dy} width={tw} height={ry-dy+4} fill="#07160A" opacity={0.85}/>
        ))}
        {/* Foliage */}
        {[[-42,-28,25,20],[-15,-42,22,18],[12,-24,24,19],[35,-38,20,17]].map(([dx,dy,erx,ery],i)=>(
          <ellipse key={i} cx={cx+dx} cy={cy+dy} rx={erx} ry={ery} fill={['#1B5C1B','#236B23','#1B5C1B','#1F641F'][i]} opacity={0.95}/>
        ))}
        {/* Light ray */}
        <polygon points={`${cx-8},${cy-ry} ${cx+8},${cy-ry} ${cx+25},${cy+10} ${cx-25},${cy+10}`}
          fill="#7FBF7F" opacity={0.08}/>
        {/* Ambient glow */}
        <ellipse cx={cx} cy={cy-ry*0.2} rx={rx*0.55} ry={ry*0.35} fill="#3DA03D" opacity={0.12}/>
      </g>
      {/* Frame */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#150803" strokeWidth={7} opacity={0.9}/>
      <ellipse cx={cx} cy={cy} rx={rx-4} ry={ry-4} fill="none" stroke="#2D6B1A" strokeWidth={1.5} opacity={0.35}/>
    </g>
  )
}

// ── Tree trunk (left or right side) ───────────────────────────────
function TreeTrunk({ side }) {
  const isLeft = side === 'left'
  const base = '#271004'
  const mid  = '#3D1A07'
  const hi   = '#5C2D10'
  const moss = '#1A4010'

  if (isLeft) return (
    <g>
      {/* Main trunk body */}
      <path d="M0,0 C30,0 80,18 108,65 C136,115 95,195 115,268
               C138,348 88,435 108,510 C122,562 55,580 0,580 Z"
        fill={base}/>
      {/* Highlight ridge */}
      <path d="M108,65 C118,100 108,165 112,225 C116,285 108,355 112,420 C116,475 105,530 100,570"
        fill="none" stroke={hi} strokeWidth={7} opacity={0.4}/>
      {/* Texture grooves */}
      {[70,145,225,315,405].map((y,i)=>(
        <path key={i}
          d={`M${18+i*4},${y} C${40+i*3},${y+12} ${62+i*2},${y+6} ${75+i*3},${y-4}`}
          fill="none" stroke={mid} strokeWidth={3} opacity={0.55}/>
      ))}
      {/* Ropes from ceiling */}
      <path d="M55,0 Q50,85 66,162 Q61,235 72,295" fill="none" stroke="#6B4A10" strokeWidth={4} opacity={0.65}/>
      <path d="M28,0 Q24,62 40,128" fill="none" stroke="#6B4A10" strokeWidth={3} opacity={0.45}/>
      <path d="M80,0 Q78,40 88,90 Q82,145 94,190" fill="none" stroke="#6B4A10" strokeWidth={2.5} opacity={0.35}/>
      {/* Moss patches */}
      {[[5,185,22,14],[0,330,18,12],[42,445,20,13],[0,490,16,10]].map(([x,y,w,h],i)=>(
        <ellipse key={i} cx={x+w/2} cy={y+h/2} rx={w} ry={h} fill={moss} opacity={0.55}/>
      ))}
      {/* Knot detail */}
      <ellipse cx={62} cy={380} rx={16} ry={12} fill={mid} opacity={0.7}/>
      <ellipse cx={62} cy={380} rx={10} ry={7}  fill={base} opacity={0.8}/>
    </g>
  )

  return (
    <g>
      <path d="M900,0 C870,0 820,18 792,65 C764,115 805,195 785,268
               C762,348 812,435 792,510 C778,562 845,580 900,580 Z"
        fill={base}/>
      <path d="M792,65 C782,100 792,165 788,225 C784,285 792,355 788,420 C784,475 795,530 800,570"
        fill="none" stroke={hi} strokeWidth={7} opacity={0.4}/>
      {[70,145,225,315,405].map((y,i)=>(
        <path key={i}
          d={`M${882-i*4},${y} C${860-i*3},${y+12} ${838-i*2},${y+6} ${825-i*3},${y-4}`}
          fill="none" stroke={mid} strokeWidth={3} opacity={0.55}/>
      ))}
      <path d="M845,0 Q850,85 834,162 Q839,235 828,295" fill="none" stroke="#6B4A10" strokeWidth={4} opacity={0.65}/>
      <path d="M872,0 Q876,62 860,128" fill="none" stroke="#6B4A10" strokeWidth={3} opacity={0.45}/>
      <path d="M820,0 Q822,40 812,90 Q818,145 806,190" fill="none" stroke="#6B4A10" strokeWidth={2.5} opacity={0.35}/>
      {[[878,185,22,14],[882,330,18,12],[858,445,20,13],[884,490,16,10]].map(([x,y,w,h],i)=>(
        <ellipse key={i} cx={x+w/2} cy={y+h/2} rx={w} ry={h} fill={moss} opacity={0.55}/>
      ))}
      <ellipse cx={838} cy={380} rx={16} ry={12} fill={mid} opacity={0.7}/>
      <ellipse cx={838} cy={380} rx={10} ry={7}  fill={base} opacity={0.8}/>
    </g>
  )
}

// ── Wall sconce light ─────────────────────────────────────────────
function WallSconce({ x, y }) {
  return (
    <g>
      {/* Glow halo */}
      <ellipse cx={x} cy={y+8} rx={28} ry={22} fill="#FF8C00" opacity={0.18}>
        <animate attributeName="opacity" values="0.18;0.08;0.18" dur="2.5s" repeatCount="indefinite"/>
      </ellipse>
      {/* Bracket */}
      <rect x={x-3} y={y-10} width={6} height={12} rx={1} fill="#8B5E3C"/>
      {/* Shade */}
      <polygon points={`${x-12},${y+2} ${x+12},${y+2} ${x+8},${y+18} ${x-8},${y+18}`} fill="#C68B55"/>
      <polygon points={`${x-12},${y+2} ${x+12},${y+2} ${x+8},${y+18} ${x-8},${y+18}`} fill="#FDE68A" opacity={0.3}/>
      {/* Bulb glow */}
      <circle cx={x} cy={y+8} r={5} fill="#FDE68A" opacity={0.9}>
        <animate attributeName="opacity" values="0.9;0.6;0.9" dur="2.5s" repeatCount="indefinite"/>
      </circle>
    </g>
  )
}

// ── Central wall TV ───────────────────────────────────────────────
function WallTV({ cx, y, w, h }) {
  return (
    <g>
      {/* TV glow */}
      <rect x={cx-w/2-10} y={y-8} width={w+20} height={h+16} rx={6} fill="#38BDF8" opacity={0.08}/>
      {/* Bezel */}
      <rect x={cx-w/2-4} y={y-4} width={w+8} height={h+8} rx={5} fill="#050E1A"/>
      {/* Screen */}
      <rect x={cx-w/2} y={y} width={w} height={h} rx={3} fill="#0C1E38"/>
      {/* Dashboard content */}
      <rect x={cx-w/2+8} y={y+8} width={w-16} height={8} rx={2} fill="#38BDF8" opacity={0.6}/>
      {/* Bar charts */}
      {[0,1,2,3,4,5].map(i => (
        <rect key={i}
          x={cx-w/2+10+i*((w-20)/6)} y={y+24}
          width={(w-20)/7} height={[18,28,22,35,15,30][i]}
          rx={1} fill={['#38BDF8','#818CF8','#34D399','#FB923C','#F472B6','#A78BFA'][i]}
          opacity={0.8}
        />
      ))}
      {/* Line graph */}
      <polyline
        points={`${cx-w/2+10},${y+62} ${cx-w/2+30},${y+52} ${cx-w/2+55},${y+58} ${cx-w/2+80},${y+44} ${cx-w/2+100},${y+50} ${cx-w/2+120},${y+38}`}
        stroke="#34D399" strokeWidth="2" fill="none" opacity={0.9}/>
      {/* Status text lines */}
      <rect x={cx-w/2+10} y={y+72} width={60} height={3} rx={1} fill="#64748B" opacity={0.6}/>
      <rect x={cx-w/2+10} y={y+78} width={44} height={3} rx={1} fill="#64748B" opacity={0.4}/>
      {/* Screen reflection */}
      <rect x={cx-w/2+4} y={y+4} width={w*0.15} height={h*0.45} rx={2} fill="white" opacity={0.03}/>
      {/* Mount */}
      <rect x={cx-6} y={y+h+4} width={12} height={8} rx={2} fill="#1E293B"/>
    </g>
  )
}

// ── Main scene ────────────────────────────────────────────────────
export default function OfficeScene({ agentStates, selectedAgent, onCharacterClick, activeFlow = [] }) {
  // Room geometry (perspective projection, 900×580 viewBox)
  //   Back wall:   (95,90)→(805,290)
  //   Ceiling:     (0,58)→(900,58)→(805,90)→(95,90)
  //   Left wall:   (0,58)→(95,90)→(95,290)→(0,580)
  //   Right wall:  (900,58)→(805,90)→(805,290)→(900,580)
  //   Floor:       (95,290)→(805,290)→(900,580)→(0,580)

  const backWall = { x: 95, y: 90, w: 710, h: 200 }

  // Floor perspective lines
  const floorLines = Array.from({ length: 11 }, (_, i) => {
    const xFront = i * 90
    const xBack  = 95 + (xFront / 900) * 710
    return { xFront, xBack }
  })
  const floorHLines = [0.08, 0.18, 0.31, 0.46, 0.62, 0.78, 0.91].map(d => {
    const y = 290 + d * 290
    return { y, xL: 95 * (1-d), xR: 805 + 95*d }
  })

  return (
    <div className="relative w-full h-full overflow-hidden"
      style={{ background: '#1A0A02', perspective: '1100px', perspectiveOrigin: '50% 10%' }}>
      {/* preserve-3d wrapper so translateZ on characters works */}
      <div style={{ width:'100%', height:'100%', position:'relative', transformStyle:'preserve-3d' }}>
      <svg
        viewBox="0 0 900 580"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
        style={{ maxHeight: '100%' }}
      >
        <defs>
          <linearGradient id="ceiling-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2A1A0A"/>
            <stop offset="100%" stopColor="#3A2212"/>
          </linearGradient>
          <linearGradient id="backwall-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1A0C04"/>
            <stop offset="100%" stopColor="#251408"/>
          </linearGradient>
          <linearGradient id="sidewall-l" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%"   stopColor="#1E1006"/>
            <stop offset="100%" stopColor="#0D0602"/>
          </linearGradient>
          <linearGradient id="sidewall-r" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#1E1006"/>
            <stop offset="100%" stopColor="#0D0602"/>
          </linearGradient>
          <linearGradient id="floor-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1E0E05"/>
            <stop offset="100%" stopColor="#2D1A0A"/>
          </linearGradient>
          <radialGradient id="ambient-center" cx="50%" cy="52%" r="52%">
            <stop offset="0%"   stopColor="#FF7A00" stopOpacity="0.22"/>
            <stop offset="55%"  stopColor="#CC4400" stopOpacity="0.07"/>
            <stop offset="100%" stopColor="#880000" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="sconce-l-glow" cx="18%" cy="30%" r="22%">
            <stop offset="0%"   stopColor="#FFBB30" stopOpacity="0.28"/>
            <stop offset="100%" stopColor="#FFBB30" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="sconce-r-glow" cx="82%" cy="30%" r="22%">
            <stop offset="0%"   stopColor="#FFBB30" stopOpacity="0.28"/>
            <stop offset="100%" stopColor="#FFBB30" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="tv-glow" cx="50%" cy="28%" r="20%">
            <stop offset="0%"   stopColor="#38BDF8" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
            <stop offset="40%"  stopColor="#000000" stopOpacity="0"/>
            <stop offset="100%" stopColor="#090300" stopOpacity="0.78"/>
          </radialGradient>
          <linearGradient id="horizon-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#F97316" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#F97316" stopOpacity="0"/>
          </linearGradient>
          <filter id="bloom" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── Ceiling ── */}
        <polygon points="0,58 900,58 805,90 95,90" fill="url(#ceiling-grad)"/>
        {/* Ceiling beams */}
        {[200, 350, 550, 700].map(bx => (
          <polygon key={bx}
            points={`${bx},58 ${bx+14},58 ${95+((bx+7)/900)*710+6},90 ${95+((bx+7)/900)*710-6},90`}
            fill="#1A0905" opacity={0.6}/>
        ))}
        {/* Pendant lights */}
        {[220, 450, 680].map((lx, i) => {
          const bx = 95 + (lx/900)*710
          return (
            <g key={i} filter="url(#bloom)">
              <line x1={lx} y1={58} x2={bx} y2={88} stroke="#5C3010" strokeWidth={1.5}/>
              <ellipse cx={bx} cy={92} rx={14} ry={6} fill="#FDE68A" opacity={0.9}>
                <animate attributeName="opacity" values="0.9;0.55;0.9" dur={`${2.2+i*0.5}s`} repeatCount="indefinite"/>
              </ellipse>
              <ellipse cx={bx} cy={100} rx={22} ry={14} fill="#FF8C00" opacity={0.2}>
                <animate attributeName="opacity" values="0.2;0.08;0.2" dur={`${2.2+i*0.5}s`} repeatCount="indefinite"/>
              </ellipse>
            </g>
          )
        })}

        {/* ── Left wall ── */}
        <polygon points="0,58 95,90 95,290 0,580" fill="url(#sidewall-l)"/>
        {/* Left wall trim */}
        <line x1={95} y1={90} x2={95} y2={290} stroke="#3A1A08" strokeWidth={2} opacity={0.8}/>

        {/* ── Right wall ── */}
        <polygon points="900,58 805,90 805,290 900,580" fill="url(#sidewall-r)"/>
        <line x1={805} y1={90} x2={805} y2={290} stroke="#3A1A08" strokeWidth={2} opacity={0.8}/>

        {/* ── Back wall ── */}
        <rect x={backWall.x} y={backWall.y} width={backWall.w} height={backWall.h} fill="url(#backwall-grad)"/>

        {/* Horizontal plank lines on back wall */}
        {[24, 48, 72, 96, 120, 148, 176].map(dy => (
          <line key={dy}
            x1={95} y1={90+dy} x2={805} y2={90+dy}
            stroke="#2A1208" strokeWidth={1.2} opacity={0.5}/>
        ))}

        {/* ── Sign: ห้องผู้บริหาร ── */}
        <rect x={310} y={94} width={280} height={34} rx={5} fill="#3A1A06"/>
        <rect x={313} y={97} width={274} height={28} rx={4} fill="#2A1204"/>
        <rect x={313} y={97} width={274} height={5} rx={2} fill="#7C4020" opacity={0.6}/>
        <text x={450} y={118} textAnchor="middle" fontSize={14} fontWeight="bold"
          fill="#F59E0B" fontFamily="'Segoe UI', system-ui, sans-serif" letterSpacing="2">
          ห้องผู้บริหาร
        </text>
        <text x={450} y={128} textAnchor="middle" fontSize={7}
          fill="#C68B40" fontFamily="'Segoe UI', system-ui, sans-serif" letterSpacing="3" opacity={0.8}>
          EXECUTIVE OFFICE
        </text>

        {/* ── Left bookshelf ── */}
        <WallBookshelf x={108} y={108} w={98} h={160}/>
        {/* ── Right bookshelf ── */}
        <WallBookshelf x={694} y={108} w={98} h={160}/>

        {/* ── Windows ── */}
        <SunsetWindow x={218} y={104} w={148} h={162}/>
        <SunsetWindow x={534} y={104} w={148} h={162}/>

        {/* ── Central wall TV ── */}
        <WallTV cx={450} y={138} w={120} h={90}/>

        {/* ── Wall sconces ── */}
        <WallSconce x={175} y={165}/>
        <WallSconce x={725} y={165}/>

        {/* Sconce glow overlays */}
        <rect x="0" y="0" width="900" height="580" fill="url(#sconce-l-glow)" pointerEvents="none"/>
        <rect x="0" y="0" width="900" height="580" fill="url(#sconce-r-glow)" pointerEvents="none"/>
        <rect x="0" y="0" width="900" height="580" fill="url(#tv-glow)"       pointerEvents="none"/>

        {/* Back wall baseboard */}
        <rect x={95} y={284} width={710} height={8} rx={1} fill="#3A1A08"/>

        {/* ── Floor ── */}
        <polygon points="95,290 805,290 900,580 0,580" fill="url(#floor-grad)"/>

        {/* Floor perspective lines (converging) */}
        {floorLines.map(({ xFront, xBack }, i) => (
          <line key={i} x1={xFront} y1={580} x2={xBack} y2={292}
            stroke="#3D2010" strokeWidth={1} opacity={0.3}/>
        ))}
        {/* Floor horizontal boards */}
        {floorHLines.map(({ y, xL, xR }, i) => (
          <line key={i} x1={xL} y1={y} x2={xR} y2={y}
            stroke="#3A1A08" strokeWidth={1.5 + i*0.15} opacity={0.4}/>
        ))}

        {/* Floor shine strip */}
        <polygon points="350,290 550,290 520,580 380,580"
          fill="white" opacity={0.018}/>

        {/* ── Rug ── */}
        <polygon
          points="240,460 660,460 720,558 180,558"
          fill="#7C2D12" opacity={0.35}/>
        <polygon
          points="258,468 642,468 698,550 202,550"
          fill="none" stroke="#C2410C" strokeWidth={1.5} opacity={0.4}/>

        {/* Corner plants */}
        {[{x:110,y:510,flip:false},{x:790,y:510,flip:true}].map((p,i) => (
          <g key={i}>
            <polygon points={`${p.x-9},${p.y} ${p.x+9},${p.y} ${p.x+6},${p.y+28} ${p.x-6},${p.y+28}`} fill="#92400E"/>
            <ellipse cx={p.x} cy={p.y-14} rx={12} ry={16} fill="#14532D"/>
            <ellipse cx={p.x+(p.flip?9:-9)} cy={p.y-8} rx={9} ry={12}
              fill="#166534" transform={`rotate(${p.flip?25:-25} ${p.x+(p.flip?9:-9)} ${p.y-8})`}/>
            <ellipse cx={p.x} cy={p.y-26} rx={8} ry={10} fill="#16A34A"/>
          </g>
        ))}

        {/* ── Desks (back-to-front) ── */}
        {/* Ace – elevated boss desk, center back */}
        <Desk cx={450} cy={302} monitorColor="#7C3AED" elevated={true}/>
        {/* Violet – back left */}
        <Desk cx={232} cy={308} monitorColor="#7C3AED"/>
        {/* Mei – back right */}
        <Desk cx={668} cy={308} monitorColor="#065F46"/>
        {/* Luna – mid left */}
        <Desk cx={150} cy={375} monitorColor="#1D4ED8"/>
        {/* Leo – mid right */}
        <Desk cx={750} cy={375} monitorColor="#7C2D12"/>
        {/* Arlo – front left */}
        <Desk cx={252} cy={452} monitorColor="#1E293B"/>
        {/* Charlie – front center */}
        <Desk cx={450} cy={460} monitorColor="#92400E"/>
        {/* Coco – front right */}
        <Desk cx={648} cy={452} monitorColor="#7F1D1D"/>

        {/* ── Active Workflow Connection Line ── */}
        {activeFlow && activeFlow.length > 1 && (
          <g filter="url(#bloom)">
            <path
              d={activeFlow.map((agentId, idx) => {
                const agent = AGENTS.find(a => a.id === agentId);
                if (!agent) return '';
                return `${idx === 0 ? 'M' : 'L'} ${agent.sceneX} ${agent.sceneY - 10}`;
              }).join(' ')}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeDasharray="6,6"
              opacity="0.85"
            >
              <animate
                attributeName="stroke-dashoffset"
                values="40;0"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </path>
            {activeFlow.map(agentId => {
              const agent = AGENTS.find(a => a.id === agentId);
              if (!agent) return null;
              return (
                <circle key={agentId} cx={agent.sceneX} cy={agent.sceneY - 10} r="4" fill="#F59E0B">
                  <animate attributeName="r" values="3;6;3" dur="1.5s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite"/>
                </circle>
              );
            })}
          </g>
        )}

        {/* ── Warm ambient center glow ── */}
        <rect x="0" y="0" width="900" height="580" fill="url(#ambient-center)" pointerEvents="none"/>

        {/* ── Edge vignette ── */}
        <rect x="0" y="0" width="900" height="580" fill="url(#vignette)" pointerEvents="none"/>

        {/* ── Tree trunks (drawn last = on top of room, below characters) ── */}
        <TreeTrunk side="left"/>
        <TreeTrunk side="right"/>

        {/* ── Forest portals inside trunks ── */}
        <ForestPortal cx={72}  cy={228} rx={60} ry={74} id="left"/>
        <ForestPortal cx={828} cy={228} rx={60} ry={74} id="right"/>

        {/* Extra ground plants near trunks */}
        {[{x:118,y:490},{x:145,y:520},{x:755,y:490},{x:780,y:515}].map((p,i)=>(
          <g key={i}>
            <polygon points={`${p.x-6},${p.y} ${p.x+6},${p.y} ${p.x+4},${p.y+20} ${p.x-4},${p.y+20}`} fill="#6B3B1E"/>
            <ellipse cx={p.x}   cy={p.y-10} rx={9}  ry={11} fill="#15532D"/>
            <ellipse cx={p.x-7} cy={p.y-5}  rx={7}  ry={9}  fill="#166534" transform={`rotate(-20 ${p.x-7} ${p.y-5})`}/>
            <ellipse cx={p.x+7} cy={p.y-5}  rx={7}  ry={9}  fill="#16A34A" transform={`rotate(20 ${p.x+7} ${p.y-5})`}/>
          </g>
        ))}
      </svg>

      {/* ── Character overlay (depth-scaled) ── */}
      <CharacterOverlay
        agents={AGENTS}
        agentStates={agentStates}
        selectedAgent={selectedAgent}
        onCharacterClick={onCharacterClick}
      />

      {/* Room sign overlay */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 text-xs font-bold tracking-widest pointer-events-none"
        style={{ color: 'rgba(253,230,138,0.35)', letterSpacing: '0.2em', fontSize: '9px' }}>
        PIXEL OFFICE HQ
      </div>

      {/* Floor label */}
      <div className="absolute bottom-2 left-4 text-xs pointer-events-none"
        style={{ color: 'rgba(180,100,50,0.35)', fontSize: '9px' }}>
        Executive Floor · 8 Agents Active
      </div>
      </div>{/* end preserve-3d wrapper */}
    </div>
  )
}

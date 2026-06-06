import { useRef, useEffect, useState } from 'react'
import { AGENTS } from '../data/agents'
import Character from './Character'

// ── Depth helpers ─────────────────────────────────────────────────
// Room: back wall bottom at y≈295, front at y≈460 in 900×580 space
const DEPTH_BACK = 295
const DEPTH_FRONT = 530

function depthScale(sceneY) {
  const t = Math.max(0, Math.min(1, (sceneY - DEPTH_BACK) / (DEPTH_FRONT - DEPTH_BACK)))
  return 0.45 + t * 0.45   // 0.45 at back → 0.90 at front
}

// ── Responsive character overlay ─────────────────────────────────
function CharacterOverlay({ agents, agentStates, selectedAgent, onCharacterClick, activeFlow = [] }) {
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
        const flowIndex = activeFlow.includes(agent.id) ? activeFlow.indexOf(agent.id) + 1 : null
        
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
              flowIndex={flowIndex}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Main scene ────────────────────────────────────────────────────
export default function OfficeScene({ agentStates, selectedAgent, onCharacterClick, activeFlow = [] }) {
  return (
    <div className="relative w-full h-full overflow-hidden"
      style={{ background: 'transparent', perspective: '1100px', perspectiveOrigin: '50% 10%' }}>
      {/* preserve-3d wrapper so translateZ on characters works */}
      <div style={{ width:'100%', height:'100%', position:'relative', transformStyle:'preserve-3d' }}>
      <svg
        viewBox="0 0 900 580"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
        style={{ maxHeight: '100%' }}
      >
        <defs>
          <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
            <stop offset="40%"  stopColor="#000000" stopOpacity="0"/>
            <stop offset="100%" stopColor="#090300" stopOpacity="0.45"/>
          </radialGradient>
          <filter id="bloom" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── Treehouse Background Image ── */}
        <image
          href="/treehouse.jpg"
          x="0"
          y="0"
          width="900"
          height="580"
          preserveAspectRatio="xMidYMid slice"
        />

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

        {/* ── Edge vignette ── */}
        <rect x="0" y="0" width="900" height="580" fill="url(#vignette)" pointerEvents="none" opacity="0.5"/>
      </svg>

      {/* ── Character overlay (depth-scaled) ── */}
      <CharacterOverlay
        agents={AGENTS}
        agentStates={agentStates}
        selectedAgent={selectedAgent}
        onCharacterClick={onCharacterClick}
        activeFlow={activeFlow}
      />

      {/* Room sign overlay */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 text-xs font-bold tracking-widest pointer-events-none"
        style={{ color: 'rgba(253,230,138,0.35)', letterSpacing: '0.2em', fontSize: '9px' }}>
        PIXEL TREEHOUSE HQ
      </div>

      {/* Floor label */}
      <div className="absolute bottom-2 left-4 text-xs pointer-events-none"
        style={{ color: 'rgba(180,100,50,0.35)', fontSize: '9px' }}>
        Executive Treehouse · 11 Agents Active
      </div>
      </div>{/* end preserve-3d wrapper */}
    </div>
  )
}

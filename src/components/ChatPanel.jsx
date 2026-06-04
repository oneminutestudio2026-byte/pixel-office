import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAgent } from '../data/agents'
import AgentAvatar from './Avatars'

// ── Status badge ──────────────────────────────────────────────────
function StatusBadge({ state }) {
  const cfg = {
    idle:     { label: 'Idle',         cls: 'bg-gray-400' },
    thinking: { label: 'Thinking…',    cls: 'bg-amber-400' },
    typing:   { label: 'Responding…',  cls: 'bg-blue-400'  },
    done:     { label: 'Done ✓',       cls: 'bg-emerald-400' },
  }
  const { label, cls } = cfg[state] || cfg.idle
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-white ${state !== 'idle' ? 'animate-pulse' : ''}`}/>
      {label}
    </span>
  )
}

// ── Orchestration flow (Ace only) ─────────────────────────────────
function TaskFlowPanel({ agent, agentStates }) {
  if (!agent.subAgents) return null
  return (
    <div className="mx-3 mb-2 p-3 rounded-xl shrink-0" style={{ background: 'rgba(0,0,0,0.06)' }}>
      <div className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: '#92400E' }}>
        <span>🔀</span> Orchestration Flow
      </div>
      <div className="flex flex-col gap-1">
        {agent.subAgents.map(subId => {
          const sub = getAgent(subId)
          if (!sub) return null
          const state = agentStates[subId] || 'idle'
          return (
            <div
              key={subId}
              className="flex items-center gap-2 px-2 py-1 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.65)' }}
            >
              {/* 28 px avatar — no CSS scaling tricks, just a sized SVG */}
              <div className="flex-shrink-0 w-7 h-7 flex items-end justify-center overflow-hidden rounded-md"
                style={{ background: `${sub.color}18` }}>
                <AgentAvatar animal={sub.animal} state={state} size={28}/>
              </div>
              <span className="flex-1 text-xs font-semibold text-gray-700 leading-none">
                {sub.name}
                <span className="block font-normal text-gray-400" style={{ fontSize: '10px' }}>{sub.role}</span>
              </span>
              <StatusBadge state={state}/>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  const isImage = msg.type === 'image' && msg.imageUrl

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}
    >
      <div
        className={`max-w-[88%] rounded-2xl text-sm leading-relaxed ${
          isUser ? 'text-white rounded-br-sm px-3.5 py-2.5 whitespace-pre-wrap' : 'text-gray-800 rounded-bl-sm overflow-hidden'
        }`}
        style={isUser
          ? { background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }
          : { background: 'white', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }
        }
      >
        {isImage ? (
          <div className="flex flex-col">
            <img
              src={msg.imageUrl}
              alt="Generated artwork"
              className="w-full rounded-t-2xl rounded-bl-none"
              style={{ maxWidth: '320px', display: 'block' }}
            />
            {msg.content && (
              <p className="px-3 py-2 text-gray-700 text-xs leading-relaxed">{msg.content}</p>
            )}
          </div>
        ) : (
          <div className="px-3.5 py-2.5 whitespace-pre-wrap">{msg.content}</div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main chat panel ───────────────────────────────────────────────
export default function ChatPanel({ agentId, agentStates, messages, onSend, onClose }) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const agent = getAgent(agentId)

  const agentMessages = messages[agentId] || []
  const currentState = agentStates[agentId] || 'idle'
  const isBusy = currentState === 'thinking' || currentState === 'typing'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, agentId])

  useEffect(() => {
    inputRef.current?.focus()
    setInput('')
  }, [agentId])

  if (!agent) return null

  function handleSend() {
    const text = input.trim()
    if (!text || isBusy) return
    setInput('')
    onSend(agentId, text)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="flex flex-col h-full w-full" style={{ background: agent.lightBg }}>

      {/* Accent line at top */}
      <div className="h-1 shrink-0" style={{ background: `linear-gradient(90deg, ${agent.color}, ${agent.accent})` }}/>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: `linear-gradient(135deg, ${agent.color}1A, ${agent.color}08)`, borderBottom: `1px solid ${agent.color}28` }}
      >
        {/* Avatar */}
        <div
          className="w-14 h-14 flex-shrink-0 flex items-end justify-center rounded-2xl overflow-hidden"
          style={{ background: `${agent.color}22` }}
        >
          <AgentAvatar animal={agent.animal} state={currentState} size={52}/>
        </div>

        {/* Name + role + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-800 text-base leading-tight">{agent.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white shrink-0"
              style={{ background: agent.color }}>
              {agent.role}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5 truncate">{agent.description}</div>
          <div className="mt-1.5"><StatusBadge state={currentState}/></div>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-black/10 transition-colors shrink-0 text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* System note (Ace only) — compact */}
      {agent.systemNote && (
        <div className="mx-3 mt-1.5 px-3 py-1.5 rounded-xl text-xs text-gray-500 shrink-0"
          style={{ background: `${agent.color}10`, border: `1px solid ${agent.color}20` }}>
          <span className="font-semibold">ℹ️ </span>{agent.systemNote}
        </div>
      )}

      {/* ── Messages (only scrollable area) ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {agentMessages.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-2">
            <MessageBubble msg={{ role: 'agent', content: agent.greeting }}/>
          </motion.div>
        )}

        {agentMessages.map((msg, i) => (
          <MessageBubble key={i} msg={msg}/>
        ))}

        {/* Typing indicator */}
        <AnimatePresence>
          {isBusy && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex justify-start mb-2"
            >
              <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-black/8 flex gap-1.5 items-center shadow-sm">
                <span className="w-2 h-2 rounded-full dot-1" style={{ background: agent.color }}/>
                <span className="w-2 h-2 rounded-full dot-2" style={{ background: agent.color }}/>
                <span className="w-2 h-2 rounded-full dot-3" style={{ background: agent.color }}/>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef}/>
      </div>

      {/* ── Quick-action chips ── */}
      <div className="px-3 pb-2 shrink-0">
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {getQuickActions(agent.id).map((action, i) => (
            <button
              key={i}
              disabled={isBusy}
              onClick={() => { setInput(action); inputRef.current?.focus() }}
              className="whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border transition-all hover:scale-105 active:scale-95 shrink-0 disabled:opacity-40"
              style={{ background: `${agent.color}12`, borderColor: `${agent.color}35`, color: agent.accent }}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input ── */}
      <div className="px-3 pb-4 shrink-0">
        <div
          className="flex items-end gap-2 p-2.5 rounded-2xl transition-all"
          style={{
            background: 'white',
            border: `1.5px solid ${isBusy ? agent.color + '80' : agent.color + '40'}`,
            boxShadow: `0 2px 16px ${agent.color}12`,
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isBusy ? `${agent.name} กำลังตอบ...` : `ส่งข้อความถึง ${agent.name}…`}
            rows={1}
            disabled={isBusy}
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none leading-relaxed py-1 px-1 disabled:opacity-50"
            style={{ maxHeight: '120px', minHeight: '36px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isBusy}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            style={{
              background: (input.trim() && !isBusy)
                ? `linear-gradient(135deg, ${agent.color}, ${agent.accent})`
                : '#CBD5E1',
            }}
          >
            {isBusy
              ? <span className="flex gap-0.5 items-center">
                  <span className="w-1 h-1 rounded-full bg-white dot-1"/>
                  <span className="w-1 h-1 rounded-full bg-white dot-2"/>
                  <span className="w-1 h-1 rounded-full bg-white dot-3"/>
                </span>
              : <span className="text-base leading-none">↑</span>}
          </button>
        </div>
        <p className="text-center mt-1.5" style={{ fontSize: '10px', color: 'rgba(120,80,40,0.45)' }}>
          {isBusy ? 'รอการตอบกลับจาก Claude API…' : 'Enter ส่ง · Shift+Enter ขึ้นบรรทัด'}
        </p>
      </div>
    </div>
  )
}

function getQuickActions(id) {
  const m = {
    ace:     ['มอบหมายงานดีไซน์', 'เริ่ม dev sprint', 'สรุปงานทีม'],
    violet:  ['ออกแบบ landing page', 'แนะนำ color palette', 'รีวิว UI'],
    mei:     ['เขียน blog post', 'เขียน caption', 'เขียนเอกสาร'],
    luna:    ['สร้าง React component', 'รีวิวโค้ด frontend', 'CSS animation'],
    leo:     ['สร้าง API endpoint', 'รีวิวโค้ด backend', 'ออกแบบ DB'],
    arlo:    ['สแกน security', 'ตรวจ infra', 'รีวิว access logs'],
    charlie: ['วิเคราะห์ performance', 'เปรียบ benchmark', 'วิเคราะห์ trading'],
    coco:    ['ประเมิน risk', 'สรุปกลยุทธ์', 'executive summary'],
  }
  return m[id] || ['ช่วยอะไรได้บ้าง?', 'ทักษะของคุณ?']
}

import { useEffect, useRef } from 'react'
import AgentAvatar from './Avatars'
import { getAgent } from '../data/agents'

export default function SwarmRoom({ messages = [], activeFlow = [], agentStates = {}, onClose, onClearSwarm }) {
  const chatEndRef = useRef(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Check if any agent is currently busy (thinking/typing)
  const isSwarmActive = activeFlow.length > 0 && Object.values(agentStates).some(s => s === 'thinking' || s === 'typing')

  function handleClearSwarmClick() {
    const ok = window.confirm('คุณต้องการล้างข้อความแชทในห้องประชุม Swarm บนหน้าจอนี้หรือไม่? (ข้อมูลถาวรในระบบ/Notion จะยังคงอยู่)')
    if (ok && onClearSwarm) {
      onClearSwarm()
    }
  }

  return (
    <div className="flex flex-col h-full w-full" style={{ background: 'transparent' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-white/5" style={{ background: 'rgba(255,255,255,0.01)' }}>
        <div>
          <h1 className="text-base font-bold text-amber-200 flex items-center gap-2">
            <span>👥</span> ห้องประชุม Swarm (Telegram Live)
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${isSwarmActive ? 'bg-emerald-500 animate-ping' : 'bg-amber-500/70'}`} />
            <span className="text-[11px] text-amber-400/60">
              {isSwarmActive ? 'ระบบ Swarm กำลังประมวลผลงาน...' : 'สแตนด์บาย (รอรับคำสั่งจาก Telegram)'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleClearSwarmClick}
            title="ล้างแชทประชุม (Clear Swarm Chat)"
            className="w-8 h-8 rounded-full flex items-center justify-center text-amber-200/60 hover:text-red-400 hover:bg-white/5 transition-colors text-sm cursor-pointer"
          >
            🗑️
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all cursor-pointer text-lg leading-none"
            title="ปิดหน้าห้องประชุม"
          >
            ×
          </button>
        </div>
      </div>

      {/* Flow visualization bar */}
      {activeFlow.length > 0 && (
        <div className="px-6 py-3.5 border-b border-white/5 shrink-0 bg-neutral-950/20">
          <div className="text-[10px] uppercase tracking-wider text-amber-300/40 mb-2 font-bold">
            โฟลว์การวิ่งงานปัจจุบัน (Active Pipeline)
          </div>
          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            {activeFlow.map((flowAgentId, idx) => {
              const isUser = flowAgentId === 'user'
              const agent = isUser ? null : getAgent(flowAgentId)
              const state = agentStates[flowAgentId] || 'idle'
              const isCurrent = state === 'thinking' || state === 'typing'
              
              const name = isUser ? 'User' : agent?.name ?? flowAgentId
              const role = isUser ? 'ผู้ส่งคำสั่ง' : agent?.role ?? 'Agent'
              const color = isUser ? '#F59E0B' : agent?.color ?? '#999'

              return (
                <div key={idx} className="flex items-center shrink-0">
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl transition-all duration-300 ${isCurrent ? 'bg-amber-500/20 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]' : 'bg-white/5 border-white/5'} border`}
                  >
                    {!isUser && agent && (
                      <div className="w-5 h-5 rounded-md overflow-hidden flex items-end justify-center bg-white/5">
                        <AgentAvatar animal={agent.animal} state={state} size={20} />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold leading-tight" style={{ color }}>
                        {name}
                      </span>
                      <span className="text-[9px] text-white/40 leading-none">
                        {role}
                      </span>
                    </div>
                  </div>
                  {idx < activeFlow.length - 1 && (
                    <span className="text-white/20 text-xs px-1.5 animate-pulse">➔</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Message Chat stream */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <span className="text-4xl animate-bounce">💬</span>
            <h3 className="text-sm font-bold text-amber-200/50">ยังไม่มีประวัติการประชุมในเซสชันนี้</h3>
            <p className="text-xs text-white/30 max-w-xs">
              พิมพ์คำสั่งลง Telegram บอท เพื่อเริ่มต้น Swarm โฟลว์การคุยงานของทีมจะปรากฏขึ้นที่นี่แบบเรียลไทม์!
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.agentId === 'user'
            const agent = isUser ? null : getAgent(msg.agentId)
            const color = isUser ? '#F59E0B' : agent?.color ?? '#10B981'
            const role = isUser ? 'ผู้ส่งคำสั่ง' : agent?.role ?? 'Agent'
            const name = isUser ? 'User' : agent?.name ?? msg.agentName

            return (
              <div
                key={index}
                className={`flex gap-3 max-w-[90%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                {!isUser && agent && (
                  <div className="w-9 h-9 rounded-xl overflow-hidden flex items-end justify-center bg-neutral-900 border border-white/10 shrink-0 mt-1">
                    <AgentAvatar animal={agent.animal} state="idle" size={34} />
                  </div>
                )}

                {/* Bubble Container */}
                <div className="flex flex-col gap-1">
                  {/* Sender Name & Role & Time */}
                  <div className={`flex items-center gap-1.5 text-[10px] ${isUser ? 'justify-end' : ''}`}>
                    <span className="font-bold" style={{ color }}>{name}</span>
                    <span className="text-white/30">({role})</span>
                    <span className="text-white/25 ml-1">{msg.timestamp}</span>
                  </div>

                  {/* Bubble content */}
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed border ${
                      isUser
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-100 rounded-tr-none'
                        : 'bg-white/5 border-white/5 text-white/90 rounded-tl-none'
                    }`}
                  >
                    {msg.type === 'image' && msg.imageUrl ? (
                      <div className="space-y-2.5">
                        <p className="whitespace-pre-line text-[13px]">{msg.content}</p>
                        <div className="rounded-xl overflow-hidden border border-white/10 bg-neutral-950/40">
                          <img
                            src={msg.imageUrl}
                            alt="Generated UI"
                            className="w-full h-auto object-contain max-h-[300px] hover:scale-102 transition-all duration-300"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-line text-[13px]">{msg.content}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={chatEndRef} />
      </div>
    </div>
  )
}

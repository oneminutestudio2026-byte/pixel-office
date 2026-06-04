import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import OfficeScene from './components/OfficeScene'
import ChatPanel from './components/ChatPanel'
import AgentAvatar from './components/Avatars'
import { AGENTS, getAgent } from './data/agents'
import { callAgent, evaluateVideoQuality } from './services/api'
import { logTask, getRecentLogs, buildUpskillContext } from './services/notion'
import { generateVideo, recordScore, getModelStats } from './services/videoService'
import { sendContentPackage } from './services/telegramService'
import { recordCost, getSummary, toBaht } from './services/costTracker'
import { getFinanceSummary } from './services/financeService'

// ── Parse captions จาก Mei's response ────────────────────────────
function parseCaptions(meiReply) {
  const get = (key) => {
    const match = meiReply.match(new RegExp(`${key}:\\s*([\\s\\S]*?)(?=\\n[A-Z]+:|$)`))
    return match?.[1]?.trim() ?? ''
  }
  return {
    script:   get('SCRIPT'),
    youtube:  get('YOUTUBE'),
    tiktok:   get('TIKTOK'),
    facebook: get('FACEBOOK'),
    twitter:  get('TWITTER'),
    hashtags: get('HASHTAGS'),
  }
}

// ── Orchestration helpers ─────────────────────────────────────────
// เลือก 2-3 agent ที่เกี่ยวข้องที่สุด (ประหยัด token)
function getOrchestratorFlow(task) {
  const kw = task.toLowerCase()
  if (kw.includes('ออกแบบ') || kw.includes('design') || kw.includes('ui') || kw.includes('หน้าตา'))
    return ['violet', 'mei', 'coco']
  if (kw.includes('เขียน') || kw.includes('content') || kw.includes('script') || kw.includes('caption'))
    return ['mei', 'violet', 'charlie']
  if (kw.includes('โค้ด') || kw.includes('code') || kw.includes('build') || kw.includes('เว็บ'))
    return ['luna', 'leo', 'charlie']
  if (kw.includes('security') || kw.includes('ความปลอดภัย') || kw.includes('ตรวจ'))
    return ['arlo', 'charlie', 'coco']
  if (kw.includes('risk') || kw.includes('ความเสี่ยง') || kw.includes('วิเคราะห์'))
    return ['coco', 'charlie', 'arlo']
  if (kw.includes('trading') || kw.includes('หุ้น') || kw.includes('ข้อมูล'))
    return ['charlie', 'coco', 'arlo']
  // default: ทีมหลัก 3 คน
  return ['violet', 'mei', 'luna']
}


// ── Empty-state placeholder for the right panel ───────────────────
function ChatPlaceholder({ onSelect }) {
  return (
    <div className="flex flex-col h-full w-full" style={{ background: '#FAF3E8' }}>
      <div className="h-1" style={{ background: 'linear-gradient(90deg, #F59E0B, #D97706)' }}/>

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-7 min-h-0 overflow-y-auto py-8">
        {/* Branding */}
        <div className="text-center">
          <div className="text-5xl mb-3">🌳</div>
          <h1 className="text-2xl font-bold text-amber-900 tracking-tight mb-1">Pixel Office</h1>
          <p className="text-sm text-amber-700/60">ห้องผู้บริหาร · AI Agent Team</p>
        </div>

        {/* Instruction */}
        <p className="text-sm text-amber-800/55 text-center max-w-xs">
          เลือกตัวละครจากออฟฟิศด้านซ้ายเพื่อเริ่มสนทนา หรือคลิกที่ตัวแทนด้านล่าง
        </p>

        {/* Agent grid */}
        <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
          {AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl cursor-pointer transition-all hover:scale-108 active:scale-95"
              style={{ background: `${agent.color}18`, border: `1px solid ${agent.color}28` }}
            >
              <div className="overflow-hidden rounded-xl flex items-end justify-center"
                style={{ width: 40, height: 40, background: `${agent.color}22` }}>
                <AgentAvatar animal={agent.animal} state="idle" size={38}/>
              </div>
              <span className="text-center font-bold leading-none" style={{ color: agent.color, fontSize: '9px' }}>
                {agent.name}
              </span>
              <span className="text-center leading-none" style={{ color: agent.color + '90', fontSize: '8px' }}>
                {agent.role}
              </span>
            </button>
          ))}
        </div>

        {/* Model info */}
        <div className="text-center space-y-1" style={{ color: 'rgba(160,90,20,0.4)', fontSize: '10px' }}>
          <p>Ace · Charlie · Coco → claude-sonnet-4-5</p>
          <p>Others → claude-haiku-3-5</p>
        </div>
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────
export default function App() {
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [costSummary, setCostSummary]   = useState(getSummary())
  const refreshCost = () => setCostSummary(getSummary())
  const [agentStates, setAgentStates] = useState(
    Object.fromEntries(AGENTS.map(a => [a.id, 'idle']))
  )
  const [messages, setMessages] = useState({})
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  // sessionId: ใช้ระบุ session ใน Notion log
  const sessionId = useRef(`S-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`).current

  const setAgentState = useCallback((id, state) => {
    setAgentStates(prev => ({ ...prev, [id]: state }))
  }, [])

  const addMessage = useCallback((agentId, role, content, type = 'text', imageUrl = null) => {
    setMessages(prev => ({
      ...prev,
      [agentId]: [...(prev[agentId] || []), { role, content, type, imageUrl }],
    }))
  }, [])

  const handleSend = useCallback(async (agentId, text) => {
    const agent = getAgent(agentId)
    if (!agent) return

    // ── Bean: ดึงข้อมูลจาก Notion Finance DB ก่อนตอบ ────────────
    let beanContext = ''
    if (agentId === 'bean') {
      const [allSummary, haanSummary] = await Promise.all([
        getFinanceSummary(),
        getFinanceSummary('ห่านการเงิน'),
      ])
      const live = getSummary()
      beanContext = `[ข้อมูลการเงินปัจจุบัน]
งบเดือนนี้: $${live.budget} (~฿${toBaht(live.budget)})
ใช้ไปแล้ว: $${live.spent} (~฿${toBaht(live.spent)}) = ${live.pctUsed}%
เหลือ: $${live.remaining} (~฿${toBaht(live.remaining)})
${Object.entries(live.byCategory).map(([k,v])=>`- ${k}: $${v.toFixed(4)}`).join('\n')}
${allSummary ? `\nNotion (ทั้งหมด ${allSummary.count} รายการ): รวม $${allSummary.totalUSD} (~฿${allSummary.totalTHB})` : ''}
${haanSummary ? `ห่านการเงินโปรเจค: $${haanSummary.totalUSD} (~฿${haanSummary.totalTHB})` : ''}`
    }

    const apiHistory = [...(messagesRef.current[agentId] || []), { role: 'user', content: text }]
    addMessage(agentId, 'user', text)
    setAgentState(agentId, 'thinking')
    try {
      await new Promise(r => setTimeout(r, 350 + Math.random() * 300))
      setAgentState(agentId, 'typing')

      // ── Upskill: ดึง log ของตัวเองมาเป็น context ──────────────
      const [ownLogs, teamLogs] = await Promise.all([
        getRecentLogs({ agentName: agent.name, limit: 3 }),
        getRecentLogs({ limit: 6 }),
      ])
      const upskillCtx = buildUpskillContext(agent.name, ownLogs, teamLogs)

      const combinedCtx = [beanContext, upskillCtx].filter(Boolean).join('\n\n')
      const reply = await callAgent(agent, apiHistory, combinedCtx)
      const replyText = typeof reply === 'string' ? reply : reply?.content ?? ''

      if (typeof reply === 'object' && reply.type === 'image') {
        addMessage(agentId, 'agent', reply.content, 'image', reply.imageUrl)
      } else {
        addMessage(agentId, 'agent', replyText)
      }

      // ── Log งานลง Notion (fire & forget) ──────────────────────
      logTask({
        agentName: agent.name,
        task: text,
        skillsUsed: agent.role,
        resultSummary: replyText,
        status: 'completed',
        sessionId,
      })

      refreshCost()
      setAgentState(agentId, 'done')
      setTimeout(() => setAgentState(agentId, 'idle'), 2200)

      // ── Sub-agents คุยกัน sequential (ประหยัด token) ──────────
      if (agentId === 'ace') {
        const subIds = getOrchestratorFlow(text)
        const aceReplyText = typeof reply === 'string' ? reply : reply?.content ?? ''

        // runChain: เรียก agent ทีละคน ส่ง context สะสมไปด้วย
        const runChain = async () => {
          // ดึง team logs ครั้งเดียวสำหรับทั้ง chain
          const teamLogs = await getRecentLogs({ limit: 8 })
          let sharedContext = `งานที่ได้รับ: "${text}"\nAce ตอบว่า: ${aceReplyText}`

          for (let idx = 0; idx < subIds.length; idx++) {
            const subId    = subIds[idx]
            const subAgent = getAgent(subId)
            if (!subAgent) continue

            await new Promise(r => setTimeout(r, 600))
            setAgentState(subId, 'thinking')

            // Upskill: log ของตัวเอง
            const ownLogs    = await getRecentLogs({ agentName: subAgent.name, limit: 3 })
            const upskillCtx = buildUpskillContext(subAgent.name, ownLogs, teamLogs)

            const taskMsg = `[Ace มอบงาน]\n${sharedContext}\n\nในฐานะ ${subAgent.role} ตอบสั้นๆ ว่าคุณจะช่วยงานนี้ยังไง (2-3 ประโยค)`
            addMessage(subId, 'user', `[จาก Ace]: ${text}`)

            try {
              await new Promise(r => setTimeout(r, 300 + Math.random() * 200))
              setAgentState(subId, 'typing')

              const subReply  = await callAgent(subAgent, [{ role: 'user', content: taskMsg }], upskillCtx)
              const replyText = typeof subReply === 'string' ? subReply : subReply?.content ?? ''

              if (typeof subReply === 'object' && subReply.type === 'image') {
                addMessage(subId, 'agent', subReply.content, 'image', subReply.imageUrl)
              } else {
                addMessage(subId, 'agent', replyText)
              }

              sharedContext += `\n${subAgent.name} (${subAgent.role}) บอกว่า: ${replyText}`

              // Log ลง Notion
              logTask({
                agentName: subAgent.name,
                task: text,
                skillsUsed: subAgent.role,
                resultSummary: replyText,
                status: 'completed',
                sessionId,
              })

              setAgentState(subId, 'done')
              setTimeout(() => setAgentState(subId, 'idle'), 2200)
            } catch (err) {
              console.error(`${subId} error:`, err)
              logTask({ agentName: subAgent.name, task: text, skillsUsed: subAgent.role,
                resultSummary: err.message ?? 'error', status: 'failed', sessionId })
              setAgentState(subId, 'idle')
            }
          }
        }

        runChain()
      }
    } catch (err) {
      console.error('API error:', err)
      const msg = err?.status === 401 ? 'API key ไม่ถูกต้อง กรุณาตรวจสอบ .env'
                : err?.status === 429 ? 'คำขอมากเกินไป กรุณารอสักครู่'
                : `เกิดข้อผิดพลาด: ${err.message ?? 'Unknown error'}`
      addMessage(agentId, 'agent', msg)
      setAgentState(agentId, 'done')
      setTimeout(() => setAgentState(agentId, 'idle'), 2000)
    }
  }, [addMessage, setAgentState])

  // ── Nova: สร้างวิดีโอ A/B + ให้ Coco ประเมิน ─────────────────────
  const handleVideoGeneration = useCallback(async (prompt, imageUrl = null) => {
    const nova = getAgent('nova')
    const coco = getAgent('coco')
    if (!nova || !coco) return

    setAgentState('nova', 'thinking')
    addMessage('nova', 'user', `[สร้างวิดีโอ]: ${prompt}`)

    try {
      setAgentState('nova', 'typing')
      const result = await generateVideo({ prompt, imageUrl, durationSec: 5 })

      const statusMsg = result.success
        ? `✅ สร้างวิดีโอด้วย **${result.modelName}** เสร็จแล้ว!\n💰 ต้นทุน: ${result.costStr}\n🎬 URL: ${result.videoUrl}`
        : `❌ ${result.modelName} ล้มเหลว: ${result.error}`

      addMessage('nova', 'agent', statusMsg)
      setAgentState('nova', 'done')

      // ── Coco ประเมินคุณภาพทันที ──────────────────────────────
      setAgentState('coco', 'thinking')
      const evaluation = await evaluateVideoQuality({
        modelName: result.modelName,
        prompt, videoUrl: result.videoUrl,
        success: result.success, error: result.error,
      })

      // บันทึกคะแนนเพื่อ A/B tracking
      recordScore(result.modelKey, evaluation.score)

      const stats = getModelStats()
      const statsStr = stats.map(s =>
        `${s.isDropped ? '🚫' : '✅'} ${s.name}: ${s.attempts} ครั้ง | success ${s.successRate} | เฉลี่ย ${s.avgScore}⭐ | รวม ${s.totalCost}`
      ).join('\n')

      addMessage('coco', 'agent',
        `📊 ประเมินโดย Coco:\n${evaluation.text}\n\n📈 สถิติ A/B ล่าสุด:\n${statsStr}`
      )
      setAgentState('coco', 'done')

      // Log ลง Notion
      logTask({
        agentName: 'Nova',
        task: prompt,
        skillsUsed: `${result.modelName}, video-generation`,
        resultSummary: `${result.success ? 'SUCCESS' : 'FAILED'} | cost:${result.costStr} | Coco score:${evaluation.score}/5`,
        status: result.success ? 'completed' : 'failed',
        sessionId,
      })

      // บันทึก video cost
      if (result.success) {
        recordCost({
          category:    `fal-video-${result.modelKey}`,
          agentName:   'Nova',
          description: `${result.modelName} ${result.durationSec}s`,
          usd:         result.cost,
        })
        refreshCost()
      }

      // ── ส่ง Content Package ไป Telegram ──────────────────────
      if (result.success) {
        // ดึง captions จาก messages ของ Mei (ถ้ามี)
        const meiMsgs  = messagesRef.current['mei'] ?? []
        const lastMei  = [...meiMsgs].reverse().find(m => m.role === 'agent')
        const captions = lastMei ? parseCaptions(lastMei.content) : {}

        const stats     = getModelStats()
        const totalCost = stats.reduce((sum, s) => sum + parseFloat(s.totalCost.replace('$','')), 0)

        sendContentPackage({
          topic:        prompt,
          videoUrl:     result.videoUrl,
          thumbnailUrl: (messagesRef.current['violet'] ?? [])
                          .reverse().find(m => m.type === 'image')?.imageUrl ?? null,
          audioUrl:     null, // Sonic จะเพิ่มทีหลัง
          captions,
          hashtags:     captions.hashtags,
          cocoScore:    evaluation.score,
          totalCost:    totalCost.toFixed(2),
          sessionId,
        })

        addMessage('nova', 'agent', '📤 ส่ง Content Package ไป Telegram แล้วค่ะ!')
      }

      setTimeout(() => { setAgentState('nova', 'idle'); setAgentState('coco', 'idle') }, 3000)

    } catch (err) {
      addMessage('nova', 'agent', `เกิดข้อผิดพลาด: ${err.message}`)
      setAgentState('nova', 'idle')
    }
  }, [addMessage, setAgentState, sessionId])

  const handleCharacterClick = useCallback((agentId) => {
    setSelectedAgent(prev => prev === agentId ? null : agentId)
  }, [])

  const handleClose = useCallback(() => setSelectedAgent(null), [])

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden" style={{ background: '#2C1810' }}>

      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0 gap-3"
        style={{
          background: 'linear-gradient(90deg, #1A0C05 0%, #2C1810 50%, #3A1E08 100%)',
          borderBottom: '1px solid rgba(210,140,50,0.2)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-lg">🌳</span>
          <div className="hidden sm:block">
            <div className="font-bold text-amber-200 text-sm leading-tight">Pixel Office</div>
            <div className="text-amber-400/50 text-xs leading-tight">ห้องผู้บริหาร</div>
          </div>
        </div>

        {/* Agent pills */}
        <div className="flex gap-1 flex-wrap justify-center flex-1 min-w-0">
          {AGENTS.map(agent => {
            const busy = agentStates[agent.id] !== 'idle'
            const active = selectedAgent === agent.id
            return (
              <button
                key={agent.id}
                onClick={() => handleCharacterClick(agent.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95"
                style={{
                  background: active ? agent.color : `${agent.color}22`,
                  color:      active ? 'white' : agent.color,
                  border:     `1px solid ${agent.color}45`,
                }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${busy ? 'animate-pulse' : ''}`}
                  style={{ background: busy ? '#10B981' : (active ? 'white' : agent.color) }}
                />
                <span className="hidden sm:inline">{agent.name}</span>
                <span className="sm:hidden">{agent.name.charAt(0)}</span>
              </button>
            )
          })}
        </div>

        {/* Budget Bar */}
        <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0 min-w-[120px]">
          <div className="flex items-center gap-1.5" style={{ fontSize: '10px' }}>
            <span style={{ color: costSummary.budgetOK ? '#10B981' : '#EF4444' }}>
              💰 ${costSummary.spent.toFixed(3)}
            </span>
            <span style={{ color: 'rgba(210,140,50,0.4)' }}>
              / ${costSummary.budget} (~฿{toBaht(costSummary.budget)})
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${costSummary.pctUsed}%`,
                background: costSummary.pctUsed > 90 ? '#EF4444'
                  : costSummary.pctUsed > 70 ? '#F59E0B' : '#10B981',
              }}
            />
          </div>
          <span style={{ fontSize: '9px', color: 'rgba(210,140,50,0.35)' }}>
            เหลือ ${costSummary.remaining.toFixed(2)} · {costSummary.pctUsed}% used
          </span>
        </div>
      </div>

      {/* ── Body: 40/60 layout ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Left: Office scene — ขยายเต็มเมื่อไม่มี chat */}
        <div className="flex flex-col h-full overflow-hidden transition-all duration-300"
          style={{ width: selectedAgent ? '40%' : '100%', minWidth: 0, flexShrink: 0 }}>

          {/* Office scene — takes remaining height */}
          <div className="relative flex-1 overflow-hidden min-h-0">
            <OfficeScene
              agentStates={agentStates}
              selectedAgent={selectedAgent}
              onCharacterClick={handleCharacterClick}
            />
            <AnimatePresence>
              {!selectedAgent && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-medium pointer-events-none whitespace-nowrap"
                  style={{
                    background: 'rgba(16,6,1,0.6)',
                    backdropFilter: 'blur(8px)',
                    color: 'rgba(253,230,138,0.75)',
                    border: '1px solid rgba(210,140,50,0.18)',
                  }}
                >
                  คลิกตัวละครเพื่อแชท ↑
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Agent status bar — fixed at bottom of left panel */}
          <div
            className="shrink-0 px-2 py-2 overflow-y-auto"
            style={{
              background: 'rgba(10,4,1,0.85)',
              borderTop: '1px solid rgba(210,140,50,0.18)',
              maxHeight: '38%',
            }}
          >
            <div className="text-xs font-bold mb-1.5 flex items-center gap-1.5 px-1"
              style={{ color: 'rgba(210,140,50,0.7)' }}>
              <span>🔀</span> ทีมงาน
            </div>
            <div className="flex flex-col gap-1">
              {AGENTS.filter(a => a.id !== 'ace').map(agent => {
                const state = agentStates[agent.id] || 'idle'
                const stateColor = { idle: '#6B7280', thinking: '#F59E0B', typing: '#3B82F6', done: '#10B981' }
                const stateLabel = { idle: 'Idle', thinking: 'คิด…', typing: 'ตอบ…', done: 'เสร็จ ✓' }
                return (
                  <button
                    key={agent.id}
                    onClick={() => handleCharacterClick(agent.id)}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg transition-all hover:opacity-90 active:scale-95 text-left w-full"
                    style={{
                      background: selectedAgent === agent.id ? `${agent.color}30` : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${selectedAgent === agent.id ? agent.color + '60' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${state !== 'idle' ? 'animate-pulse' : ''}`}
                      style={{ background: stateColor[state] }}/>
                    <span className="font-semibold text-xs flex-1 truncate" style={{ color: agent.color }}>
                      {agent.name}
                    </span>
                    <span className="text-xs shrink-0" style={{ color: stateColor[state], fontSize: '10px' }}>
                      {stateLabel[state]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

        </div>

        {/* Right 60%: Chat panel — พับได้ */}
        <div
          className="flex flex-col h-full overflow-hidden transition-all duration-300"
          style={{
            width: selectedAgent ? '60%' : '0%',
            minWidth: 0,
            borderLeft: selectedAgent ? '1px solid rgba(210,140,50,0.14)' : 'none',
          }}
        >
          <AnimatePresence mode="wait">
            {selectedAgent ? (
              <motion.div
                key={selectedAgent}
                className="h-full w-full"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <ChatPanel
                  agentId={selectedAgent}
                  agentStates={agentStates}
                  messages={messages}
                  onSend={(agentId, text) => {
                    if (agentId === 'nova') {
                      handleVideoGeneration(text)
                    } else {
                      handleSend(agentId, text)
                    }
                  }}
                  onClose={handleClose}
                />
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                className="h-full w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChatPlaceholder onSelect={handleCharacterClick}/>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  )
}

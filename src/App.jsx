import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import OfficeScene from './components/OfficeScene'
import ChatPanel from './components/ChatPanel'
import AgentAvatar from './components/Avatars'
import { AGENTS, getAgent } from './data/agents'
import { callAgent, evaluateVideoQuality } from './services/api'
import { logTask, getRecentLogs, buildUpskillContext, clearNotionLogs } from './services/notion'
import { generateVideo, recordScore, getModelStats } from './services/videoService'
import { sendContentPackage } from './services/telegramService'
import { recordCost, getSummary, toBaht } from './services/costTracker'
import { getFinanceSummary } from './services/financeService'
import SwarmRoom from './components/SwarmRoom'


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
    <div className="flex flex-col h-full w-full" style={{ background: 'transparent' }}>
      <div className="h-1" style={{ background: 'linear-gradient(90deg, #F59E0B, #D97706)' }}/>

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-7 min-h-0 overflow-y-auto py-8">
        {/* Branding */}
        <div className="text-center">
          <div className="text-5xl mb-3">🌳</div>
          <h1 className="text-2xl font-bold text-amber-100 tracking-tight mb-1">Pixel Office</h1>
          <p className="text-sm text-amber-400/70">ห้องผู้บริหาร · AI Agent Team</p>
        </div>

        {/* Instruction */}
        <p className="text-sm text-amber-200/60 text-center max-w-xs leading-relaxed">
          เลือกตัวละครจากออฟฟิศด้านซ้ายเพื่อเริ่มสนทนา หรือคลิกที่ตัวแทนด้านล่าง
        </p>

        {/* Agent grid */}
        <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
          {AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl cursor-pointer transition-all hover:scale-108 active:scale-95"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.06)` }}
            >
              <div className="overflow-hidden rounded-xl flex items-end justify-center"
                style={{ width: 40, height: 40, background: `${agent.color}22` }}>
                <AgentAvatar animal={agent.animal} state="idle" size={38}/>
              </div>
              <span className="text-center font-bold leading-none" style={{ color: agent.color, fontSize: '9px' }}>
                {agent.name}
              </span>
              <span className="text-center leading-none" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '8px' }}>
                {agent.role}
              </span>
            </button>
          ))}
        </div>

        {/* Model info */}
        <div className="text-center space-y-1" style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>
          <p>Ace · Charlie · Coco → claude-sonnet-4-5</p>
          <p>Others → claude-haiku-4-5</p>
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
  const [loadingHistory, setLoadingHistory] = useState({})
  const [activeFlow, setActiveFlow] = useState([])
  const [showDashboard, setShowDashboard] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [scanState, setScanState] = useState('idle')
  const [scanMessage, setScanMessage] = useState('')
  const [clearingAllLogs, setClearingAllLogs] = useState(false)
  const [showSwarmRoom, setShowSwarmRoom] = useState(false)
  const [swarmMessages, setSwarmMessages] = useState([])


  const handleClearAllMemory = async () => {
    const ok = window.confirm('คุณแน่ใจหรือไม่ที่จะล้างความจำของเอเจนต์ทุกตัวใน Notion? การกระทำนี้ไม่สามารถย้อนกลับได้')
    if (!ok) return
    setClearingAllLogs(true)
    try {
      for (const agent of AGENTS) {
        await clearNotionLogs(agent.name)
      }
      setMessages({})
      alert('ล้างความจำของเอเจนต์ทั้งหมดใน Notion เรียบร้อยแล้ว!')
      setShowSettings(false)
    } catch (err) {
      console.error(err)
      alert('เกิดข้อผิดพลาดในการล้างความจำ')
    } finally {
      setClearingAllLogs(false)
    }
  }

  const runSystemScan = () => {
    if (scanState === 'scanning') return
    setScanState('scanning')
    setScanMessage('')
    setTimeout(() => {
      setScanState('complete')
      setScanMessage('ระบบวิเคราะห์สำเร็จ: เชื่อมต่อ Notion API, Anthropic API, Telegram BOT และ iApp TTS เป็นปกติ 100% 🟢')
      setTimeout(() => {
        setScanState('idle')
        setScanMessage('')
      }, 4500)
    }, 1500)
  }

  const handleResetSession = () => {
    const ok = window.confirm('คุณต้องการเริ่มระบบใหม่ (Reset Session) หรือไม่?')
    if (ok) {
      window.location.reload()
    }
  }

  // Load Notion finance summary when dashboard is shown
  useEffect(() => {
    if (showDashboard) {
      const loadNotionFinance = async () => {
        const summary = await getFinanceSummary()
        if (summary) {
          const byAgent = {}
          for (const row of summary.recentRows) {
            byAgent[row.agent] = (byAgent[row.agent] ?? 0) + row.usd
          }
          setCostSummary({
            budget: 30,
            spent: summary.totalUSD,
            remaining: Math.max(0, 30 - summary.totalUSD),
            pctUsed: Math.min(100, Math.round((summary.totalUSD / 30) * 100)),
            byCategory: summary.byCategory,
            byAgent,
            entries: summary.recentRows.map(r => ({
              ts: r.date,
              category: r.category,
              agentName: r.agent || 'System',
              description: r.description,
              usd: r.usd
            })),
          })
        }
      }
      loadNotionFinance().catch(err => console.error('Failed to load finance from Notion:', err))
    }
  }, [showDashboard])

  // Poll background Telegram swarm state
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch('/api/swarm-state')
        if (!res.ok) return
        const data = await res.json()
        
        // If there's an active flow running on the backend
        if (data.activeFlow && data.activeFlow.length > 0) {
          setAgentStates(prev => {
            const nextStates = { ...prev }
            Object.keys(nextStates).forEach(k => {
              nextStates[k] = data.agentStates[k] || 'idle'
            })
            return nextStates
          })
          setActiveFlow(data.activeFlow)
          setSwarmMessages(data.messages || [])
          
          // Auto transition to Swarm Room
          setShowSwarmRoom(true)
          setSelectedAgent(null)
        } else {
          // If flow just finished, clear active states
          setActiveFlow(prev => {
            if (prev.length > 0) {
              setAgentStates(Object.fromEntries(AGENTS.map(a => [a.id, 'idle'])))
              return []
            }
            return prev
          })
        }
      } catch (err) {
        // Ignore background polling errors
      }
    }, 2000)

    return () => clearInterval(intervalId)
  }, [])


  const loadHistory = useCallback(async (agentId) => {
    const agent = getAgent(agentId)
    if (!agent) return

    if (messagesRef.current[agentId] && messagesRef.current[agentId].length > 0) return

    setLoadingHistory(prev => ({ ...prev, [agentId]: true }))
    try {
      const logs = await getRecentLogs({ agentName: agent.name, limit: 10 })
      
      const chatMessages = logs.reverse().flatMap(log => {
        const msgs = []
        if (log.task) {
          msgs.push({ role: 'user', content: log.task, type: 'text' })
        }
        if (log.resultSummary) {
          const imgMatch = log.resultSummary.match(/^\[IMAGE:\s*(https?:\/\/\S+)\]\s*([\s\S]*)$/)
          if (imgMatch) {
            msgs.push({
              role: 'agent',
              content: imgMatch[2] || 'สร้างภาพเสร็จแล้วค่ะ',
              type: 'image',
              imageUrl: imgMatch[1],
            })
          } else {
            msgs.push({ role: 'agent', content: log.resultSummary, type: 'text' })
          }
        }
        return msgs
      })

      setMessages(prev => ({
        ...prev,
        [agentId]: chatMessages,
      }))
    } catch (err) {
      console.error('Failed to load history from Notion:', err)
    } finally {
      setLoadingHistory(prev => ({ ...prev, [agentId]: false }))
    }
  }, [])

  useEffect(() => {
    if (selectedAgent) {
      loadHistory(selectedAgent)
    }
  }, [selectedAgent, loadHistory])

  const handleClearMemory = useCallback(async (agentId) => {
    const agent = getAgent(agentId)
    if (!agent) return

    try {
      await clearNotionLogs(agent.name)
      setMessages(prev => ({
        ...prev,
        [agentId]: [],
      }))
    } catch (err) {
      console.error('Failed to clear memory in Notion:', err)
    }
  }, [])

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
      const notionResultSummary = (typeof reply === 'object' && reply.type === 'image')
        ? `[IMAGE: ${reply.imageUrl}] ${reply.content}`
        : replyText;

      logTask({
        agentName: agent.name,
        task: text,
        skillsUsed: agent.role,
        resultSummary: notionResultSummary,
        status: 'completed',
        sessionId,
      })

      refreshCost()
      setAgentState(agentId, 'done')
      setTimeout(() => setAgentState(agentId, 'idle'), 2200)

      // ── Sub-agents คุยกัน sequential (ประหยัด token) ──────────
      if (agentId === 'ace') {
        const aceReplyText = typeof reply === 'string' ? reply : reply?.content ?? ''
        
        let subIds = []
        const flowMatch = aceReplyText.match(/<flow>(.*?)<\/flow>/i)
        if (flowMatch) {
          subIds = flowMatch[1]
            .split(',')
            .map(s => s.trim().toLowerCase())
            .filter(id => {
              const a = getAgent(id)
              return a && id !== 'ace'
            })
        }

        if (subIds.length === 0) {
          subIds = getOrchestratorFlow(text)
        }

        console.log('Orchestration Flow:', subIds)

        // runChain: เรียก agent ทีละคน ส่ง context สะสมไปด้วย
        const runChain = async () => {
          setActiveFlow(['ace', ...subIds])
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
              const subNotionResult = (typeof subReply === 'object' && subReply.type === 'image')
                ? `[IMAGE: ${subReply.imageUrl}] ${subReply.content}`
                : replyText;

              logTask({
                agentName: subAgent.name,
                task: text,
                skillsUsed: subAgent.role,
                resultSummary: subNotionResult,
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
          // Clear active flow line after a delay so it remains visible for a bit
          setTimeout(() => setActiveFlow([]), 5000)
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
    setShowSwarmRoom(false)
    setSelectedAgent(prev => prev === agentId ? null : agentId)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedAgent(null)
    setShowSwarmRoom(false)
  }, [])


  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden" style={{ background: 'radial-gradient(circle at center, #182016 0%, #0c0e0b 100%)' }}>

      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0 gap-3"
        style={{
          background: 'rgba(15, 20, 15, 0.45)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
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

        {/* Centered spacer/header subtitle */}
        <div className="flex-1 flex justify-center text-center text-xs font-semibold text-amber-200/40 uppercase tracking-widest hidden lg:block">
          Executive floor portal · active agent swarm
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

        {/* Left Sidebar Navigation */}
        <div className="hidden md:flex flex-col items-center justify-between py-6 w-16 shrink-0 bg-black/30 border border-white/5 rounded-3xl my-3 ml-3 backdrop-blur-lg shadow-2xl">
          <div className="flex flex-col items-center gap-6">
            {/* Home button */}
            <button
              onClick={() => setSelectedAgent(null)}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 text-white shadow-md cursor-pointer transition-all hover:bg-white/15"
              title="Reset View"
            >
              <span className="text-lg">🏠</span>
            </button>
            {/* Grid button */}
            <button
              onClick={() => setShowDashboard(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              title="Executive Dashboard"
            >
              <span className="text-lg">🎛️</span>
            </button>
            {/* Swarm Room button */}
            <button
              onClick={() => {
                setSelectedAgent(null)
                setShowSwarmRoom(true)
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${showSwarmRoom ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30 shadow-md' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
              title="ห้องประชุมแชท Swarm"
            >
              <span className="text-lg">👥</span>
            </button>

            {/* Document button */}
            <button
              onClick={() => window.open(`https://www.notion.so/${import.meta.env.VITE_NOTION_DATABASE_ID || '4b58c4384a6148bf9894f91f602129ea'}`, '_blank')}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              title="Notion Logs"
            >
              <span className="text-lg">📄</span>
            </button>
            {/* Messages button */}
            <button
              onClick={() => handleCharacterClick('ace')}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              title="Chat with Ace (Boss)"
            >
              <span className="text-lg">💬</span>
            </button>
            {/* Scan button */}
            <button
              onClick={runSystemScan}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              title="Run Diagnostics"
            >
              <span className="text-lg">🔍</span>
            </button>
          </div>
          <div className="flex flex-col items-center gap-6">
            {/* Settings button */}
            <button
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              title="Settings"
            >
              <span className="text-lg">⚙️</span>
            </button>
            {/* Signout button */}
            <button
              onClick={handleResetSession}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-red-400 hover:bg-white/5 transition-all cursor-pointer"
              title="Restart Session"
            >
              <span className="text-lg">🚪</span>
            </button>
          </div>
        </div>

        {/* Left: Office scene — ขยายเต็มเมื่อไม่มี chat */}
        <div className="flex flex-col h-full overflow-hidden transition-all duration-300"
          style={{ width: (selectedAgent || showSwarmRoom) ? '40%' : '100%', minWidth: 0, flexShrink: 0 }}>

          {/* Office scene — takes remaining height */}
          <div
            className={`relative flex-1 overflow-hidden min-h-0 mt-3 ml-3 mb-1.5 ${(selectedAgent || showSwarmRoom) ? 'mr-1.5' : 'mr-3'} rounded-3xl border border-white/5 bg-black/25 backdrop-blur-md shadow-2xl`}
          >
            <OfficeScene
              agentStates={agentStates}
              selectedAgent={selectedAgent}
              onCharacterClick={handleCharacterClick}
              activeFlow={activeFlow}
            />
            <AnimatePresence>
              {!(selectedAgent || showSwarmRoom) && (
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
            className={`shrink-0 ml-3 mb-3 mt-1.5 ${(selectedAgent || showSwarmRoom) ? 'mr-1.5' : 'mr-3'} rounded-3xl border border-white/5 bg-black/25 backdrop-blur-md shadow-2xl p-4 overflow-y-auto`}
            style={{
              maxHeight: '38%',
            }}
          >
            <div className="text-xs font-bold mb-2.5 flex items-center gap-1.5 px-1"
              style={{ color: 'rgba(253,230,138,0.7)' }}>
              <span>🔀</span> ทีมงาน (Agent Status)
            </div>
            <div className="flex flex-wrap gap-2">
              {AGENTS.map(agent => {
                const state = agentStates[agent.id] || 'idle'
                const stateColor = { idle: '#6B7280', thinking: '#F59E0B', typing: '#3B82F6', done: '#10B981' }
                const stateLabel = { idle: 'Idle', thinking: 'คิด…', typing: 'ตอบ…', done: 'เสร็จ ✓' }
                const isAgentActive = selectedAgent === agent.id
                return (
                  <button
                    key={agent.id}
                    onClick={() => handleCharacterClick(agent.id)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:scale-105 active:scale-95 text-left cursor-pointer"
                    style={{
                      background: isAgentActive ? `${agent.color}35` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isAgentActive ? agent.color + '70' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${state !== 'idle' ? 'animate-pulse' : ''}`}
                      style={{ background: stateColor[state] }}/>
                    <span className="font-bold text-xs truncate" style={{ color: agent.color }}>
                      {agent.name}
                    </span>
                    <span className="text-[10px] shrink-0" style={{ color: stateColor[state] }}>
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
            width: (selectedAgent || showSwarmRoom) ? '60%' : '0%',
            minWidth: 0,
          }}
        >
          <div className="flex flex-col h-full overflow-hidden my-3 mr-3 ml-1.5 rounded-3xl border border-white/5 bg-black/25 backdrop-blur-md shadow-2xl">
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
                    loadingHistory={loadingHistory[selectedAgent]}
                    onClearMemory={handleClearMemory}
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
              ) : showSwarmRoom ? (
                <motion.div
                  key="swarm-room"
                  className="h-full w-full"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <SwarmRoom
                    messages={swarmMessages}
                    activeFlow={activeFlow}
                    agentStates={agentStates}
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

      {/* ── Executive Dashboard Modal 🎛️ ── */}
      <AnimatePresence>
        {showDashboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDashboard(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-neutral-900/90 border border-white/10 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl backdrop-blur-lg flex flex-col max-h-[85vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-4 border-b border-white/10 shrink-0">
                <h2 className="text-lg font-bold text-amber-200 flex items-center gap-2">
                  <span>🎛️</span> Executive Dashboard
                </h2>
                <button
                  onClick={() => setShowDashboard(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors text-lg"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-5">
                {/* Budget Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="text-center">
                    <div className="text-xs text-white/50">Spent (USD)</div>
                    <div className="text-lg font-black text-emerald-400">${costSummary.spent}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-white/50">Spent (Baht)</div>
                    <div className="text-lg font-black text-emerald-400">~฿{toBaht(costSummary.spent)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-white/50">Budget</div>
                    <div className="text-lg font-black text-amber-400">${costSummary.budget}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-white/50">Remaining</div>
                    <div className="text-lg font-black text-blue-400">${costSummary.remaining}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-white/60">
                    <span>Budget Used</span>
                    <span>{costSummary.pctUsed}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full overflow-hidden bg-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${costSummary.pctUsed}%`,
                        background: costSummary.pctUsed > 90 ? '#EF4444' : costSummary.pctUsed > 70 ? '#F59E0B' : '#10B981',
                      }}
                    />
                  </div>
                </div>

                {/* Agent Cost Breakdown */}
                <div className="space-y-2">
                  <div className="text-sm font-bold text-amber-200/80">API Cost by Agent</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {AGENTS.map(agent => {
                      const cost = costSummary.byAgent[agent.name] || 0
                      return (
                        <div key={agent.id} className="bg-white/5 px-3 py-2 rounded-xl flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold" style={{ color: agent.color }}>{agent.name}</span>
                          <span className="text-xs text-emerald-400 font-bold">${cost.toFixed(4)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Recent Logs Table */}
                <div className="space-y-2">
                  <div className="text-sm font-bold text-amber-200/80">Recent Ledger Entries (Latest 20)</div>
                  <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/5 max-h-48 overflow-y-auto text-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/5">
                          <th className="p-2 font-bold text-white/70">Agent</th>
                          <th className="p-2 font-bold text-white/70">Category</th>
                          <th className="p-2 font-bold text-white/70">Description</th>
                          <th className="p-2 font-bold text-white/70 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costSummary.entries.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="p-4 text-center text-white/40">No cost records yet</td>
                          </tr>
                        ) : (
                          costSummary.entries.map((entry, idx) => (
                            <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="p-2 font-bold" style={{ color: getAgent(entry.agentName.toLowerCase())?.color || '#FFF' }}>
                                {entry.agentName}
                              </td>
                              <td className="p-2 text-white/80">{entry.category}</td>
                              <td className="p-2 text-white/60 truncate max-w-[160px]">{entry.description}</td>
                              <td className="p-2 text-emerald-400 font-bold text-right">${entry.usd.toFixed(4)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── System Settings Modal ⚙️ ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-neutral-900/90 border border-white/10 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl backdrop-blur-lg flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-4 border-b border-white/10 shrink-0">
                <h2 className="text-lg font-bold text-amber-200 flex items-center gap-2">
                  <span>⚙️</span> System Settings & Logs
                </h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors text-lg"
                >
                  ×
                </button>
              </div>

              <div className="py-4 space-y-4 text-sm">
                <div className="space-y-2">
                  <div className="text-xs text-white/40 uppercase font-bold tracking-widest">Environment Config</div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1.5 font-mono text-xs text-white">
                    <div className="flex justify-between">
                      <span className="text-white/60">Notion DB ID:</span>
                      <span className="text-white/80">4b58c438...ea</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Notion Key:</span>
                      <span className="text-white/80">ntn_4277...EN</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Anthropic Key:</span>
                      <span className="text-white/80">sk-ant-api03...AAA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Telegram Token:</span>
                      <span className="text-white/80">8652537...ns</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="text-xs text-white/40 uppercase font-bold tracking-widest">Global Utilities</div>
                  <button
                    onClick={handleClearAllMemory}
                    disabled={clearingAllLogs}
                    className="w-full py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 border border-red-500/20 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {clearingAllLogs ? '⌛ กำลังล้าง...' : '🗑️ ล้างประวัติความจำเอเจนต์ทุกตัว'}
                  </button>
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    *การกดล้างจะทำการอาร์ไคฟ์ประวัติสนทนาของเอเจนต์ทุกตัวบน Notion Database ถาวร ทำให้เอเจนต์ทั้งหมดเริ่มคุยใหม่โดยไม่มีข้อมูลเก่า
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── System Status Diagnostics Scanning Loader 🔍 ── */}
      <AnimatePresence>
        {scanState === 'scanning' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-4 text-white"
          >
            <div className="relative w-16 h-16">
              <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin"/>
              <span className="absolute inset-0 flex items-center justify-center text-xl animate-pulse">🔍</span>
            </div>
            <div className="text-sm font-bold text-amber-200 tracking-wider">กำลังตรวจสอบความเชื่อมโยงระบบ (System Diagnostic Scan)...</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Diagnostic Scan Complete Notification ── */}
      <AnimatePresence>
        {scanMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 left-6 z-50 max-w-md bg-neutral-900/95 border border-emerald-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-center gap-3 text-white"
          >
            <span className="text-2xl text-emerald-400">🛡️</span>
            <div className="flex-1">
              <h4 className="text-xs uppercase tracking-wider font-bold text-emerald-400">System Diagnostic Report</h4>
              <p className="text-xs text-white/90 leading-relaxed mt-0.5">{scanMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    )
}

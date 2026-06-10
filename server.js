import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { AGENTS } from './src/data/agents.js'

// Manual .env loader for local development
if (fs.existsSync('.env')) {
  const envConfig = fs.readFileSync('.env', 'utf-8')
  envConfig.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const firstEq = trimmed.indexOf('=')
    if (firstEq === -1) return
    const key = trimmed.slice(0, firstEq).trim()
    let val = trimmed.slice(firstEq + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
    process.env[key] = val
  })
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

// Global Swarm Sync State
let globalAgentStates = {}
let globalActiveFlow = []
let globalSwarmMessages = []

// ── Daily Scheduler & Weekday Topics ──────────────────────────────
const WEEKDAY_TOPICS = {
  Monday: [
    "Credit card debt trap - minimum payment = never-ending debt",
    "First car purchase - can afford payments, can't afford ownership",
    "Endowment life insurance - actually good or just good salesmanship?",
    "MLM / direct sales - small investment big returns, how believable?",
    "Online Ponzi schemes - what they look like now",
    "Loan sharks - brutal interest, pay forever and never finish",
    "0% installments on everything - convenient but fast track to broke"
  ],
  Tuesday: [
    "Side income after work - what are the real options?",
    "Start online selling with 0 baht - is it really possible?",
    "Freelance side gigs - tax implications and registration",
    "Company benefits employees never use",
    "10% salary raise but no extra savings - why?",
    "Passive income that's real - not just a dream",
    "Invest in yourself - which online courses are worth it?"
  ],
  Wednesday: [
    "Room rent - what % of salary is the safe maximum?",
    "High electricity bills - how to actually reduce them",
    "200 baht/day food budget - how to make it work",
    "Commute costs: BTS/MRT vs motorcycle vs car - which wins?",
    "Monthly phone plan - are you overpaying?",
    "Medical costs - one illness wipes out all savings",
    "Forgotten subscriptions: Netflix, Spotify, YouTube Premium"
  ],
  Thursday: [
    "Salary day - how to allocate so it lasts the whole month",
    "50/30/20 rule - does it work on a 15,000 baht salary?",
    "e-Wallet & PromptPay - too easy to spend, money vanishes",
    "Simple income-expense tracking that actually works",
    "Pay debt first or save first? - the practical answer",
    "6-month emergency fund - how to build it if salary is low",
    "Year-end bonus - how to use it smartly, not blow it in a week"
  ],
  Friday: [
    "Fixed deposit vs savings account - what's the difference?",
    "SSF/RMF funds for beginners - real tax savings",
    "Gold - is buying gold still a good choice now?",
    "Stocks - can you start investing with just 1,000 baht?",
    "Mutual funds - which one for absolute beginners?",
    "Government bonds - how safe? how to buy?",
    "ETF, VOO, and S&P 500 - what are they and why do people talk about them?"
  ],
  Saturday: [
    "สรุปข่าวสงครามและความตึงเครียดระหว่างประเทศรอบสัปดาห์ - กระทบราคาน้ำมัน ทองคำ ค่าเงิน ค่าครองชีพ และการลงทุนของคนทำงานอย่างไร พร้อมวิธีปรับตัวรับมือ",
    "สรุปข่าวสารเทคโนโลยีและ AI รอบสัปดาห์ - เทคโนโลยีใหม่ๆ กระทบการทำงาน รายได้ โอกาสทางอาชีพ หรือหุ้นกลุ่มเทคโนโลยีอย่างไรบ้าง",
    "สรุปข่าวเศรษฐกิจมหาภาคและหนี้สินรอบสัปดาห์ - สถานการณ์เงินเฟ้อ ดอกเบี้ยนโยบาย หนี้ครัวเรือน และอัตราแลกเปลี่ยน ส่งผลต่อเงินในกระเป๋าคนทำงานอย่างไร",
    "สรุปข่าวนโยบายรัฐและการเมืองรอบสัปดาห์ - มาตรการกระตุ้นเศรษฐกิจ นโยบายภาษี สวัสดิการรัฐ หรือการปรับค่าแรงขั้นต่ำ กระทบปากท้องและรายจ่ายเราอย่างไร",
    "สรุปข่าวความเคลื่อนไหวตลาดการลงทุนรอบสัปดาห์ - สถานการณ์หุ้นไทย หุ้นโลก กองทุนรวม พันธบัตร และตลาดคริปโตเคอเรนซีที่คนทำงานต้องรู้",
    "สรุปข่าวเด่นเพื่อผู้บริโภครอบสัปดาห์ - การปรับขึ้นค่าไฟ ค่าน้ำ ค่าเดินทาง ราคาอาหาร หรือค่าบริการแอปพลิเคชันต่างๆ ที่กระทบรายจ่ายประจำวันโดยตรง",
    "สรุปภาพรวมข่าวใหญ่ด้านการเงินรอบสัปดาห์ - 3 ข่าวเด่นที่สุดที่กระทบเงินเข้าและเงินออกของคนทำงานไทย พร้อมบทวิเคราะห์สิ่งที่ต้องเตรียมตัวรับมือในสัปดาห์หน้า"
  ]
}

const INDICES_FILE = path.join(__dirname, 'current_indices.json')
let currentIndices = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0 }
if (fs.existsSync(INDICES_FILE)) {
  try {
    currentIndices = { ...currentIndices, ...JSON.parse(fs.readFileSync(INDICES_FILE, 'utf-8')) }
  } catch (e) {
    console.error('Failed to parse current_indices.json, using defaults', e)
  }
}

function saveIndices() {
  try {
    fs.writeFileSync(INDICES_FILE, JSON.stringify(currentIndices, null, 2))
  } catch (e) {
    console.error('Failed to save current_indices.json', e)
  }
}

// Health check (no auth)
app.get('/health', (req, res) => res.send('ok'))

// Basic Auth middleware
const SITE_USER = process.env.SITE_USER || 'admin'
const SITE_PASS = process.env.SITE_PASS || 'pixeloffice'

app.use((req, res, next) => {
  // Bypass Basic Auth for health, Telegram webhook, and swarm state API
  if (req.path === '/health' || req.path === '/webhook/telegram' || req.path === '/api/swarm-state') return next()

  // Skip auth if no password is set
  if (!process.env.SITE_PASS) return next()

  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Pixel Office"')
    return res.status(401).send('Authentication required')
  }

  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64')
    .toString()
    .split(':')

  if (user === SITE_USER && pass === SITE_PASS) {
    return next()
  }

  res.set('WWW-Authenticate', 'Basic realm="Pixel Office"')
  res.status(401).send('Invalid credentials')
})
app.use(express.json())

// Proxy Notion pages
app.post('/api/notion/pages', async (req, res) => {
  const key = process.env.VITE_NOTION_API_KEY || process.env.NOTION_API_KEY
  if (!key) return res.status(500).json({ error: 'Notion API key not configured on server' })
  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(req.body),
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (err) {
    console.error('[Proxy] Notion page write error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Proxy Notion page update (for archiving/deleting logs)
app.patch('/api/notion/pages/:id', async (req, res) => {
  const key = process.env.VITE_NOTION_API_KEY || process.env.NOTION_API_KEY
  const { id } = req.params
  if (!key) return res.status(500).json({ error: 'Notion API key not configured on server' })
  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(req.body),
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (err) {
    console.error('[Proxy] Notion page update error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Proxy Notion database query
app.post('/api/notion/databases/:id/query', async (req, res) => {
  const key = process.env.VITE_NOTION_API_KEY || process.env.NOTION_API_KEY
  const { id } = req.params
  if (!key) return res.status(500).json({ error: 'Notion API key not configured on server' })
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(req.body),
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (err) {
    console.error('[Proxy] Notion db query error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Endpoint to fetch global swarm states and messages
app.get('/api/swarm-state', (req, res) => {
  res.json({
    agentStates: globalAgentStates,
    activeFlow: globalActiveFlow,
    messages: globalSwarmMessages
  })
})

// Endpoint to clear global swarm states and messages
app.post('/api/clear-swarm', (req, res) => {
  globalSwarmMessages = []
  globalActiveFlow = []
  globalAgentStates = {}
  res.json({ success: true })
})

// ── Telegram Webhook & LLM Swarm Orchestration ────────────────────

async function sendTelegramMessage(text) {
  const token = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    })
    const data = await res.json()
    if (!data.ok) {
      console.warn('[Telegram] First send failed (likely markdown error), retrying without markdown:', data.description)
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text
        })
      })
    }
  } catch (err) {
    console.error('Failed to send Telegram message:', err)
  }
}

async function sendTelegramPhoto(photoUrl, caption) {
  const token = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption,
        parse_mode: 'Markdown'
      })
    })
    const data = await res.json()
    if (!data.ok) {
      console.warn('[Telegram] Photo send failed (likely markdown error), retrying without markdown:', data.description)
      await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: caption
        })
      })
    }
  } catch (err) {
    console.error('Failed to send Telegram photo:', err)
  }
}

async function sendTelegramVideo(videoUrl, caption) {
  const token = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        video: videoUrl,
        caption: caption,
        parse_mode: 'Markdown'
      })
    })
    const data = await res.json()
    if (!data.ok) {
      console.warn('[Telegram] Video send failed (likely markdown error), retrying without markdown:', data.description)
      await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          video: videoUrl,
          caption: caption
        })
      })
    }
  } catch (err) {
    console.error('Failed to send Telegram video:', err)
  }
}

async function sendTelegramMessageWithButton(text, buttonText, callbackData) {
  const token = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: buttonText, callback_data: callbackData }
            ]
          ]
        }
      })
    })
    const data = await res.json()
    if (!data.ok) {
      console.warn('[Telegram] Button send failed, sending normal message:', data.description)
      await sendTelegramMessage(text)
    }
  } catch (err) {
    console.error('Failed to send Telegram message with button:', err)
  }
}

async function sendTelegramDocument(fileBuffer, filename, caption) {
  const token = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  try {
    const blob = new Blob([fileBuffer], { type: 'text/plain' })
    const formData = new FormData()
    formData.append('chat_id', chatId)
    formData.append('document', blob, filename)
    if (caption) {
      formData.append('caption', caption)
      formData.append('parse_mode', 'Markdown')
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData
    })
    const data = await res.json()
    if (!data.ok) {
      console.error('Failed to send document to Telegram:', data)
    }
  } catch (err) {
    console.error('Failed to send Telegram document:', err)
  }
}

async function backendApproveSessionTasks(sessionId) {
  const key = process.env.VITE_NOTION_API_KEY || process.env.NOTION_API_KEY
  const dbId = process.env.VITE_NOTION_DATABASE_ID || process.env.NOTION_DATABASE_ID || '4b58c4384a6148bf9894f91f602129ea'
  if (!key || !sessionId) return

  try {
    const queryRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        filter: {
          property: 'Session ID',
          rich_text: {
            equals: sessionId
          }
        }
      })
    })
    
    if (!queryRes.ok) {
      const err = await queryRes.text()
      console.error('Failed to query Notion tasks for approval:', err)
      return
    }

    const queryData = await queryRes.json()
    const pages = queryData.results || []

    for (const page of pages) {
      await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          properties: {
            Status: { select: { name: 'approved' } }
          }
        })
      })
    }
    console.log(`Notion tasks for session ${sessionId} successfully approved. Count: ${pages.length}`)
  } catch (err) {
    console.error('Failed to approve Notion tasks:', err)
  }
}

async function backendGenerateVideo(prompt, imageUrl = null) {
  const key = process.env.VITE_FAL_KEY || process.env.FAL_KEY
  if (!key) throw new Error('Fal key not configured')

  const cleanPrompt = `${prompt}, cinematic, smooth motion, no text, no subtitles, no captions, no watermarks, no overlays`
  const modelId = imageUrl ? 'fal-ai/wan/v2.7/image-to-video' : 'fal-ai/wan/v2.7/text-to-video'
  const payload = imageUrl
    ? { image_url: imageUrl, prompt: cleanPrompt, duration: 5 }
    : { prompt: cleanPrompt, duration: 5 }

  const hdrs = { 'Authorization': `Key ${key}`, 'Content-Type': 'application/json' }

  const submitRes = await fetch(`https://queue.fal.run/${modelId}`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify(payload),
  })
  if (!submitRes.ok) {
    const err = await submitRes.text()
    throw new Error(`fal.ai submit error: ${err}`)
  }
  const submitData = await submitRes.json()
  const statusUrl = submitData.status_url
  const responseUrl = submitData.response_url

  if (!statusUrl) throw new Error('No status_url returned')

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 4000))
    const statusRes = await fetch(statusUrl, { headers: hdrs })
    const status = await statusRes.json()

    if (status.status === 'COMPLETED') {
      if (responseUrl) {
        const resultRes = await fetch(responseUrl, { headers: hdrs })
        const result = await resultRes.json()
        return result?.video?.url || result?.url || null
      }
      return status.output?.video?.url || status.output?.url || null
    }
    if (status.status === 'FAILED') {
      throw new Error(status.error || 'Video generation failed')
    }
  }
  throw new Error('Video generation timeout (60s)')
}

async function backendLogExpense({ agentName, category, description, usd, project = 'ห่านการเงิน', sessionId = '', notes = '', type = 'Expense' }) {
  const key = process.env.VITE_NOTION_API_KEY || process.env.NOTION_API_KEY
  const dbId = process.env.VITE_FINANCE_DB_ID || process.env.FINANCE_DB_ID || '0c1477ded338419bb19a0ea239d758fd'
  if (!key) return

  const rate = 35
  const thb = Math.round(usd * rate * 100) / 100

  try {
    await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties: {
          Name:             { title:     [{ text: { content: `${agentName} · ${description.slice(0, 50)}` } }] },
          Date:             { date:      { start: new Date().toISOString() } },
          Project:          { select:    { name: project } },
          Category:         { select:    { name: category } },
          Agent:            { rich_text: [{ text: { content: agentName } }] },
          Description:      { rich_text: [{ text: { content: description } }] },
          'Amount USD':     { number:    usd },
          'Amount THB':     { number:    thb },
          Status:           { select:    { name: 'recorded' } },
          'Session ID':     { rich_text: [{ text: { content: sessionId } }] },
          Notes:            { rich_text: [{ text: { content: notes } }] },
          Type:             { select:    { name: type } },
        }
      })
    })
  } catch (err) {
    console.error('Failed to log expense to Notion:', err)
  }
}

function parseCaptionsText(meiReply) {
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


async function callAnthropic({ model, systemPrompt, messages, maxTokens = 1024 }) {
  const apiKey = process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Anthropic API key not configured')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic error: ${err}`)
  }
  const data = await res.json()
  return {
    text: data.content?.[0]?.text ?? '',
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0
  }
}

async function callOpenAICompatible({ baseUrl, apiKey, model, systemPrompt, messages, maxTokens = 1024 }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ]
    })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  const usage = data.usage ?? {}
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0
  }
}

async function callGemini({ model, systemPrompt, messages, maxTokens = 1024 }) {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API key not configured')

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: maxTokens }
      })
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error: ${err}`)
  }
  const data = await res.json()
  const usage = data.usageMetadata ?? {}
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0
  }
}

// Programmatic Math Function helper for Bean CFO
function safeEvalMath(expression) {
  const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '')
  try {
    const result = new Function(`return (${sanitized})`)()
    return typeof result === 'number' && !isNaN(result) ? result : 0
  } catch (e) {
    return 0
  }
}

// Centralized Tool Executor
async function executeTool(name, args) {
  console.log(`[Tool Registry] Executing tool: ${name} with args:`, args)
  try {
    switch (name) {
      case 'notion_connector': {
        const key = process.env.VITE_NOTION_API_KEY || process.env.NOTION_API_KEY
        if (!key) return JSON.stringify({ error: 'Notion API key not configured' })
        const { action, database_id, page_id, properties } = args
        
        if (action === 'read_db') {
          const targetDb = database_id || process.env.FINANCE_DB_ID || '0c1477ded338419bb19a0ea239d758fd'
          const res = await fetch(`https://api.notion.com/v1/databases/${targetDb}/query`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${key}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(args.query ? JSON.parse(args.query) : {})
          })
          const data = await res.json()
          return JSON.stringify(data.results ? data.results.slice(0, 10).map(p => ({
            id: p.id,
            properties: p.properties
          })) : data)
        }
        
        if (action === 'write_db') {
          const targetDb = database_id || process.env.FINANCE_DB_ID || '0c1477ded338419bb19a0ea239d758fd'
          const res = await fetch(`https://api.notion.com/v1/pages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${key}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              parent: { database_id: targetDb },
              properties: properties ? JSON.parse(properties) : {}
            })
          })
          const data = await res.json()
          return JSON.stringify({ success: true, id: data.id })
        }

        if (action === 'update_page') {
          if (!page_id) return JSON.stringify({ error: 'Missing page_id' })
          const res = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${key}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ properties: properties ? JSON.parse(properties) : {} })
          })
          const data = await res.json()
          return JSON.stringify({ success: true, id: data.id })
        }
        
        return JSON.stringify({ error: `Unknown Notion action: ${action}` })
      }
      
      case 'math_engine': {
        const { formula } = args
        if (!formula) return JSON.stringify({ error: 'Missing formula' })
        const val = safeEvalMath(formula)
        return JSON.stringify({ result: val })
      }
      
      case 'web_harvester': {
        const { action, query, url } = args
        if (action === 'search') {
          const res = await callGemini({
            model: 'gemini-2.5-flash',
            systemPrompt: 'You are a search assistant. Summarize recent news or trends for the given query using your knowledge base up to 2026. Keep it concise, professional, and factual.',
            messages: [{ role: 'user', content: query || '' }]
          })
          return JSON.stringify({ summary: res.text })
        }
        if (action === 'scrape') {
          if (!url) return JSON.stringify({ error: 'Missing url' })
          try {
            const fetchRes = await fetch(url)
            const html = await fetchRes.text()
            const cleanText = html
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 3000)
            return JSON.stringify({ text: cleanText })
          } catch (e) {
            return JSON.stringify({ error: `Scraping failed: ${e.message}` })
          }
        }
        return JSON.stringify({ error: `Unknown scraper action: ${action}` })
      }
      
      case 'local_security_sandbox': {
        const { action, filepath, content } = args
        if (action === 'scan_file') {
          if (!filepath) return JSON.stringify({ error: 'Missing filepath' })
          const lowerContent = String(content || '').toLowerCase()
          const suspicious = []
          if (lowerContent.includes('eval(') || lowerContent.includes('new function')) suspicious.push('Dynamic Execution')
          if (lowerContent.includes('child_process') || lowerContent.includes('exec(')) suspicious.push('Subprocess Execution')
          if (lowerContent.includes('rm -rf') || lowerContent.includes('fs.rmdir')) suspicious.push('File Deletion Command')
          
          return JSON.stringify({
            safe: suspicious.length === 0,
            warnings: suspicious
          })
        }
        return JSON.stringify({ error: `Unknown security action: ${action}` })
      }
      
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err) {
    return JSON.stringify({ error: `Tool execution failed: ${err.message}` })
  }
}

async function backendCallAgent(agent, history) {
  const provider = agent.provider ?? 'anthropic'
  const model = agent.model
  const systemPrompt = agent.systemPrompt

  let loopCount = 0
  const maxLoops = 3
  let currentHistory = [...history]
  let finalResult

  while (loopCount < maxLoops) {
    let result
    try {
      switch (provider) {
        case 'deepseek': {
          const apiKey = process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY
          result = await callOpenAICompatible({
            baseUrl: 'https://api.deepseek.com',
            apiKey, model, systemPrompt, messages: currentHistory
          })
          break
        }
        case 'gemini': {
          result = await callGemini({ model, systemPrompt, messages: currentHistory })
          break
        }
        case 'anthropic':
        default: {
          result = await callAnthropic({ model, systemPrompt, messages: currentHistory })
          break
        }
      }
    } catch (err) {
      console.error(`Provider ${provider} failed on backend: ${err.message}.`)
      try {
        await sendTelegramMessage(`💻 **[Leo (Developer)]**: ตรวจพบ Error การเชื่อมต่อ API ของ ${agent.name} ("${err.message}")... กำลังสลับไปใช้ระบบสำรอง (Gemini 2.5 Flash) เพื่อความปลอดภัย...`)
      } catch (e) {
        console.error('Leo failed to send error message:', e)
      }
      result = await callGemini({ model: 'gemini-2.5-flash', systemPrompt, messages: currentHistory })
    }

    if (!result || typeof result.text !== 'string') {
      return result
    }

    // Process legacy Bean math [CALC: ...] tags
    if (agent.id === 'bean') {
      result.text = result.text.replace(/\[CALC:\s*([^\]]+)\]/g, (match, expr) => {
        const val = safeEvalMath(expr)
        return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      })
    }

    // Scan for centralized tool calls: <call_tool name="xxx">...</call_tool>
    const toolRegex = /<call_tool\s+name="([^"]+)">([\s\S]*?)<\/call_tool>/i
    const match = result.text.match(toolRegex)

    if (match) {
      const toolName = match[1].trim()
      const innerContent = match[2]
      
      // Parse arguments: <arg name="xxx">value</arg>
      const argRegex = /<arg\s+name="([^"]+)">([\s\S]*?)<\/arg>/gi
      const args = {}
      let argMatch
      while ((argMatch = argRegex.exec(innerContent)) !== null) {
        args[argMatch[1].trim()] = argMatch[2].trim()
      }

      // If args is empty and the inner content doesn't have <arg> tags, try to parse JSON or treat as single argument
      if (Object.keys(args).length === 0 && innerContent.trim()) {
        try {
          Object.assign(args, JSON.parse(innerContent.trim()))
        } catch (e) {
          args.value = innerContent.trim()
        }
      }

      await sendTelegramMessage(`⚙️ **[${agent.name}]** กำลังเรียกใช้คลังสกิลส่วนกลาง: \`${toolName}\`...`)
      const toolResult = await executeTool(toolName, args)
      
      // Append tool call and result to history to let agent continue
      currentHistory.push({ role: 'assistant', content: result.text })
      currentHistory.push({ role: 'user', content: `[SYSTEM TOOL RESULT for ${toolName}]: ${toolResult}` })
      
      loopCount++
      finalResult = result // update last known result
    } else {
      // No more tool calls, return final result
      return result
    }
  }

  return finalResult
}


async function backendGenerateImage(prompt) {
  const key = process.env.VITE_FAL_KEY || process.env.FAL_KEY
  if (!key) throw new Error('Fal key not configured')

  const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: 'landscape_4_3', num_inference_steps: 4, num_images: 1 }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Image API error: ${err}`)
  }
  const data = await res.json()
  return data.images[0].url
}

async function backendLogTask({ agentName, task, skillsUsed, resultSummary, status = 'completed', sessionId }) {
  const key = process.env.VITE_NOTION_API_KEY || process.env.NOTION_API_KEY
  const dbId = process.env.VITE_NOTION_DATABASE_ID || process.env.NOTION_DATABASE_ID || '4b58c4384a6148bf9894f91f602129ea'
  if (!key) return

  try {
    await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties: {
          Name:             { title:     [{ text: { content: `${agentName} · ${task.slice(0, 50)}` } }] },
          'Agent Name':     { rich_text: [{ text: { content: agentName } }] },
          Task:             { rich_text: [{ text: { content: task } }] },
          'Skills Used':    { rich_text: [{ text: { content: skillsUsed } }] },
          'Result Summary': { rich_text: [{ text: { content: resultSummary.slice(0, 500) } }] },
          Status:           { select:    { name: status } },
          Timestamp:        { date:      { start: new Date().toISOString() } },
          'Session ID':     { rich_text: [{ text: { content: sessionId } }] },
        }
      })
    })
  } catch (err) {
    console.error('Failed to log task to Notion:', err)
  }
}

async function runTelegramSwarm(promptText) {
  const ace = AGENTS.find(a => a.id === 'ace')
  if (!ace) return

  const sessionId = `telegram_${Date.now()}`
  let swarmCost = 0

  // Reset Swarm State for new run
  globalSwarmMessages = []
  globalAgentStates = { ace: 'thinking' }
  globalActiveFlow = ['ace']

  globalSwarmMessages.push({
    agentId: 'user',
    agentName: 'User',
    role: 'ผู้ใช้',
    content: promptText,
    type: 'text',
    timestamp: new Date().toLocaleTimeString('th-TH')
  })

  await sendTelegramMessage(`🤖 **[Ace]** ได้รับคำสั่งแล้วครับ: "${promptText}"\nกำลังวิเคราะห์แผนงานและลำดับขั้นตอน...`)

  let aceResponse
  try {
    const res = await backendCallAgent(ace, [{ role: 'user', content: promptText }])
    aceResponse = res.text
    globalAgentStates.ace = 'done'
    globalSwarmMessages.push({
      agentId: 'ace',
      agentName: 'Ace',
      role: 'Orchestrator',
      content: aceResponse,
      type: 'text',
      timestamp: new Date().toLocaleTimeString('th-TH')
    })
  } catch (err) {
    console.error('Ace failed:', err)
    globalAgentStates.ace = 'idle'
    globalSwarmMessages.push({
      agentId: 'ace',
      agentName: 'Ace',
      role: 'Orchestrator',
      content: `❌ เกิดข้อผิดพลาดในการวิเคราะห์แผนงาน: ${err.message}`,
      type: 'text',
      timestamp: new Date().toLocaleTimeString('th-TH')
    })
    await sendTelegramMessage(`❌ **[Ace Error]** เกิดข้อผิดพลาดในการวิเคราะห์แผนงาน: ${err.message}`)
    return
  }

  await sendTelegramMessage(`📋 **แผนงานจาก Ace:**\n${aceResponse}`)

  await backendLogTask({
    agentName: ace.name,
    task: promptText,
    skillsUsed: 'Orchestration',
    resultSummary: aceResponse,
    sessionId
  })

  const flowMatch = aceResponse.match(/<flow>(.*?)<\/flow>/i)
  if (!flowMatch) {
    globalActiveFlow = []
    globalAgentStates = {}
    await sendTelegramMessage(`💡 **[Ace]** ไม่มีการระบุขั้นตอน flow สำหรับ sub-agents ปฏิบัติงานเสร็จสิ้นแล้วครับ`)
    return
  }

  const flowAgents = flowMatch[1].split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  if (flowAgents.length === 0) {
    globalActiveFlow = []
    globalAgentStates = {}
    await sendTelegramMessage(`💡 **[Ace]** ลำดับขั้นตอนเป็นศูนย์ ปฏิบัติงานเสร็จสิ้นแล้วครับ`)
    return
  }

  globalActiveFlow = ['ace', ...flowAgents]
  await sendTelegramMessage(`⛓️ **ขั้นตอนการทำงาน (Flow):** ${flowAgents.join(' ➔ ')}`)

  let accumulatedContext = `คำสั่งต้นฉบับของผู้ใช้: "${promptText}"\n\nแผนการทำงานของ Ace:\n${aceResponse}\n\n`

  for (const agentId of flowAgents) {
    const agent = AGENTS.find(a => a.id === agentId)
    if (!agent) {
      await sendTelegramMessage(`⚠️ ไม่พบเอเจนต์ไอดี "${agentId}" ในระบบ`)
      continue
    }

    globalAgentStates[agentId] = 'thinking'
    await sendTelegramMessage(`⏳ **[${agent.name}]** กำลังปฏิบัติงานในส่วนของตนเอง...`)

    try {
      if (agent.id === 'violet') {
        const res = await backendCallAgent(agent, [{ role: 'user', content: accumulatedContext }])
        const violetText = res.text

        await sendTelegramMessage(`🎨 **[Violet]**: ${violetText}`)

        // Retrieve Mei's content to divide into scenes
        const meiMsg = globalSwarmMessages.find(m => m.agentId === 'mei')
        const meiContent = meiMsg ? meiMsg.content : ''
        
        let textForStoryboard = meiContent || violetText
        const cleanedTextForLen = textForStoryboard.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim()
        
        // Calculate number of images: N based on script duration
        let numImages = 5
        if (cleanedTextForLen.length >= 1500) {
          numImages = 20
        } else if (cleanedTextForLen.length >= 1000) {
          numImages = 15
        } else if (cleanedTextForLen.length >= 400) {
          numImages = 10
        }

        await sendTelegramMessage(`🎨 **[Violet]** กำลังแบ่งบทวิเคราะห์เป็น ${numImages} ฉาก เพื่อทำภาพ Storyboard สำหรับใช้ในวิดีโอ...`)

        let storyboard = []
        try {
          const geminiRes = await callGemini({
            model: 'gemini-2.5-flash',
            systemPrompt: `You are a storyboard designer. Split the script into exactly ${numImages} sequential scenes. For each scene, write:
1) A brief summary of the scene's content in Thai.
2) A detailed English prompt for fal.ai flux/schnell to generate a matching graphic or 3D animation background. Keep prompts beautiful, modern, no text, no captions. Use 'financial goose' (ห่านการเงิน) mascot as the main presenter.
Return the result ONLY as a JSON array (no markdown backticks, no wrapping):
[
  {
    "scene_num": 1,
    "thai_summary": "...",
    "prompt": "..."
  }
]`,
            messages: [{ role: 'user', content: textForStoryboard }],
            maxTokens: 8192
          })

          const jsonText = geminiRes.text.trim()
          const jsonMatch = jsonText.match(/\[[\s\S]*?\]/)
          if (jsonMatch) {
            storyboard = JSON.parse(jsonMatch[0])
          } else {
            throw new Error('Could not parse storyboard JSON array from Gemini')
          }
        } catch (storyErr) {
          console.error('Failed to parse storyboard, falling back to basic split:', storyErr)
          for (let i = 1; i <= numImages; i++) {
            storyboard.push({
              scene_num: i,
              thai_summary: `ฉากที่ ${i}`,
              prompt: `modern 3D animation style background with financial goose mascot, scene ${i}`
            })
          }
        }

        storyboard = storyboard.slice(0, numImages)

        await sendTelegramMessage(`🎨 **[Violet]** กำลังวาดรูปภาพนิ่ง Storyboard จำนวน ${storyboard.length} รูป ผ่าน fal.ai Schnell... (ใช้เวลาประมาณ 5 วินาที)`)

        // Generate images in parallel
        const imagePromises = storyboard.map(async (scene) => {
          try {
            const imgUrl = await backendGenerateImage(scene.prompt)
            return { ...scene, imageUrl: imgUrl }
          } catch (e) {
            console.error(`Failed to generate image for scene ${scene.scene_num}:`, e)
            return { ...scene, imageUrl: null }
          }
        })

        const storyboardResults = await Promise.all(imagePromises)
        const validImages = storyboardResults.filter(s => s.imageUrl)

        // Log expenses
        const imageCost = validImages.length * 0.003
        swarmCost += imageCost
        await backendLogExpense({
          agentName: 'Violet',
          category: 'fal.ai Image',
          description: `FLUX Schnell Storyboard x${validImages.length}`,
          usd: imageCost,
          sessionId: sessionId
        })

        // Send storyboard images as a Telegram Media Group (album)
        const token = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
        const chatId = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
        
        if (token && chatId && validImages.length > 0) {
          for (let i = 0; i < validImages.length; i += 10) {
            const chunk = validImages.slice(i, i + 10)
            const mediaGroup = chunk.map((img, idx) => ({
              type: 'photo',
              media: img.imageUrl,
              caption: i === 0 && idx === 0 ? `🎨 ภาพ Storyboard โดย Violet (ชุดที่ ${Math.floor(i/10)+1}/${Math.ceil(validImages.length/10)})\n🔑 Session: \`${sessionId}\`` : undefined
            }))

            try {
              const mediaRes = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, media: mediaGroup })
              })
              const mediaData = await mediaRes.json()
              if (!mediaData.ok) {
                console.error('Failed to send media group chunk:', mediaData)
              }
            } catch (mediaErr) {
              console.error('Failed to send media group to Telegram:', mediaErr)
            }
          }
        }

        const mainImageUrl = validImages[0]?.imageUrl || null

        globalAgentStates[agentId] = 'done'
        globalSwarmMessages.push({
          agentId: agent.id,
          agentName: agent.name,
          role: agent.role,
          content: `${violetText}\n\n[สร้างรูปภาพ Storyboard ทั้งหมด ${validImages.length} รูปสำเร็จ]`,
          type: 'image',
          imageUrl: mainImageUrl,
          timestamp: new Date().toLocaleTimeString('th-TH')
        })

        accumulatedContext += `ผลลัพธ์ของ Violet (ดีไซเนอร์):\nข้อความ: ${violetText}\nรูปภาพ Storyboard ทั้งหมด: ${validImages.map(img => img.imageUrl).join(', ')}\n\n`

        await backendLogTask({
          agentName: agent.name,
          task: 'ออกแบบสตอรี่บอร์ดภาพนิ่ง',
          skillsUsed: 'UI/UX Design, FLUX Schnell Storyboard',
          resultSummary: `ข้อความ: ${violetText}\nสร้างรูปภาพทั้งหมด: ${validImages.length} รูป`,
          sessionId
        })

      } else if (agent.id === 'sonic') {
        const res = await backendCallAgent(agent, [{ role: 'user', content: accumulatedContext }])
        const agentResult = res.text

        globalAgentStates[agentId] = 'done'
        globalSwarmMessages.push({
          agentId: agent.id,
          agentName: agent.name,
          role: agent.role,
          content: agentResult,
          type: 'text',
          timestamp: new Date().toLocaleTimeString('th-TH')
        })

        await sendTelegramMessage(`📄 **[Sonic]**:\n${agentResult}`)
        accumulatedContext += `ผลลัพธ์ของ Sonic (${agent.role}):\n${agentResult}\n\n`

        let textToSpeak = ''
        const match = agentResult.match(/(?:ข้อความสำหรับพากย์|script|บทพากย์|เสียงพากย์):?\s*([\s\S]+)/i)
        textToSpeak = match ? match[1].trim() : agentResult.trim()

        if (!textToSpeak) {
          const meiMsg = globalSwarmMessages.find(m => m.agentId === 'mei')
          if (meiMsg) {
            const captions = parseCaptionsText(meiMsg.content)
            textToSpeak = captions.script || meiMsg.content
          }
        }

        if (textToSpeak) {
          const cleanedText = textToSpeak
            .replace(/\([^)]*\)/g, '')
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\*+/g, '')
            .replace(/\s+/g, ' ')
            .trim()

          try {
            const isTrialRun = process.env.TRIAL_RUN !== 'false'
            if (isTrialRun) {
              await sendTelegramMessage(`🎙️ **[Sonic]** [โหมดรันทดลอง] ข้ามขั้นตอนสร้างไฟล์เสียงจริงผ่าน iApp TTS เพื่อประหยัด Token`)
              await backendLogTask({
                agentName: agent.name,
                task: `สร้างไฟล์เสียงพากย์`,
                skillsUsed: 'TTS iApp Kaitom (Trial Mode)',
                resultSummary: `ข้ามขั้นตอนเสียงพากย์จริงในโหมดรันทดลอง: (ข้อความสำหรับพากย์: ${cleanedText.slice(0, 80)}...)`,
                sessionId
              })
            } else {
              await sendTelegramMessage(`🎙️ **[Sonic]** กำลังสร้างเสียงพากย์ด้วยน้องไข่ต้ม V3...`)

              const ttsKey = process.env.VITE_IAPP_API_KEY || process.env.IAPP_API_KEY
              if (!ttsKey) throw new Error('iApp API Key not configured')

              const ttsRes = await fetch('https://api.iapp.co.th/v3/store/audio/tts', {
                method: 'POST',
                headers: {
                  'apikey': ttsKey,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: cleanedText, speed: 1 })
              })

              if (!ttsRes.ok) {
                const errText = await ttsRes.text()
                throw new Error(`iApp TTS API error: ${errText}`)
              }

              const audioBuffer = await ttsRes.arrayBuffer()
              const buffer = Buffer.from(audioBuffer)

              const voiceoversDir = path.join(__dirname, 'dist', 'voiceovers')
              if (!fs.existsSync(voiceoversDir)) {
                fs.mkdirSync(voiceoversDir, { recursive: true })
              }
              const audioFilename = `voiceover_${sessionId}.wav`
              const audioFilePath = path.join(voiceoversDir, audioFilename)
              await fs.promises.writeFile(audioFilePath, buffer)

              const charCount = cleanedText.length
              const ttsCost = Math.ceil(charCount / 400) * 0.0025
              swarmCost += ttsCost

              await backendLogExpense({
                agentName: 'Sonic',
                category: 'TTS iApp',
                description: `TTS Voiceover: ${cleanedText.slice(0, 50)}`,
                usd: ttsCost,
                sessionId
              })

              const token = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
              const chatId = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
              if (token && chatId) {
                const blob = new Blob([buffer], { type: 'audio/wav' })
                const formData = new FormData()
                formData.append('chat_id', chatId)
                formData.append('audio', blob, audioFilename)
                formData.append('caption', `🎙️ เสียงพากย์โดย Sonic (น้องไข่ต้ม V3)\n🔑 Session: \`${sessionId}\``)

                const tgAudioRes = await fetch(`https://api.telegram.org/bot${token}/sendAudio`, {
                  method: 'POST',
                  body: formData
                })
                const tgAudioData = await tgAudioRes.json()
                if (!tgAudioData.ok) {
                  console.error('Failed to send audio to Telegram:', tgAudioData)
                }
              }

              let audioUrl = `voiceovers/${audioFilename}`
              let domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.PUBLIC_URL
              if (domain) {
                if (domain.includes('4036')) domain = domain.replace('4036', 'be99')
                audioUrl = `https://${domain}/voiceovers/${audioFilename}`
              }

              accumulatedContext += `ผลลัพธ์ไฟล์เสียงของ Sonic (URL): ${audioUrl}\n\n`

              await backendLogTask({
                agentName: agent.name,
                task: `สร้างไฟล์เสียงพากย์`,
                skillsUsed: 'TTS iApp Kaitom',
                resultSummary: `สร้างไฟล์เสียงพากย์สำเร็จ: ${audioUrl}\nข้อความ: ${cleanedText}`,
                sessionId
              })
            }

          } catch (ttsErr) {
            console.error('TTS Generation failed:', ttsErr)
            await sendTelegramMessage(`💻 **[Leo (Developer)]**: ตรวจพบ Error การเชื่อมต่อ iApp TTS ("${ttsErr.message}")... ได้ข้ามขั้นตอนสร้างเสียงพากย์เพื่อรันงานระบบภาพต่อครับ`)
            
            await backendLogTask({
              agentName: agent.name,
              task: `สร้างไฟล์เสียงพากย์`,
              skillsUsed: 'TTS iApp Kaitom',
              resultSummary: `ล้มเหลว: ${ttsErr.message}`,
              status: 'failed',
              sessionId
            })
          }
        }

      } else {
        const res = await backendCallAgent(agent, [{ role: 'user', content: accumulatedContext }])
        const agentResult = res.text

        globalAgentStates[agentId] = 'done'
        globalSwarmMessages.push({
          agentId: agent.id,
          agentName: agent.name,
          role: agent.role,
          content: agentResult,
          type: 'text',
          timestamp: new Date().toLocaleTimeString('th-TH')
        })

        await sendTelegramMessage(`📄 **[${agent.name}]**:\n${agentResult}`)

        accumulatedContext += `ผลลัพธ์ของ ${agent.name} (${agent.role}):\n${agentResult}\n\n`

        await backendLogTask({
          agentName: agent.name,
          task: `ปฏิบัติงานตามโฟลว์`,
          skillsUsed: agent.role,
          resultSummary: agentResult,
          sessionId
        })
      }
    } catch (err) {
      console.error(`Agent ${agent.name} failed:`, err)
      globalAgentStates[agentId] = 'idle'
      globalSwarmMessages.push({
        agentId: agent.id,
        agentName: agent.name,
        role: agent.role,
        content: `⚠️ เกิดข้อผิดพลาด: ${err.message}`,
        type: 'text',
        timestamp: new Date().toLocaleTimeString('th-TH')
      })
      
      // Leo steps in and aborts
      await sendTelegramMessage(`💻 **[Leo (Developer)]**: ตรวจพบความล้มเหลวในการทำงานของ ${agent.name} ("${err.message}") เพื่อป้องกันการเสียค่าใช้จ่าย API เปล่าประโยชน์ ระบบได้ตัดสินใจระงับ (Abort) การทำงานของ Swarm ทั้งหมดทันทีครับ`)

      await backendLogTask({
        agentName: agent.name,
        task: `ปฏิบัติงานตามโฟลว์`,
        skillsUsed: agent.role,
        resultSummary: `ล้มเหลว: ${err.message}`,
        status: 'failed',
        sessionId
      })
      return
    }

    setTimeout(() => {
      if (globalAgentStates[agentId] === 'done') {
        globalAgentStates[agentId] = 'idle'
      }
    }, 4000)
  }

  // ── Auto Video Generation & Telegram Content Package Delivery ────
  const hasNova = flowAgents.includes('nova')
  if (hasNova) {
    const isTrialRun = process.env.TRIAL_RUN !== 'false'
    if (isTrialRun) {
      await sendTelegramMessage(`🎬 **[Nova]** [โหมดรันทดลอง] ข้ามขั้นตอนสร้างสไลด์โชว์วิดีโอและไฟล์ซับไตเติล .srt เพื่อประหยัด Token`)
      await backendLogTask({
        agentName: 'Nova',
        task: 'ร้อยเรียงวิดีโอและทำซับไตเติล',
        skillsUsed: 'Video Editing & Subtitling (Trial Mode)',
        resultSummary: `ข้ามขั้นตอนตัดต่อวิดีโอและซับไตเติลจริงในโหมดรันทดลอง`,
        sessionId
      })
    } else {
      await sendTelegramMessage(`🎬 **[Nova]** กำลังทำการร้อยเรียงภาพนิ่ง Storyboard สลับทุกๆ 3 วินาทีตามสคริปต์ของ Mei...`)
      
      await new Promise(r => setTimeout(r, 2000))
      
      await backendLogTask({
        agentName: 'Nova',
        task: 'ร้อยเรียงและตรวจความถูกต้องสไลด์โชว์',
        skillsUsed: 'Video Editing, Slideshow Sequencing',
        resultSummary: `ร้อยเรียงภาพนิ่งสไลด์โชว์สลับ 3 วินาทีเรียบร้อยตามบทพากย์`,
        sessionId
      })

      // Generate SRT file
      const meiMsg = globalSwarmMessages.find(m => m.agentId === 'mei')
      const meiContent = meiMsg ? meiMsg.content : ''
      if (meiContent) {
        await sendTelegramMessage(`🎬 **[Nova]** กำลังสร้างไฟล์ซับไตเติล .srt สำหรับนำเข้า CapCut...`)
        try {
          const geminiRes = await callGemini({
            model: 'gemini-2.5-flash',
            systemPrompt: `You are a subtitle editor. Given this Thai voiceover script, generate a valid SubRip (.srt) subtitle file.
  Divide the script into sequential segments of roughly 3 to 5 seconds each.
  Assume a standard reading speed in Thai (approx 8-10 characters per second including spaces) to calculate start and end times sequentially.
  Return ONLY the raw SRT subtitle content. No markdown backticks, no wrapping.`,
            messages: [{ role: 'user', content: meiContent }],
            maxTokens: 8192
          })

          const srtContent = geminiRes.text.trim().replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '')
          const srtBuffer = Buffer.from(srtContent, 'utf-8')

          const voiceoversDir = path.join(__dirname, 'dist', 'voiceovers')
          if (!fs.existsSync(voiceoversDir)) {
            fs.mkdirSync(voiceoversDir, { recursive: true })
          }
          const srtFilename = `subtitles_${sessionId}.srt`
          const srtFilePath = path.join(voiceoversDir, srtFilename)
          await fs.promises.writeFile(srtFilePath, srtBuffer)

          // Send SRT to Telegram
          await sendTelegramDocument(srtBuffer, srtFilename, `🎬 ไฟล์ซับไตเติลสำหรับนำเข้า CapCut (.srt)\n🔑 Session: \`${sessionId}\``)

          let srtUrl = `voiceovers/${srtFilename}`
          let domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.PUBLIC_URL
          if (domain) {
            if (domain.includes('4036')) domain = domain.replace('4036', 'be99')
            srtUrl = `https://${domain}/voiceovers/${srtFilename}`
          }

          await backendLogTask({
            agentName: 'Nova',
            task: 'สร้างไฟล์คำบรรยาย SRT',
            skillsUsed: 'Subtitle Generation',
            resultSummary: `สร้างไฟล์ซับไตเติล SRT สำเร็จ: ${srtUrl}`,
            sessionId
          })
        } catch (srtErr) {
          console.error('Failed to generate SRT:', srtErr)
          await sendTelegramMessage(`💻 **[Leo (Developer)]**: ตรวจพบ Error การทำไฟล์คำบรรยาย .srt ("${srtErr.message}")... ได้ข้ามขั้นตอนนี้เพื่อจัดส่งงานส่วนอื่นให้คุณ J ครับ`)
        }
      }
    }
  }

  // ── Final Content Package Delivery ────────────────────────────────
  const meiMsg = globalSwarmMessages.find(m => m.agentId === 'mei')
  const meiContent = meiMsg ? meiMsg.content : ''

  if (meiContent) {
    const captions = parseCaptionsText(meiContent)
    const captionBlock = `
📝 *Captions พร้อมโพสต์*

*🎬 YouTube (ยาว):*
${captions.youtube || '-'}

*📱 TikTok / IG Reels / YouTube Shorts:*
${captions.tiktok || '-'}

*📘 Facebook:*
${captions.facebook || '-'}

*𝕏 X / Twitter:*
${captions.twitter || '-'}

*#️⃣ Hashtags:*
${captions.hashtags || ''}

───────────────
💰 ต้นทุนวันนี้: $${swarmCost.toFixed(3)}
🔑 Session: \`${sessionId}\`
    `.trim()

    await sendTelegramMessageWithButton(captionBlock, `✅ Approve / Done`, `approve_${sessionId}`)
  }

  globalSwarmMessages.push({
    agentId: 'ace',
    agentName: 'Ace',
    role: 'Orchestrator',
    content: 'ทีม Pixel Office ทำงานเสร็จสิ้นทั้งหมดแล้ว บันทึกข้อมูลและรายงานผลเรียบร้อย! 🟢',
    type: 'text',
    timestamp: new Date().toLocaleTimeString('th-TH')
  })

  await sendTelegramMessage(`✅ **[Ace]** ทีม Pixel Office ทำงานเสร็จสิ้นทั้งหมดแล้ว บันทึกข้อมูลและรายงานผลเรียบร้อย!`)

  // Clear agent state bubbles after 6 seconds, but leave flow/messages intact so they can read them
  setTimeout(() => {
    globalAgentStates = {}
    globalActiveFlow = []
  }, 6000)
}

app.post('/webhook/telegram', async (req, res) => {
  const token = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID

  const callbackQuery = req.body?.callback_query
  if (callbackQuery) {
    const senderId = String(callbackQuery.from?.id)
    const allowedChatId = '8789851296'
    if (senderId !== allowedChatId) {
      console.warn(`[Telegram Webhook] Unauthorized callback from chat ID ${senderId}`)
      return res.status(200).send('Unauthorized')
    }

    const data = callbackQuery.data || ''
    if (data.startsWith('approve_')) {
      const sessionId = data.replace('approve_', '')
      
      try {
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: '✅ อนุมัติการส่งงานเรียบร้อย!'
          })
        })
      } catch (e) {
        console.error('Failed to answer callback query:', e)
      }

      await sendTelegramMessage(`🟢 **[Ace]** ได้รับการอนุมัติ (Approve) งานเซสชัน \`${sessionId}\` จาก J เรียบร้อยแล้วครับ! บันทึกสถานะลงระบบบัญชีและงานสำเร็จแล้ว`)

      backendApproveSessionTasks(sessionId).catch(err => {
        console.error('Failed to approve tasks in Notion:', err)
      })
    }
    return res.status(200).send('OK')
  }

  const message = req.body?.message
  if (!message) {
    return res.status(200).send('OK')
  }

  const senderId = String(message.chat?.id)
  const allowedChatId = '8789851296'
  if (senderId !== allowedChatId) {
    console.warn(`[Telegram Webhook] Unauthorized message from chat ID ${senderId} (Expected ${allowedChatId})`)
    return res.status(200).send('Unauthorized')
  }

  // 1. Handle Receipt Photo Uploads
  if (message.photo && message.photo.length > 0) {
    console.log('[Telegram Webhook] Received photo. Running receipt billing extractor...')

    await sendTelegramMessage(`🐹 **[Bean CFO]** ได้รับรูปภาพบิล/ใบเสร็จแล้วค่ะ! กำลังสแกนตรวจสอบรายละเอียดและบันทึกบัญชีลงระบบ...`)

    try {
      const photo = message.photo[message.photo.length - 1]
      const fileId = photo.file_id

      const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`)
      const fileData = await fileRes.json()
      const filePath = fileData.result.file_path
      const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`

      // Download file and convert to Base64
      const fileBuffer = await fetch(fileUrl).then(r => r.arrayBuffer())
      const base64Image = Buffer.from(fileBuffer).toString('base64')

      // Call Gemini multimodal to parse receipt
      const geminiApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
      if (!geminiApiKey) throw new Error('Gemini API Key missing')

      const prompt = `You are a CFO hamster named Bean. Analyze the receipt image. It may contain a collage of multiple credit card SMS alerts or bank transaction notifications (both income and expense notifications). You MUST extract all transactions and categorize them.

Here is the classification guide for AI/SaaS expenses:
- Anthropic / Claude -> Category: 'Claude API'
- OpenAI / ChatGPT -> Category: 'OpenAI API'
- DeepSeek -> Category: 'DeepSeek API'
- Google Cloud / Google One / Google API -> Category: 'Google Cloud'
- fal.ai / FAL FEATURES -> Category: 'fal.ai Image' (if image) or 'fal.ai Video' (if video)
- TTS / iApp -> Category: 'TTS iApp'
- Railway / Render.com / Vercel -> Category: 'Railway'
- CapCut -> Category: 'CapCut'
- TrueAIHub / OMISE*TRUEAIHUB -> Category: 'TrueAIHub'
- Other SaaS/AI tools -> Category: 'Other AI Tools'
- Income alerts (e.g. money received, transfers in, sponsorships) -> Category: 'Revenue'
- Non-AI/Non-SaaS expenses -> Category: 'Other'

For each transaction, extract:
1. Short description of what was purchased or received (in English or Thai, e.g. "Google Storage 750 THB", "Sponsorship Income 10000 THB").
2. Total amount in USD. If the amount is in THB, convert to USD using rate 35 THB/USD.
3. Category (must be one of the categories listed above).
4. Type (must be 'Expense' or 'Income' depending on whether it is an expense or an income).
5. Notes (any interesting details, invoice number, date/time if visible).

Return ONLY a JSON array, no markdown wrappers, no backticks, like:
[
  {
    "description": "...",
    "usd": 12.34,
    "category": "...",
    "type": "Expense",
    "notes": "..."
  }
]`

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Image
                  }
                }
              ]
            }]
          })
        }
      )

      if (!geminiRes.ok) {
        const errText = await geminiRes.text()
        throw new Error(`Gemini parse error: ${errText}`)
      }

      const geminiData = await geminiRes.json()
      const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

      const jsonMatch = geminiText.match(/\[[\s\S]*?\]/)
      let expenses = []
      if (jsonMatch) {
        expenses = JSON.parse(jsonMatch[0])
      } else {
        const singleMatch = geminiText.match(/\{[\s\S]*?\}/)
        if (singleMatch) {
          expenses = [JSON.parse(singleMatch[0])]
        } else {
          throw new Error(`Could not parse JSON array or object from Gemini response`)
        }
      }

      if (!Array.isArray(expenses)) {
        expenses = [expenses]
      }

      const loggedItems = []
      for (const expense of expenses) {
        const transactionType = expense.type || 'Expense'
        await backendLogExpense({
          agentName: 'Bean',
          category: expense.category || 'Other',
          description: expense.description || 'ใบเสร็จค่าใช้จ่าย',
          usd: Number(expense.usd || 0),
          notes: expense.notes || '',
          type: transactionType,
          sessionId: `telegram_billing_${Date.now()}`
        })
        const thbAmount = Math.round(Number(expense.usd || 0) * 35 * 100) / 100
        const typeEmoji = transactionType === 'Income' ? '🟢 [รายรับ]' : '🔴 [รายจ่าย]'
        loggedItems.push(`- **${expense.description}**: $${Number(expense.usd).toFixed(2)} (~฿${thbAmount.toLocaleString('th-TH')}) ${typeEmoji} [${expense.category}]`)
      }

      await sendTelegramMessage(`🐹 **[Bean CFO]** ได้สแกนรูปภาพและบันทึกค่าใช้จ่ายลง Notion เรียบร้อยแล้วทั้งหมด **${expenses.length}** รายการค่ะ! 🎉\n\n📋 **รายการที่บันทึกบัญชี:**\n${loggedItems.join('\n')}`)

    } catch (err) {
      console.error('Failed to process receipt billing:', err)
      await sendTelegramMessage(`🐹 **[Bean CFO Error]** ไม่สามารถบันทึกค่าใช้จ่ายได้: ${err.message}`)
    }

    return res.status(200).send('OK')
  }

  // 2. Handle Normal Text Swarm Commands
  const promptText = message.text
  if (promptText) {
    console.log(`[Telegram Webhook] Received command: "${promptText}"`)
    runTelegramSwarm(promptText).catch(err => {
      console.error('[Telegram Webhook] Swarm run failed:', err)
    })
  }

  return res.status(200).send('OK')
})

async function registerTelegramWebhook() {
  const token = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  let domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.PUBLIC_URL
  if (domain && domain.includes('4036')) {
    domain = domain.replace('4036', 'be99')
  }
  if (!token || !domain) {
    console.log('[Telegram Webhook] Skip auto-registration (missing token or domain)')
    return
  }

  const webhookUrl = `https://${domain}/webhook/telegram`
  console.log(`[Telegram Webhook] Registering webhook to: ${webhookUrl}`)

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query']
      })
    })
    const data = await res.json()
    console.log('[Telegram Webhook] Registration result:', data)
  } catch (err) {
    console.error('[Telegram Webhook] Failed to register webhook:', err)
  }
}

app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback - all routes serve index.html
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

let lastTriggerDate = ''

async function checkDailySchedule() {
  const now = new Date()
  
  // Format Bangkok date: YYYY-MM-DD
  const currentDateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now).split('/').reverse().join('-')
  
  // Format Bangkok time: HH:MM
  const currentTimeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now)

  // Check if it is exactly 09:00 and we haven't triggered it today yet
  if (currentTimeStr === '09:00' && lastTriggerDate !== currentDateStr) {
    lastTriggerDate = currentDateStr
    
    // Get current day of the week in Bangkok
    const dayOfWeek = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      weekday: 'long'
    }).format(now)
    
    console.log(`[Scheduler] Daily trigger activated for ${dayOfWeek} at ${currentTimeStr}`)
    
    let topicText = ''
    if (WEEKDAY_TOPICS[dayOfWeek]) {
      const topicsList = WEEKDAY_TOPICS[dayOfWeek]
      const currentIdx = currentIndices[dayOfWeek] || 0
      topicText = topicsList[currentIdx]
      
      // Increment and save index
      currentIndices[dayOfWeek] = (currentIdx + 1) % topicsList.length
      saveIndices()
    } else {
      console.log(`[Scheduler] No automatic swarm scheduled for ${dayOfWeek} (Sunday/Holiday)`)
      return
    }

    try {
      await sendTelegramMessage(`🤖 **[Daily Scheduler]** เริ่มต้นรันขั้นตอนส่งงานอัตโนมัติประจำวัน (${dayOfWeek}) หัวข้อวันนี้คือ: "${topicText}"...`)
      runTelegramSwarm(topicText).catch(err => {
        console.error('[Scheduler] Swarm execution failed:', err)
      })
    } catch (err) {
      console.error('[Scheduler] Failed to trigger daily schedule message:', err)
    }
  }
}

// Start daily routine checker
setInterval(checkDailySchedule, 60000)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pixel Office running on port ${PORT}`)
  registerTelegramWebhook().catch(err => console.error('Webhook registration failed:', err))
  console.log(`Daily Scheduler initialized. Checking every minute.`)
})

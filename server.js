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

// Health check (no auth)
app.get('/health', (req, res) => res.send('ok'))

// Basic Auth middleware
const SITE_USER = process.env.SITE_USER || 'admin'
const SITE_PASS = process.env.SITE_PASS || 'pixeloffice'

app.use((req, res, next) => {
  // Bypass Basic Auth for health and Telegram webhook
  if (req.path === '/health' || req.path === '/webhook/telegram') return next()

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

// ── Telegram Webhook & LLM Swarm Orchestration ────────────────────

async function sendTelegramMessage(text) {
  const token = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    })
  } catch (err) {
    console.error('Failed to send Telegram message:', err)
  }
}

async function sendTelegramPhoto(photoUrl, caption) {
  const token = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption,
        parse_mode: 'Markdown'
      })
    })
  } catch (err) {
    console.error('Failed to send Telegram photo:', err)
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

async function backendCallAgent(agent, history) {
  const provider = agent.provider ?? 'anthropic'
  const model = agent.model
  const systemPrompt = agent.systemPrompt

  try {
    switch (provider) {
      case 'openai': {
        const apiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY
        return await callOpenAICompatible({
          baseUrl: 'https://api.openai.com/v1',
          apiKey, model, systemPrompt, messages: history
        })
      }
      case 'deepseek': {
        const apiKey = process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY
        return await callOpenAICompatible({
          baseUrl: 'https://api.deepseek.com',
          apiKey, model, systemPrompt, messages: history
        })
      }
      case 'gemini': {
        return await callGemini({ model, systemPrompt, messages: history })
      }
      case 'anthropic':
      default: {
        return await callAnthropic({ model, systemPrompt, messages: history })
      }
    }
  } catch (err) {
    console.error(`Provider ${provider} failed on backend: ${err.message}. Falling back to Gemini...`)
    return await callGemini({ model: 'gemini-2.5-flash', systemPrompt, messages: history })
  }
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

  await sendTelegramMessage(`🤖 **[Ace]** ได้รับคำสั่งแล้วครับ: "${promptText}"\nกำลังวิเคราะห์แผนงานและลำดับขั้นตอน...`)

  let aceResponse
  try {
    const res = await backendCallAgent(ace, [{ role: 'user', content: promptText }])
    aceResponse = res.text
  } catch (err) {
    console.error('Ace failed:', err)
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
    await sendTelegramMessage(`💡 **[Ace]** ไม่มีการระบุขั้นตอน flow สำหรับ sub-agents ปฏิบัติงานเสร็จสิ้นแล้วครับ`)
    return
  }

  const flowAgents = flowMatch[1].split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  if (flowAgents.length === 0) {
    await sendTelegramMessage(`💡 **[Ace]** ลำดับขั้นตอนเป็นศูนย์ ปฏิบัติงานเสร็จสิ้นแล้วครับ`)
    return
  }

  await sendTelegramMessage(`⛓️ **ขั้นตอนการทำงาน (Flow):** ${flowAgents.join(' ➔ ')}`)

  let accumulatedContext = `คำสั่งต้นฉบับของผู้ใช้: "${promptText}"\n\nแผนการทำงานของ Ace:\n${aceResponse}\n\n`

  for (const agentId of flowAgents) {
    const agent = AGENTS.find(a => a.id === agentId)
    if (!agent) {
      await sendTelegramMessage(`⚠️ ไม่พบเอเจนต์ไอดี "${agentId}" ในระบบ`)
      continue
    }

    await sendTelegramMessage(`⏳ **[${agent.name}]** กำลังปฏิบัติงานในส่วนของตนเอง...`)

    try {
      if (agent.id === 'violet') {
        const res = await backendCallAgent(agent, [{ role: 'user', content: accumulatedContext }])
        const violetText = res.text

        await sendTelegramMessage(`🎨 **[Violet]**: ${violetText}`)

        const imgPromptMatch = violetText.match(/(?:image prompt|prompt|วาดรูป|รูปภาพ):?\s*(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9\s,._-]+))/i)
        const extractedPrompt = imgPromptMatch ? (imgPromptMatch[1] || imgPromptMatch[2] || imgPromptMatch[3] || '').trim() : ''

        if (extractedPrompt && extractedPrompt.length > 10) {
          await sendTelegramMessage(`🎨 **[Violet]** กำลังสร้างรูปภาพจาก prompt: "${extractedPrompt}"...`)
          const imageUrl = await backendGenerateImage(extractedPrompt)
          await sendTelegramPhoto(imageUrl, `🎨 รูปภาพโดย Violet\nPrompt: _${extractedPrompt}_`)

          accumulatedContext += `ผลลัพธ์ของ Violet (ดีไซเนอร์):\nข้อความ: ${violetText}\nรูปภาพที่ถูกสร้างขึ้น (URL): ${imageUrl}\n\n`

          await backendLogTask({
            agentName: agent.name,
            task: 'ออกแบบภาพ',
            skillsUsed: 'UI/UX Design, FLUX',
            resultSummary: `ข้อความ: ${violetText}\nรูปภาพ: ${imageUrl}`,
            sessionId
          })
        } else {
          accumulatedContext += `ผลลัพธ์ของ Violet (ดีไซเนอร์):\n${violetText}\n\n`
          await backendLogTask({
            agentName: agent.name,
            task: 'รีวิวดีไซน์',
            skillsUsed: 'UI/UX Design',
            resultSummary: violetText,
            sessionId
          })
        }
      } else {
        const res = await backendCallAgent(agent, [{ role: 'user', content: accumulatedContext }])
        const agentResult = res.text

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
      await sendTelegramMessage(`⚠️ **[${agent.name} Error]** เกิดข้อผิดพลาด: ${err.message}`)
    }
  }

  await sendTelegramMessage(`✅ **[Ace]** ทีม Pixel Office ทำงานเสร็จสิ้นทั้งหมดแล้ว บันทึกข้อมูลและรายงานผลเรียบร้อย!`)
}

app.post('/webhook/telegram', async (req, res) => {
  const chatId = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
  const message = req.body?.message
  if (!message || !message.text) {
    return res.status(200).send('OK')
  }

  const senderId = String(message.chat?.id)
  if (chatId && senderId !== String(chatId)) {
    console.warn(`[Telegram Webhook] Unauthorized message from chat ID ${senderId}`)
    return res.status(200).send('Unauthorized')
  }

  const promptText = message.text
  console.log(`[Telegram Webhook] Received command: "${promptText}"`)

  runTelegramSwarm(promptText).catch(err => {
    console.error('[Telegram Webhook] Swarm run failed:', err)
  })

  return res.status(200).send('OK')
})

async function registerTelegramWebhook() {
  const token = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.PUBLIC_URL
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
      body: JSON.stringify({ url: webhookUrl })
    })
    const data = await res.json()
    console.log('[Telegram Webhook] Registration result:', data)
  } catch (err) {
    console.error('[Telegram Webhook] Failed to register webhook:', err)
  }
}

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback - all routes serve index.html
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pixel Office running on port ${PORT}`)
  registerTelegramWebhook().catch(err => console.error('Webhook registration failed:', err))
})

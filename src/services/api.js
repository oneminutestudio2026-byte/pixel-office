import Anthropic from '@anthropic-ai/sdk'
import { recordCost, calcTokenCost } from './costTracker'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const GENERATE_IMAGE_TOOL = {
  name: 'generate_image',
  description: 'Generate an image using AI based on a text description. Use this whenever the user asks to create, draw, design, visualize, or show an image of something.',
  input_schema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Detailed image prompt in English describing visual content, style, lighting, and composition. Be specific and descriptive.',
      },
      caption: {
        type: 'string',
        description: 'Short Thai message to show the user explaining what was generated (1–2 sentences, friendly tone).',
      },
    },
    required: ['prompt', 'caption'],
  },
}

export async function generateImage(prompt) {
  const key = import.meta.env.VITE_FAL_KEY
  if (!key) throw new Error('กรุณาตั้งค่า VITE_FAL_KEY ใน .env')

  const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: 'landscape_4_3',
      num_inference_steps: 4,
      num_images: 1,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.status)
    throw new Error(`Image API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.images[0].url
}

// ── Coco ประเมินคุณภาพวิดีโอที่ Nova สร้าง ──────────────────────
export async function evaluateVideoQuality({ modelName, prompt, videoUrl, success, error }) {
  const cocoAgent = {
    model: 'claude-haiku-4-5-20251001',  // ใช้ Haiku ประหยัด token
    systemPrompt: 'คุณคือ Coco ผู้อำนวยการ ประเมินผลงาน AI อย่างตรงไปตรงมา',
  }
  const evalPrompt = success
    ? `Nova ใช้ ${modelName} สร้างวิดีโอจาก prompt: "${prompt}"\nวิดีโอ URL: ${videoUrl}\n\nประเมินโดย:\n1. ให้คะแนน 1-5 (5=ดีมาก)\n2. สั้นๆ ว่า prompt alignment เป็นยังไง\n3. แนะนำว่าควรเปลี่ยน model ไหม\nตอบในรูปแบบ: คะแนน:[X] | ความเห็น:[สั้นๆ] | แนะนำ:[เปลี่ยน/คงไว้]`
    : `Nova ใช้ ${modelName} แต่ล้มเหลว: ${error}\n\nให้คะแนน 1 และแนะนำว่าควรเปลี่ยน model ไหม\nตอบในรูปแบบ: คะแนน:1 | ความเห็น:[สั้นๆ] | แนะนำ:[เปลี่ยน/คงไว้]`

  try {
    const res = await client.messages.create({
      model: cocoAgent.model,
      max_tokens: 150,
      system: cocoAgent.systemPrompt,
      messages: [{ role: 'user', content: evalPrompt }],
    })
    const text  = res.content[0].text
    const score = parseInt(text.match(/คะแนน:(\d)/)?.[1] ?? '3')
    return { text, score }
  } catch {
    return { text: 'ประเมินไม่ได้', score: 3 }
  }
}

export async function callAgent(agent, history, extraSystemContext = '') {
  const messages = history.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }))

  const canDrawImages = agent.id === 'violet'
  const systemPrompt  = extraSystemContext
    ? `${agent.systemPrompt}\n\n${extraSystemContext}`
    : agent.systemPrompt

  const response = await client.messages.create({
    model: agent.model,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    ...(canDrawImages ? { tools: [GENERATE_IMAGE_TOOL] } : {}),
  })

  if (response.stop_reason === 'tool_use') {
    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (toolBlock?.name === 'generate_image') {
      const imageUrl = await generateImage(toolBlock.input.prompt)
      return {
        type: 'image',
        imageUrl,
        content: toolBlock.input.caption || 'สร้างภาพเสร็จแล้วค่ะ ✨',
        prompt: toolBlock.input.prompt,
      }
    }
  }

  // บันทึกค่าใช้จ่าย
  const usage = response.usage
  if (usage) {
    const usd = calcTokenCost(agent.model, usage.input_tokens ?? 0, usage.output_tokens ?? 0)
    recordCost({ category: 'claude-api', agentName: agent.name, description: agent.model, usd })
  }

  return response.content[0].text
}

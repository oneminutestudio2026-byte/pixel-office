import Anthropic from '@anthropic-ai/sdk'
import { recordCost, calcTokenCost } from './costTracker'

// ── Provider Clients ─────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

// ── OpenAI-compatible fetch (works for OpenAI + DeepSeek) ────────
async function callOpenAICompatible({ baseUrl, apiKey, model, systemPrompt, messages, maxTokens = 1024 }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.status)
    throw new Error(`API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  const usage = data.usage ?? {}
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  }
}

// ── Google Gemini REST API ───────────────────────────────────────
async function callGemini({ model, systemPrompt, messages, maxTokens = 1024 }) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('กรุณาตั้งค่า VITE_GEMINI_API_KEY ใน .env')

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text().catch(() => res.status)
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }
  const data = await res.json()
  const usage = data.usageMetadata ?? {}
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
  }
}

// ── Unified provider router ─────────────────────────────────────
async function callProvider(agent, messages, systemPrompt, tools = null) {
  const provider = agent.provider ?? 'anthropic'
  const model = agent.model

  try {
    switch (provider) {
      case 'openai': {
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY
        if (!apiKey) throw new Error('กรุณาตั้งค่า VITE_OPENAI_API_KEY ใน .env')
        const res = await callOpenAICompatible({
          baseUrl: 'https://api.openai.com/v1',
          apiKey, model, systemPrompt, messages,
        })
        return { ...res, actualModel: model, actualProvider: provider }
      }

      case 'deepseek': {
        const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY
        if (!apiKey) throw new Error('กรุณาตั้งค่า VITE_DEEPSEEK_API_KEY ใน .env')
        const res = await callOpenAICompatible({
          baseUrl: 'https://api.deepseek.com',
          apiKey, model, systemPrompt, messages,
        })
        return { ...res, actualModel: model, actualProvider: provider }
      }

      case 'gemini': {
        const res = await callGemini({ model, systemPrompt, messages })
        return { ...res, actualModel: model, actualProvider: provider }
      }

      case 'anthropic':
      default: {
        const response = await anthropic.messages.create({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages,
          ...(tools ? { tools } : {}),
        })

        // Handle tool use (Violet image gen)
        if (response.stop_reason === 'tool_use') {
          const toolBlock = response.content.find(b => b.type === 'tool_use')
          if (toolBlock?.name === 'generate_image') {
            const imageUrl = await generateImage(toolBlock.input.prompt)
            return {
              type: 'image',
              imageUrl,
              text: toolBlock.input.caption || 'สร้างภาพเสร็จแล้วค่ะ',
              inputTokens: response.usage?.input_tokens ?? 0,
              outputTokens: response.usage?.output_tokens ?? 0,
              actualModel: model,
              actualProvider: provider,
            }
          }
        }

        return {
          text: response.content[0].text,
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
          actualModel: model,
          actualProvider: provider,
        }
      }
    }
  } catch (err) {
    if (provider !== 'anthropic') {
      console.warn(`Provider ${provider} (${model}) failed: ${err.message}. Falling back to Anthropic...`)
      const fallbackModel = (agent.id === 'ace' || model === 'gpt-5' || model === 'gpt-4o')
        ? 'claude-sonnet-4-5'
        : 'claude-haiku-4-5-20251001'
      const fallbackAgent = { ...agent, provider: 'anthropic', model: fallbackModel }
      return callProvider(fallbackAgent, messages, systemPrompt, tools)
    }
    throw err
  }
}

// ── Image generation (fal.ai) ────────────────────────────────────
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
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: 'landscape_4_3', num_inference_steps: 4, num_images: 1 }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.status)
    throw new Error(`Image API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.images[0].url
}

// ── Coco ประเมินคุณภาพวิดีโอ ─────────────────────────────────────
export async function evaluateVideoQuality({ modelName, prompt, videoUrl, success, error }) {
  const evalPrompt = success
    ? `Nova ใช้ ${modelName} สร้างวิดีโอจาก prompt: "${prompt}"\nวิดีโอ URL: ${videoUrl}\n\nประเมินโดย:\n1. ให้คะแนน 1-5 (5=ดีมาก)\n2. สั้นๆ ว่า prompt alignment เป็นยังไง\n3. แนะนำว่าควรเปลี่ยน model ไหม\nตอบในรูปแบบ: คะแนน:[X] | ความเห็น:[สั้นๆ] | แนะนำ:[เปลี่ยน/คงไว้]`
    : `Nova ใช้ ${modelName} แต่ล้มเหลว: ${error}\n\nให้คะแนน 1 และแนะนำว่าควรเปลี่ยน model ไหม\nตอบในรูปแบบ: คะแนน:1 | ความเห็น:[สั้นๆ] | แนะนำ:[เปลี่ยน/คงไว้]`

  try {
    const result = await callProvider(
      { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
      [{ role: 'user', content: evalPrompt }],
      'คุณคือ Coco ผู้อำนวยการ ประเมินผลงาน AI อย่างตรงไปตรงมา',
    )
    const score = parseInt(result.text.match(/คะแนน:(\d)/)?.[1] ?? '3')
    return { text: result.text, score }
  } catch {
    return { text: 'ประเมินไม่ได้', score: 3 }
  }
}

// ── Main: callAgent (public API) ─────────────────────────────────
export async function callAgent(agent, history, extraSystemContext = '') {
  const messages = history.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }))

  const canDrawImages = agent.id === 'violet' && (agent.provider ?? 'anthropic') === 'anthropic'
  const systemPrompt = extraSystemContext
    ? `${agent.systemPrompt}\n\n${extraSystemContext}`
    : agent.systemPrompt

  const result = await callProvider(
    agent, messages, systemPrompt,
    canDrawImages ? [GENERATE_IMAGE_TOOL] : null,
  )

  const usedModel = result.actualModel || agent.model
  const usedProvider = result.actualProvider || agent.provider || 'anthropic'

  // Handle image response from Violet
  if (result.type === 'image') {
    const usd = calcTokenCost(usedModel, result.inputTokens, result.outputTokens)
    recordCost({ category: `${usedProvider}-api`, agentName: agent.name, description: usedModel, usd })
    return { type: 'image', imageUrl: result.imageUrl, content: result.text, prompt: '' }
  }

  // Record cost
  const usd = calcTokenCost(usedModel, result.inputTokens, result.outputTokens)
  recordCost({ category: `${usedProvider}-api`, agentName: agent.name, description: usedModel, usd })

  return result.text
}

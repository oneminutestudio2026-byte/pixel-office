// ── Video Generation Service — A/B: Seedance 2 vs WAN 2.7 ─────────
// Nova agent ใช้ไฟล์นี้สลับ model + track cost อัตโนมัติ

const FAL_KEY = import.meta.env.VITE_FAL_KEY

// ── Model config (verified fal.ai IDs) ───────────────────────────
export const VIDEO_MODELS = {
  'seedance-2': {
    id:          'bytedance/seedance-2.0/text-to-video',   // ✅ verified
    idImg:       'bytedance/seedance-2.0/image-to-video',  // ✅ ถ้ามีรูป
    name:        'Seedance 2',
    costPerSec:  0.06,
    maxDuration: 10,
    quality:     'high',
  },
  'wan-2.7': {
    id:          'fal-ai/wan/v2.7/text-to-video',          // text-to-video
    idImg:       'fal-ai/wan/v2.7/image-to-video',         // image-to-video
    name:        'WAN 2.7',
    costPerSec:  0.05,
    maxDuration: 10,
    quality:     'good',
  },
}

// ── สถิติ performance ในหน่วยความจำ (reset เมื่อ refresh) ─────────
const _stats = {
  'seedance-2': { attempts: 0, successes: 0, totalCost: 0, scores: [] },
  'wan-2.7':    { attempts: 0, successes: 0, totalCost: 0, scores: [] },
}

// ── เลือก model ที่จะใช้ (สลับ A/B อัตโนมัติ) ─────────────────────
export function pickModel() {
  const s2  = _stats['seedance-2']
  const wan = _stats['wan-2.7']

  // ถ้าตัวใดตัวหนึ่งยังไม่มีข้อมูล → ลองทั้งคู่ก่อน
  if (s2.attempts === 0)  return 'seedance-2'
  if (wan.attempts === 0) return 'wan-2.7'

  // drop model ถ้า success rate < 50% ใน 5 ครั้งหลัง
  const s2Rate  = s2.successes  / s2.attempts
  const wanRate = wan.successes / wan.attempts
  if (s2Rate  < 0.5 && s2.attempts  >= 5) return 'wan-2.7'
  if (wanRate < 0.5 && wan.attempts >= 5) return 'seedance-2'

  // สลับทีละครั้งตาม total attempts (round-robin)
  return (s2.attempts <= wan.attempts) ? 'seedance-2' : 'wan-2.7'
}

// ── สรุป stats ปัจจุบัน ────────────────────────────────────────────
export function getModelStats() {
  return Object.entries(_stats).map(([modelKey, s]) => {
    const model   = VIDEO_MODELS[modelKey]
    const avgScore = s.scores.length > 0
      ? (s.scores.reduce((a, b) => a + b, 0) / s.scores.length).toFixed(1)
      : 'ยังไม่มีข้อมูล'
    const successRate = s.attempts > 0
      ? `${Math.round((s.successes / s.attempts) * 100)}%`
      : '-'
    const isDropped = s.attempts >= 5 && (s.successes / s.attempts) < 0.5
    return {
      modelKey, name: model.name,
      attempts: s.attempts, successRate,
      totalCost: `$${s.totalCost.toFixed(3)}`,
      avgScore, isDropped,
    }
  })
}

// ── เพิ่ม quality score จาก Coco ─────────────────────────────────
export function recordScore(modelKey, score) {
  if (!_stats[modelKey]) return
  _stats[modelKey].scores.push(score)
  // เก็บแค่ 10 ล่าสุด
  if (_stats[modelKey].scores.length > 10) {
    _stats[modelKey].scores.shift()
  }
}

// ── สร้างวิดีโอจาก fal.ai ────────────────────────────────────────
async function falGenerate(modelId, payload) {
  if (!FAL_KEY) throw new Error('VITE_FAL_KEY ไม่ได้ตั้งค่าใน .env')

  const hdrs = { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' }

  // Submit job — fal.ai คืน status_url และ response_url มาให้
  const submitRes  = await fetch(`https://queue.fal.run/${modelId}`, {
    method: 'POST', headers: hdrs, body: JSON.stringify(payload),
  })
  const submitText = await submitRes.text()
  if (!submitRes.ok || !submitText)
    throw new Error(`fal.ai submit ${submitRes.status}: ${submitText || 'empty response'}`)

  const submitData = JSON.parse(submitText)
  const statusUrl  = submitData.status_url
  const responseUrl = submitData.response_url

  if (!statusUrl) throw new Error(`ไม่ได้รับ status_url: ${submitText}`)

  // Poll status (max 5 min = 60 × 5s)
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const statusRes  = await fetch(statusUrl, { headers: hdrs })
    const statusText = await statusRes.text()
    if (!statusText) continue

    const status = JSON.parse(statusText)
    if (status.status === 'COMPLETED') {
      // ดึงผลลัพธ์จาก response_url
      if (responseUrl) {
        const resultRes  = await fetch(responseUrl, { headers: hdrs })
        const resultText = await resultRes.text()
        return JSON.parse(resultText)
      }
      return status.output ?? status
    }
    if (status.status === 'FAILED') throw new Error(status.error ?? 'Generation failed')
  }
  throw new Error('Timeout: video generation ใช้เวลานานเกินไป (>5 นาที)')
}

// ── Main: สร้างวิดีโอ พร้อม A/B + cost tracking ─────────────────
export async function generateVideo({ prompt, imageUrl = null, durationSec = 5, forceModel = null }) {
  const modelKey = forceModel ?? pickModel()
  const model    = VIDEO_MODELS[modelKey]
  _stats[modelKey].attempts++

  // ลบข้อความ/subtitle ออกจากคลิปเสมอ
  const cleanPrompt = `${prompt}, cinematic, smooth motion, no text, no subtitles, no captions, no watermarks, no overlays`

  const activeId = imageUrl ? (model.idImg ?? model.id) : model.id
  const payload  = imageUrl
    ? { image_url: imageUrl, prompt: cleanPrompt, duration: durationSec }
    : { prompt: cleanPrompt, duration: durationSec }

  let videoUrl = null
  let success  = false
  let error    = null

  try {
    const result = await falGenerate(activeId, payload)
    videoUrl = result?.video?.url ?? result?.url ?? null
    if (!videoUrl) throw new Error('ไม่ได้รับ URL วิดีโอกลับมา')
    success = true
    _stats[modelKey].successes++
  } catch (e) {
    error = e.message
  }

  // คำนวณต้นทุน
  const cost = model.costPerSec * durationSec
  _stats[modelKey].totalCost += success ? cost : 0

  return {
    modelKey, modelName: model.name,
    videoUrl, success, error,
    cost: success ? cost : 0,
    costStr: success ? `$${cost.toFixed(3)}` : '$0',
    durationSec, prompt,
    stats: getModelStats(),
  }
}

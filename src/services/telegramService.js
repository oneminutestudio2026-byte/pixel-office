// ── Telegram Bot Service — ส่ง Content Package ───────────────────
const TOKEN   = import.meta.env.VITE_TELEGRAM_BOT_TOKEN
const CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID
const BASE    = `https://api.telegram.org/bot${TOKEN}`

// ── helper: ส่ง request ──────────────────────────────────────────
async function tg(method, body) {
  if (!TOKEN || !CHAT_ID) {
    console.warn('[Telegram] ยังไม่ตั้งค่า VITE_TELEGRAM_BOT_TOKEN / VITE_TELEGRAM_CHAT_ID')
    return null
  }
  try {
    const res = await fetch(`${BASE}/${method}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: CHAT_ID, ...body }),
    })
    return await res.json()
  } catch (e) {
    console.warn('[Telegram] error', e)
    return null
  }
}

// ── ส่งข้อความธรรมดา ─────────────────────────────────────────────
export async function sendMessage(text) {
  return tg('sendMessage', { text, parse_mode: 'Markdown' })
}

// ── ส่งรูปภาพ + caption ──────────────────────────────────────────
export async function sendPhoto(photoUrl, caption = '') {
  return tg('sendPhoto', { photo: photoUrl, caption, parse_mode: 'Markdown' })
}

// ── ส่งวิดีโอ + caption ──────────────────────────────────────────
export async function sendVideo(videoUrl, caption = '') {
  return tg('sendVideo', { video: videoUrl, caption, parse_mode: 'Markdown' })
}

// ── ส่ง Content Package ทั้งหมดในครั้งเดียว ──────────────────────
export async function sendContentPackage({
  topic,
  videoUrl,
  thumbnailUrl,
  audioUrl,
  captions,       // { youtube, tiktok, instagram, facebook, twitter }
  hashtags,
  cocoScore,
  totalCost,
  sessionId,
}) {
  const date = new Date().toLocaleDateString('th-TH', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // 1️⃣ ส่งวิดีโอก่อน
  if (videoUrl) {
    await sendVideo(videoUrl, `🦢 *ห่านการเงิน* — ${topic}\n📅 ${date}`)
  }

  // 2️⃣ ส่ง thumbnail
  if (thumbnailUrl) {
    await sendPhoto(thumbnailUrl, '🖼️ Thumbnail')
  }

  // 3️⃣ ส่ง captions ทุก platform
  const captionBlock = `
📝 *Captions พร้อมโพสต์*

*🎬 YouTube (ยาว):*
${captions?.youtube ?? '-'}

*📱 TikTok / IG Reels / YouTube Shorts:*
${captions?.tiktok ?? '-'}

*📘 Facebook:*
${captions?.facebook ?? '-'}

*𝕏 X / Twitter:*
${captions?.twitter ?? '-'}

*#️⃣ Hashtags:*
${hashtags ?? ''}

───────────────
⭐ Coco ประเมิน: ${cocoScore ?? '-'}/5
💰 ต้นทุนวันนี้: $${totalCost ?? '0.00'}
🔑 Session: \`${sessionId ?? '-'}\`
  `.trim()

  await sendMessage(captionBlock)

  // 4️⃣ ส่งลิงก์เสียงถ้ามี
  if (audioUrl) {
    await sendMessage(`🎙️ *เสียงพากย์:* ${audioUrl}`)
  }

  console.log('[Telegram] Content package ส่งเสร็จแล้ว ✅')
}

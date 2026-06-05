// ── Notion Service — Agent Logs ───────────────────────────────────
const DB_ID  = import.meta.env.VITE_NOTION_DATABASE_ID || '4b58c4384a6148bf9894f91f602129ea'
const BASE   = '/api/notion'
const hdrs   = () => ({
  'Content-Type':   'application/json',
})

// ── บันทึกงานที่เสร็จลง Notion ───────────────────────────────────
export async function logTask({ agentName, task, skillsUsed, resultSummary, status = 'completed', sessionId }) {
  try {
    await fetch(`${BASE}/pages`, {
      method:  'POST',
      headers: hdrs(),
      body: JSON.stringify({
        parent: { database_id: DB_ID },
        properties: {
          Name:             { title:     [{ text: { content: `${agentName} · ${task.slice(0, 50)}` } }] },
          'Agent Name':     { rich_text: [{ text: { content: agentName } }] },
          Task:             { rich_text: [{ text: { content: task } }] },
          'Skills Used':    { rich_text: [{ text: { content: skillsUsed } }] },
          'Result Summary': { rich_text: [{ text: { content: resultSummary.slice(0, 500) } }] },
          Status:           { select:    { name: status } },
          Timestamp:        { date:      { start: new Date().toISOString() } },
          'Session ID':     { rich_text: [{ text: { content: sessionId } }] },
        },
      }),
    })
  } catch (e) {
    console.warn('[Notion] write error', e)
  }
}

// ── ดึง log ล่าสุด (ของ agent คนเดียว หรือทั้งทีม) ──────────────
export async function getRecentLogs({ agentName = null, limit = 5 } = {}) {
  try {
    const body = {
      sorts:     [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: limit,
    }
    if (agentName) {
      body.filter = { property: 'Agent Name', rich_text: { contains: agentName } }
    }
    const res  = await fetch(`${BASE}/databases/${DB_ID}/query`, {
      method:  'POST',
      headers: hdrs(),
      body:    JSON.stringify(body),
    })
    const data = await res.json()
    return (data.results || []).map(p => ({
      agentName:     p.properties['Agent Name']?.rich_text?.[0]?.plain_text     ?? '',
      task:          p.properties['Task']?.rich_text?.[0]?.plain_text           ?? '',
      skillsUsed:    p.properties['Skills Used']?.rich_text?.[0]?.plain_text    ?? '',
      resultSummary: p.properties['Result Summary']?.rich_text?.[0]?.plain_text ?? '',
      status:        p.properties['Status']?.select?.name                       ?? '',
      timestamp:     p.properties['Timestamp']?.date?.start                     ?? '',
    }))
  } catch (e) {
    console.warn('[Notion] read error', e)
    return []
  }
}

// ── สร้าง context string สำหรับ upskill ──────────────────────────
export function buildUpskillContext(agentName, ownLogs, teamLogs) {
  const parts = []

  if (ownLogs.length > 0) {
    const lines = ownLogs
      .map(l => `  • ${l.task.slice(0, 50)} → ${l.resultSummary.slice(0, 80)} [ใช้: ${l.skillsUsed}]`)
      .join('\n')
    parts.push(`[ประสบการณ์เดิมของคุณ (${agentName}) — ใช้เป็น upskill]\n${lines}`)
  }

  const otherLogs = teamLogs.filter(l => l.agentName !== agentName)
  if (otherLogs.length > 0) {
    const lines = otherLogs
      .map(l => `  • ${l.agentName}: ${l.task.slice(0, 40)} → ${l.resultSummary.slice(0, 60)} [${l.status}]`)
      .join('\n')
    parts.push(`[งานล่าสุดของเพื่อนร่วมทีม — รู้ว่าใครทำอะไรไปแล้ว]\n${lines}`)
  }

  return parts.join('\n\n')
}

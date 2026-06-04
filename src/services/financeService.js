// ── Finance Service — Bean CFO ────────────────────────────────────
// บันทึกทุกค่าใช้จ่ายลง Notion Finance Ledger

const NOTION_KEY = import.meta.env.VITE_NOTION_API_KEY
const FINANCE_DB = '0c1477ded338419bb19a0ea239d758fd'
const BASE       = 'https://api.notion.com/v1'
const USD_TO_THB = 35

const hdrs = () => ({
  'Authorization':  `Bearer ${NOTION_KEY}`,
  'Content-Type':   'application/json',
  'Notion-Version': '2022-06-28',
})

// ── Category map ─────────────────────────────────────────────────
const CATEGORY_MAP = {
  'claude-api':          'Claude API',
  'fal-image':           'fal.ai Image',
  'fal-video-seedance-2':'fal.ai Video',
  'fal-video-wan-2.7':   'fal.ai Video',
  'iapp-tts':            'TTS iApp',
  'railway':             'Railway',
}

// ── บันทึกค่าใช้จ่ายลง Notion ────────────────────────────────────
export async function logExpense({
  agentName,
  category,      // 'claude-api' | 'fal-image' | 'fal-video-*' | 'iapp-tts' | 'railway'
  description,
  usd,
  project = 'ห่านการเงิน',
  sessionId = '',
  notes = '',
}) {
  if (!NOTION_KEY || !usd || usd <= 0) return

  const notionCategory = CATEGORY_MAP[category] ?? 'Other'
  const thb = Math.round(usd * USD_TO_THB * 100) / 100

  try {
    await fetch(`${BASE}/pages`, {
      method:  'POST',
      headers: hdrs(),
      body: JSON.stringify({
        parent: { database_id: FINANCE_DB },
        properties: {
          Name:            { title:     [{ text: { content: `${agentName} · ${description.slice(0, 50)}` } }] },
          Date:            { date:      { start: new Date().toISOString() } },
          Project:         { select:    { name: project } },
          Category:        { select:    { name: notionCategory } },
          Agent:           { rich_text: [{ text: { content: agentName } }] },
          Description:     { rich_text: [{ text: { content: description } }] },
          'Amount USD':    { number: usd },
          'Amount THB':    { number: thb },
          Status:          { select:    { name: 'recorded' } },
          'Session ID':    { rich_text: [{ text: { content: sessionId } }] },
          Notes:           { rich_text: [{ text: { content: notes } }] },
        },
      }),
    })
  } catch (e) {
    console.warn('[Finance] log error', e)
  }
}

// ── ดึงสรุปรายจ่ายจาก Notion ─────────────────────────────────────
export async function getFinanceSummary(project = null) {
  if (!NOTION_KEY) return null
  try {
    const body = {
      sorts:     [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 50,
    }
    if (project) {
      body.filter = { property: 'Project', select: { equals: project } }
    }
    const res  = await fetch(`${BASE}/databases/${FINANCE_DB}/query`, {
      method: 'POST', headers: hdrs(), body: JSON.stringify(body),
    })
    const data = await res.json()
    const rows = (data.results ?? []).map(p => ({
      name:        p.properties['Name']?.title?.[0]?.plain_text ?? '',
      date:        p.properties['Date']?.date?.start ?? '',
      project:     p.properties['Project']?.select?.name ?? '',
      category:    p.properties['Category']?.select?.name ?? '',
      agent:       p.properties['Agent']?.rich_text?.[0]?.plain_text ?? '',
      description: p.properties['Description']?.rich_text?.[0]?.plain_text ?? '',
      usd:         p.properties['Amount USD']?.number ?? 0,
      thb:         p.properties['Amount THB']?.number ?? 0,
    }))

    // สรุปตาม category
    const byCategory = {}
    const byProject  = {}
    let totalUSD = 0

    for (const r of rows) {
      byCategory[r.category] = (byCategory[r.category] ?? 0) + r.usd
      byProject[r.project]   = (byProject[r.project]   ?? 0) + r.usd
      totalUSD += r.usd
    }

    return {
      totalUSD:    parseFloat(totalUSD.toFixed(4)),
      totalTHB:    Math.round(totalUSD * USD_TO_THB),
      byCategory,
      byProject,
      recentRows:  rows.slice(0, 10),
      count:       rows.length,
    }
  } catch (e) {
    console.warn('[Finance] summary error', e)
    return null
  }
}

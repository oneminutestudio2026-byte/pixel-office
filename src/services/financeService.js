// ── Finance Service — Bean CFO ────────────────────────────────────
// บันทึกทุกค่าใช้จ่ายลง Notion Finance Ledger

const FINANCE_DB = '0c1477ded338419bb19a0ea239d758fd'
const BASE       = '/api/notion'
const USD_TO_THB = 35

const hdrs = () => ({
  'Content-Type':   'application/json',
})

// ── Category map ─────────────────────────────────────────────────
const CATEGORY_MAP = {
  'claude-api':          'Claude API',
  'anthropic-api':       'Claude API',
  'deepseek-api':        'DeepSeek API',
  'gemini-api':          'Gemini API',
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
  if (!usd || usd <= 0) return

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
      type:        p.properties['Type']?.select?.name ?? 'Expense',
    }))

    // สรุปตาม category
    const byCategory = {}
    const byProject  = {}
    let totalIncomeUSD = 0
    let totalExpenseUSD = 0

    for (const r of rows) {
      if (r.type === 'Income') {
        totalIncomeUSD += r.usd
      } else {
        totalExpenseUSD += r.usd
        byCategory[r.category] = (byCategory[r.category] ?? 0) + r.usd
        byProject[r.project]   = (byProject[r.project]   ?? 0) + r.usd
      }
    }

    const netUSD = totalIncomeUSD - totalExpenseUSD

    return {
      totalUSD:        parseFloat(totalExpenseUSD.toFixed(4)),
      totalTHB:        Math.round(totalExpenseUSD * USD_TO_THB),
      totalIncomeUSD:  parseFloat(totalIncomeUSD.toFixed(4)),
      totalIncomeTHB:  Math.round(totalIncomeUSD * USD_TO_THB),
      netUSD:          parseFloat(netUSD.toFixed(4)),
      netTHB:          Math.round(netUSD * USD_TO_THB),
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

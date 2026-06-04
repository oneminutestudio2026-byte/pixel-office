// ── Cost Tracker — บัญชีค่าใช้จ่าย Pixel Office ──────────────────

// ── ราคา API (USD) ────────────────────────────────────────────────
export const RATES = {
  'claude-sonnet-4-5':       { input: 3.00,  output: 15.00,  unit: 'per MTok' },
  'claude-haiku-4-5-20251001':{ input: 0.80,  output: 4.00,   unit: 'per MTok' },
  'fal-image':               { cost: 0.005,  unit: 'per image' },
  'fal-video-seedance':      { cost: 0.060,  unit: 'per second' },
  'fal-video-wan':           { cost: 0.050,  unit: 'per second' },
  'iapp-tts':                { cost: 0.0025, unit: 'per 400 chars' },
  'notion-api':              { cost: 0,      unit: 'free' },
}

// ── Budget ตั้งต้น (USD) — แก้ได้ ──────────────────────────────────
const MONTHLY_BUDGET_USD = 30  // ~1,050 บาท/เดือน

// ── In-memory ledger ─────────────────────────────────────────────
const _ledger = []   // { ts, category, agentName, description, usd }

// ── บันทึกค่าใช้จ่าย (in-memory + Notion via Bean) ─────────────────
export function recordCost({ category, agentName, description, usd, project, sessionId }) {
  if (!usd || usd <= 0) return
  _ledger.push({
    ts: new Date().toISOString(),
    category, agentName, description,
    usd: parseFloat(usd.toFixed(6)),
  })
  // Log to Notion Finance DB (async, fire & forget)
  import('./financeService.js').then(({ logExpense }) => {
    logExpense({ agentName, category, description, usd, project, sessionId })
  }).catch(() => {})
}

// ── คำนวณจาก token usage ─────────────────────────────────────────
export function calcTokenCost(model, inputTokens, outputTokens) {
  const rate = RATES[model]
  if (!rate || rate.unit !== 'per MTok') return 0
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000
}

// ── สรุปยอด ───────────────────────────────────────────────────────
export function getSummary() {
  const total = _ledger.reduce((s, e) => s + e.usd, 0)
  const byCategory = {}
  const byAgent    = {}

  for (const e of _ledger) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.usd
    byAgent[e.agentName]   = (byAgent[e.agentName]   ?? 0) + e.usd
  }

  return {
    budget:    MONTHLY_BUDGET_USD,
    spent:     parseFloat(total.toFixed(4)),
    remaining: parseFloat((MONTHLY_BUDGET_USD - total).toFixed(4)),
    pctUsed:   Math.min(100, Math.round((total / MONTHLY_BUDGET_USD) * 100)),
    byCategory,
    byAgent,
    entries:   [..._ledger].reverse().slice(0, 20),  // 20 รายการล่าสุด
    budgetOK:  total < MONTHLY_BUDGET_USD * 0.9,
  }
}

// ── แปลง USD → บาท (rate คร่าวๆ) ────────────────────────────────
export function toBaht(usd) {
  return Math.round(usd * 35)
}

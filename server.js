import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

// Health check (no auth)
app.get('/health', (req, res) => res.send('ok'))

// Basic Auth middleware
const SITE_USER = process.env.SITE_USER || 'admin'
const SITE_PASS = process.env.SITE_PASS || 'pixeloffice'

app.use((req, res, next) => {
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

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback - all routes serve index.html
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pixel Office running on port ${PORT}`)
})

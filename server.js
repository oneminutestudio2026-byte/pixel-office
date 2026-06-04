import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

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

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback - all routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pixel Office running on port ${PORT}`)
})

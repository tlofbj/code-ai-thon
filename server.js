import express from 'express'
import cors from 'cors'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let db = null

async function initDb() {
  db = await open({
    filename: path.join(__dirname, 'donatematch.db'),
    driver: sqlite3.Database
  })

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)
}

const app = express()

app.use(cors())
app.use(express.json())

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  const { phone, code } = req.body

  try {
    let user = await db.get('SELECT * FROM users WHERE phone_number = ?', phone)

    if (!user) {
      const result = await db.run('INSERT INTO users (phone_number) VALUES (?)', phone)
      user = await db.get('SELECT * FROM users WHERE id = ?', result.lastID)
    }

    res.json({ userId: user.id, phone: user.phone_number })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Donations endpoints
app.get('/api/donations', async (req, res) => {
  try {
    const donations = await db.all('SELECT * FROM donations ORDER BY created_at DESC')
    res.json(donations)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/donations', async (req, res) => {
  const { userId, items } = req.body

  try {
    for (const item of items) {
      await db.run(
        'INSERT INTO donations (user_id, name, quantity) VALUES (?, ?, ?)',
        [userId, item.name, item.quantity]
      )
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/user/donations', async (req, res) => {
  const { userId } = req.query

  try {
    const donations = await db.all(
      'SELECT * FROM donations WHERE user_id = ? ORDER BY created_at DESC',
      userId
    )
    res.json(donations)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Requests endpoints
app.get('/api/requests', async (req, res) => {
  try {
    const requests = await db.all('SELECT * FROM requests ORDER BY created_at DESC')
    res.json(requests)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/requests', async (req, res) => {
  const { userId, items } = req.body

  try {
    for (const item of items) {
      await db.run(
        'INSERT INTO requests (user_id, name, quantity) VALUES (?, ?, ?)',
        [userId, item.name, item.quantity]
      )
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/user/requests', async (req, res) => {
  const { userId } = req.query

  try {
    const requests = await db.all(
      'SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC',
      userId
    )
    res.json(requests)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Initialize and start
async function start() {
  await initDb()
  const PORT = process.env.PORT || 5001
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

start().catch(console.error)

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_VERSION = '2026-04-28-offer-queue-v1'
const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant'

/** Override with SQLITE_PATH=/absolute/path/to/db.sqlite when debugging DB mismatches. */
const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, 'donatematch.db')

let db = null

async function initDb() {
  db = await open({
    filename: DB_PATH,
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
      item TEXT NOT NULL,
      quantity TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item TEXT NOT NULL,
      quantity TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_user_id INTEGER NOT NULL,
      batch_key TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL,
      source_item_id INTEGER NOT NULL,
      matched_type TEXT NOT NULL,
      matched_item_id INTEGER NOT NULL,
      item TEXT NOT NULL,
      requested_amount TEXT NOT NULL,
      offered_amount TEXT NOT NULL,
      distance_km REAL NOT NULL DEFAULT 9999,
      match_score REAL NOT NULL DEFAULT 0,
      reasoning TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_user_id) REFERENCES users(id)
    );
  `)

  await migrateLegacyColumns()
}

/** Older DBs used column `name`; current schema uses `item`. */
async function migrateLegacyColumns() {
  for (const table of ['donations', 'requests']) {
    try {
      const cols = await db.all(`PRAGMA table_info(${table})`)
      const names = new Set(cols.map((c) => c.name))
      if (!names.has('item') && names.has('name')) {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN item TEXT`)
        await db.run(`UPDATE ${table} SET item = name`)
      }
      if (!names.has('location')) {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN location TEXT NOT NULL DEFAULT ''`)
      }
    } catch (e) {
      console.error(`migrateLegacyColumns(${table}):`, e.message)
    }
  }

  try {
    const cols = await db.all('PRAGMA table_info(offers)')
    const names = new Set(cols.map((c) => c.name))
    if (cols.length && !names.has('status')) {
      await db.exec("ALTER TABLE offers ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'")
    }
    if (cols.length && !names.has('batch_key')) {
      await db.exec("ALTER TABLE offers ADD COLUMN batch_key TEXT NOT NULL DEFAULT ''")
    }
  } catch (e) {
    console.error('migrateLegacyColumns(offers):', e.message)
  }
}

function normalizeItem(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function basicMatchScore(sourceName, candidateName) {
  const a = normalizeItem(sourceName)
  const b = normalizeItem(candidateName)
  if (!a || !b) return 0
  if (a === b) return 0.95
  if (a.includes(b) || b.includes(a)) return 0.8
  const sourceTokens = new Set(a.split(' '))
  const candidateTokens = new Set(b.split(' '))
  const overlap = [...sourceTokens].filter((x) => candidateTokens.has(x)).length
  const total = Math.max(sourceTokens.size, candidateTokens.size, 1)
  return overlap / total
}

function parseJsonObject(text) {
  if (!text) return null
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

function toBooleanOrNull(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return null
}

async function callGroq(prompt) {
  if (!GROQ_API_KEY) return null
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content:
              'You return compact JSON only. Do not add markdown formatting or explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })
    if (!response.ok) return null
    const json = await response.json().catch(() => null)
    return json?.choices?.[0]?.message?.content || null
  } catch {
    return null
  }
}

async function scoreItemMatchWithLlm(sourceName, candidateName) {
  const fallback = basicMatchScore(sourceName, candidateName)
  if (!GROQ_API_KEY) {
    return {
      score: fallback,
      isMatch: fallback >= 0.5,
      reasoning: 'Fallback lexical matcher used.'
    }
  }

  const prompt =
    `Decide if two aid inventory names describe a compatible donation/request pair.\n` +
    `source_item="${sourceName}"\n` +
    `candidate_item="${candidateName}"\n\n` +
    'Return JSON with shape: {"isMatch": boolean, "score": number, "reasoning": string}. ' +
    'Score must be from 0 to 1. If the items are clearly similar or one is a specific form of the other, set isMatch=true.'

  const content = await callGroq(prompt)
  const parsed = parseJsonObject(content)
  if (!parsed) {
    return {
      score: fallback,
      isMatch: fallback >= 0.5,
      reasoning: 'Fallback lexical matcher used.'
    }
  }

  const parsedIsMatch = toBooleanOrNull(parsed.isMatch)
  const parsedScore = Number(parsed.score)
  const llmScore = Number.isFinite(parsedScore) ? Math.max(0, Math.min(1, parsedScore)) : null
  const rescuedByLexicalSimilarity = fallback >= 0.55
  const blendedScore = Math.max(
    fallback,
    llmScore ?? 0,
    parsedIsMatch === true ? 0.55 : 0
  )
  const isMatch = parsedIsMatch === true || rescuedByLexicalSimilarity || (llmScore ?? 0) >= 0.6
  const baseReasoning = String(parsed.reasoning || '').trim() || 'Matched via LLM.'

  return {
    isMatch,
    score: blendedScore,
    reasoning: rescuedByLexicalSimilarity && parsedIsMatch !== true
      ? `${baseReasoning} Lexical similarity fallback kept this match.`
      : baseReasoning
  }
}

function parseCoordinates(location) {
  const m = String(location || '')
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function haversineKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180
  const r = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
  return 2 * r * Math.asin(Math.sqrt(h))
}

async function estimateDistanceKm(sourceLocation, candidateLocation) {
  const source = parseCoordinates(sourceLocation)
  const candidate = parseCoordinates(candidateLocation)
  if (source && candidate) {
    return Math.round(haversineKm(source, candidate) * 100) / 100
  }
  if (!GROQ_API_KEY) return 9999

  const prompt =
    'Estimate travel distance in kilometers between two user-reported locations. ' +
    'Return JSON only: {"distanceKm": number}.\n' +
    `location_a="${sourceLocation}"\nlocation_b="${candidateLocation}"`

  const content = await callGroq(prompt)
  const parsed = parseJsonObject(content)
  const distanceKm = Number(parsed?.distanceKm)
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 9999
  return Math.round(distanceKm * 100) / 100
}

function formatOfferPayload(row) {
  return {
    id: row.id,
    item: row.item,
    requestedAmount: row.requested_amount,
    offeredAmount: row.offered_amount,
    distanceKm: row.distance_km,
    matchScore: Math.round(Number(row.match_score || 0) * 100) / 100,
    reasoning: row.reasoning
  }
}

async function rowExists(table, id) {
  if (!Number.isFinite(Number(id))) return false
  const row = await db.get(`SELECT id FROM ${table} WHERE id = ?`, [id])
  return Boolean(row)
}

async function offerPointsToActiveRows(offer) {
  const sourceTable = offer.source_type === 'donation' ? 'donations' : 'requests'
  const matchedTable = offer.matched_type === 'donation' ? 'donations' : 'requests'
  const [sourceExists, matchedExists] = await Promise.all([
    rowExists(sourceTable, Number(offer.source_item_id)),
    rowExists(matchedTable, Number(offer.matched_item_id))
  ])
  return sourceExists && matchedExists
}

function collectOfferRecordIds(offer) {
  const donationIds = []
  const requestIds = []
  const sourceId = Number(offer.source_item_id)
  const matchedId = Number(offer.matched_item_id)

  if (offer.source_type === 'donation' && Number.isFinite(sourceId)) donationIds.push(sourceId)
  if (offer.source_type === 'request' && Number.isFinite(sourceId)) requestIds.push(sourceId)
  if (offer.matched_type === 'donation' && Number.isFinite(matchedId)) donationIds.push(matchedId)
  if (offer.matched_type === 'request' && Number.isFinite(matchedId)) requestIds.push(matchedId)

  return { donationIds, requestIds }
}

async function expireOffersTouchingRows({ donationIds, requestIds }, keepOfferId = null) {
  const updates = []
  const keepId = Number(keepOfferId)
  const idFilter = Number.isFinite(keepId) ? 'AND id != ?' : ''
  const idArg = Number.isFinite(keepId) ? [keepId] : []

  for (const id of donationIds) {
    updates.push(
      db.run(
        `UPDATE offers
         SET status = 'expired'
         WHERE status = 'pending'
           ${idFilter}
           AND (
             (source_type = 'donation' AND source_item_id = ?)
             OR (matched_type = 'donation' AND matched_item_id = ?)
           )`,
        [...idArg, id, id]
      )
    )
  }
  for (const id of requestIds) {
    updates.push(
      db.run(
        `UPDATE offers
         SET status = 'expired'
         WHERE status = 'pending'
           ${idFilter}
           AND (
             (source_type = 'request' AND source_item_id = ?)
             OR (matched_type = 'request' AND matched_item_id = ?)
           )`,
        [...idArg, id, id]
      )
    )
  }
  if (!updates.length) return
  await Promise.all(updates)
}

async function findNextPendingValidOffer({ userId, batchKey, excludedOfferId }) {
  const pending = await db.all(
    `SELECT *
     FROM offers
     WHERE target_user_id = ?
       AND batch_key = ?
       AND status = 'pending'
       AND id != ?
     ORDER BY match_score DESC, distance_km ASC, created_at DESC`,
    [userId, String(batchKey || ''), Number(excludedOfferId) || -1]
  )

  for (const offer of pending) {
    const isValid = await offerPointsToActiveRows(offer)
    if (isValid) return offer
    await db.run("UPDATE offers SET status = 'expired' WHERE id = ? AND status = 'pending'", [offer.id])
  }

  return null
}

async function buildBestOffer({
  submissionType,
  userId,
  insertedRows
}) {
  const targetType = submissionType === 'request' ? 'donations' : 'requests'
  const targetRows = await db.all(
    `SELECT id, user_id, item, quantity, location, created_at
     FROM ${targetType}
     ORDER BY created_at DESC`,
    []
  )
  if (!targetRows.length) return null

  const contenders = []
  for (const sourceRow of insertedRows) {
    for (const candidate of targetRows) {
      const llm = await scoreItemMatchWithLlm(sourceRow.item, candidate.item)
      if (!llm.isMatch || llm.score < 0.5) continue

      const distanceKm = await estimateDistanceKm(sourceRow.location, candidate.location)
      contenders.push({
        sourceRow,
        candidate,
        score: llm.score,
        reasoning: llm.reasoning,
        distanceKm
      })
    }
  }

  if (!contenders.length) return null
  contenders.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.distanceKm - b.distanceKm
  })

  const sourceType = submissionType === 'request' ? 'request' : 'donation'
  const matchedType = sourceType === 'request' ? 'donation' : 'request'
  const batchKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  let topOffer = null
  const insertedPairKeys = new Set()

  for (const contender of contenders) {
    const pairKey = `${sourceType}:${contender.sourceRow.id}->${matchedType}:${contender.candidate.id}`
    if (insertedPairKeys.has(pairKey)) continue

    const existing = await db.get(
      `SELECT id
       FROM offers
       WHERE target_user_id = ?
         AND source_type = ?
         AND source_item_id = ?
         AND matched_type = ?
         AND matched_item_id = ?
         AND status IN ('pending', 'accepted')
       LIMIT 1`,
      [userId, sourceType, contender.sourceRow.id, matchedType, contender.candidate.id]
    )
    if (existing) continue

    const offeredAmount =
      submissionType === 'request' ? contender.candidate.quantity : contender.sourceRow.quantity
    const requestedAmount =
      submissionType === 'request' ? contender.sourceRow.quantity : contender.candidate.quantity

    const insert = await db.run(
      `INSERT INTO offers (
        target_user_id,
        batch_key,
        source_type,
        source_item_id,
        matched_type,
        matched_item_id,
        item,
        requested_amount,
        offered_amount,
        distance_km,
        match_score,
        reasoning
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        batchKey,
        sourceType,
        contender.sourceRow.id,
        matchedType,
        contender.candidate.id,
        contender.sourceRow.item,
        requestedAmount,
        offeredAmount,
        contender.distanceKm,
        contender.score,
        contender.reasoning
      ]
    )

    if (!topOffer) {
      topOffer = {
        id: insert.lastID,
        item: contender.sourceRow.item,
        requestedAmount,
        offeredAmount,
        distanceKm: contender.distanceKm,
        matchScore: Math.round(contender.score * 100) / 100,
        reasoning: contender.reasoning
      }
    }

    insertedPairKeys.add(pairKey)
  }

  return topOffer
}

const app = express()

app.use(cors({ origin: true }))
app.use(express.json())

app.get('/api/health', async (req, res) => {
  try {
    const donations = await db.get('SELECT COUNT(*) AS n FROM donations')
    const requests = await db.get('SELECT COUNT(*) AS n FROM requests')
    res.json({
      ok: true,
      apiVersion: API_VERSION,
      dbPath: DB_PATH,
      counts: {
        donations: donations?.n ?? 0,
        requests: requests?.n ?? 0
      }
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      apiVersion: API_VERSION,
      error: error.message
    })
  }
})

async function getUserOrSendError(userId, res) {
  const id = Number(userId)
  if (userId === undefined || userId === null || Number.isNaN(id)) {
    res.status(401).json({ error: 'Authentication required' })
    return null
  }
  const user = await db.get('SELECT * FROM users WHERE id = ?', id)
  if (!user) {
    res.status(401).json({ error: 'User not found' })
    return null
  }
  return user
}

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

app.post('/api/data/remove-donations-by-phone', async (req, res) => {
  const phone = String(req.body?.phone || '').trim()
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' })
  }

  try {
    const user = await db.get('SELECT id FROM users WHERE phone_number = ?', [phone])
    if (!user?.id) {
      return res.json({ success: true, deletedCount: 0 })
    }

    const donationRows = await db.all('SELECT id FROM donations WHERE user_id = ?', [user.id])
    const donationIds = donationRows
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id))

    if (!donationIds.length) {
      return res.json({ success: true, deletedCount: 0 })
    }

    await db.run('DELETE FROM donations WHERE user_id = ?', [user.id])
    await expireOffersTouchingRows({ donationIds, requestIds: [] })

    res.json({ success: true, deletedCount: donationIds.length })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Donations endpoints
app.get('/api/donations', async (req, res) => {
  try {
    const donations = await db.all(`
      SELECT id, user_id, item as name, quantity as amount, created_at
      FROM donations
      ORDER BY created_at DESC
    `)
    res.json(donations)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/donations', async (req, res) => {
  const { userId, items, location } = req.body

  try {
    const user = await getUserOrSendError(userId, res)
    if (!user) return

    const normalizedLocation = String(location || '').trim()
    if (!normalizedLocation) {
      return res.status(400).json({ error: 'Location is required' })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No donation items provided' })
    }

    const insertedRows = []
    for (const item of items) {
      const name = String(item.name || '').trim()
      const amount = String(item.amount || '').trim()
      if (!name || !amount) {
        return res.status(400).json({ error: 'Each donation needs a name and amount' })
      }

      const insert = await db.run(
        'INSERT INTO donations (user_id, item, quantity, location) VALUES (?, ?, ?, ?)',
        [userId, name, amount, normalizedLocation]
      )
      insertedRows.push({ id: insert.lastID, item: name, quantity: amount, location: normalizedLocation })
    }

    const offer = await buildBestOffer({
      submissionType: 'donation',
      userId,
      insertedRows
    })

    res.json({ success: true, offer })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Requests endpoints
app.get('/api/requests', async (req, res) => {
  try {
    const requests = await db.all(`
      SELECT id, user_id, item as name, quantity as amount, created_at
      FROM requests
      ORDER BY created_at DESC
    `)
    res.json(requests)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/requests', async (req, res) => {
  const { userId, items, location } = req.body

  try {
    const user = await getUserOrSendError(userId, res)
    if (!user) return

    const normalizedLocation = String(location || '').trim()
    if (!normalizedLocation) {
      return res.status(400).json({ error: 'Location is required' })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No request items provided' })
    }

    const insertedRows = []
    for (const item of items) {
      const name = String(item.name || '').trim()
      const amount = String(item.amount || '').trim()
      if (!name || !amount) {
        return res.status(400).json({ error: 'Each request needs a name and amount' })
      }

      const insert = await db.run(
        'INSERT INTO requests (user_id, item, quantity, location) VALUES (?, ?, ?, ?)',
        [userId, name, amount, normalizedLocation]
      )
      insertedRows.push({ id: insert.lastID, item: name, quantity: amount, location: normalizedLocation })
    }

    const offer = await buildBestOffer({
      submissionType: 'request',
      userId,
      insertedRows
    })

    res.json({ success: true, offer })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/offers/:offerId/respond', async (req, res) => {
  const { userId, decision } = req.body
  const offerId = Number(req.params.offerId)
  const normalizedDecision = String(decision || '').trim().toLowerCase()

  if (!Number.isFinite(offerId)) {
    return res.status(400).json({ error: 'Invalid offer ID' })
  }
  if (normalizedDecision !== 'accept' && normalizedDecision !== 'reject') {
    return res.status(400).json({ error: 'Decision must be accept or reject' })
  }

  try {
    const user = await getUserOrSendError(userId, res)
    if (!user) return

    const offer = await db.get('SELECT * FROM offers WHERE id = ?', [offerId])
    if (!offer) return res.status(404).json({ error: 'Offer not found' })
    if (offer.target_user_id !== Number(userId)) {
      return res.status(403).json({ error: 'Cannot respond to this offer' })
    }
    if (offer.status !== 'pending') {
      return res.status(400).json({ error: 'Offer already responded to' })
    }

    const isStillValid = await offerPointsToActiveRows(offer)
    if (!isStillValid) {
      await db.run("UPDATE offers SET status = 'expired' WHERE id = ? AND status = 'pending'", [offerId])
      const fallback = await findNextPendingValidOffer({
        userId,
        batchKey: offer.batch_key,
        excludedOfferId: offerId
      })
      return res.status(409).json({
        error: 'Offer is no longer available',
        nextOffer: fallback ? formatOfferPayload(fallback) : null
      })
    }

    const status = normalizedDecision === 'accept' ? 'accepted' : 'rejected'
    await db.run('UPDATE offers SET status = ? WHERE id = ?', [status, offerId])
    let donorPhone = ''
    let nextOffer = null

    if (status === 'accepted') {
      const donationItemId =
        offer.source_type === 'donation'
          ? Number(offer.source_item_id)
          : offer.matched_type === 'donation'
            ? Number(offer.matched_item_id)
            : null

      if (Number.isFinite(donationItemId)) {
        const donorDonation = await db.get('SELECT user_id FROM donations WHERE id = ?', [donationItemId])
        if (donorDonation?.user_id) {
          const donorUser = await db.get('SELECT phone_number FROM users WHERE id = ?', [
            donorDonation.user_id
          ])
          donorPhone = String(donorUser?.phone_number || '').trim()
        }
      }

      // Accepted matches are fulfilled and should disappear from the open lists.
      const deleteActions = []
      if (offer.source_type === 'donation') {
        deleteActions.push(db.run('DELETE FROM donations WHERE id = ?', [offer.source_item_id]))
      } else if (offer.source_type === 'request') {
        deleteActions.push(db.run('DELETE FROM requests WHERE id = ?', [offer.source_item_id]))
      }

      if (offer.matched_type === 'donation') {
        deleteActions.push(db.run('DELETE FROM donations WHERE id = ?', [offer.matched_item_id]))
      } else if (offer.matched_type === 'request') {
        deleteActions.push(db.run('DELETE FROM requests WHERE id = ?', [offer.matched_item_id]))
      }

      await Promise.all(deleteActions)
      await expireOffersTouchingRows(collectOfferRecordIds(offer), offerId)
    } else {
      const next = await findNextPendingValidOffer({
        userId,
        batchKey: offer.batch_key,
        excludedOfferId: offerId
      })
      if (next) nextOffer = formatOfferPayload(next)
    }

    res.json({ success: true, status, donorPhone, nextOffer })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

const distPath = path.join(__dirname, 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// Initialize and start
async function start() {
  await initDb()
  try {
    const d = await db.get('SELECT COUNT(*) AS n FROM donations')
    const r = await db.get('SELECT COUNT(*) AS n FROM requests')
    console.log('[donatematch] SQLite file:', DB_PATH)
    console.log('[donatematch] Row counts — donations:', d?.n ?? '?', 'requests:', r?.n ?? '?')
  } catch (e) {
    console.warn('[donatematch] Could not read row counts:', e.message)
  }
  const PORT = process.env.PORT || 5001
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log(`[donatematch] API version: ${API_VERSION}`)
    if (fs.existsSync(distPath)) {
      console.log(`Also serving frontend from ${distPath}`)
    }
  })
}

start().catch(console.error)

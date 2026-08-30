#!/usr/bin/env node
/**
 * One-off script to bulk-create seat documents in Firestore.
 *
 * Usage:
 *   node scripts/seedSeats.mjs
 *
 * Requires the same VITE_FIREBASE_* values as the app, plus admin
 * credentials, read from .env.local in the project root (falls back to
 * process.env):
 *   SEED_ADMIN_EMAIL=admin@example.com
 *   SEED_ADMIN_PASSWORD=your-admin-password
 *
 * firestore.rules requires an authenticated admin session to *create*
 * seat documents, so this script signs in with those credentials before
 * writing (using an existing user created in Firebase Console >
 * Authentication > Users — this script does not create accounts).
 *
 * Edit SEAT_LAYOUT below to match your venue (rows x seats-per-row, or a
 * flat list of custom labels).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvLocal() {
  try {
    const envPath = join(__dirname, '..', '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 1).trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env.local not found — rely on process.env / shell exports.
  }
}

loadEnvLocal()

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.projectId) {
  console.error(
    'Missing Firebase config. Create .env.local (see .env.example) before running this script.'
  )
  process.exit(1)
}

// ---- Configure your venue layout here -------------------------------
// Example: rows A-E, 10 seats each -> A1..A10, B1..B10, ... E1..E10
const ROWS = ['A', 'B', 'C', 'D', 'E']
const SEATS_PER_ROW = 10
const SEAT_LAYOUT = ROWS.flatMap((row) =>
  Array.from({ length: SEATS_PER_ROW }, (_, i) => `${row}${i + 1}`)
)
// -----------------------------------------------------------------------

const adminEmail = process.env.SEED_ADMIN_EMAIL
const adminPassword = process.env.SEED_ADMIN_PASSWORD

if (!adminEmail || !adminPassword) {
  console.error(
    'Missing admin credentials. Add SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to .env.local ' +
      '(use an existing user from Firebase Console > Authentication > Users).'
  )
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

async function main() {
  console.log(`Signing in as ${adminEmail}...`)
  await signInWithEmailAndPassword(auth, adminEmail, adminPassword)

  const seatsCol = collection(db, 'seats')

  const existing = await getDocs(seatsCol)
  if (!existing.empty) {
    console.log(
      `'seats' collection already has ${existing.size} document(s). ` +
        'Aborting to avoid duplicates. Delete existing seats first if you want to re-seed.'
    )
    return
  }

  console.log(`Seeding ${SEAT_LAYOUT.length} seats...`)
  for (const seat_number of SEAT_LAYOUT) {
    await addDoc(seatsCol, {
      seat_number,
      status: 'Available',
      reservation_id: null,
    })
  }
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

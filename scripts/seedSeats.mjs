#!/usr/bin/env node
/**
 * One-off script to bulk-create seat documents in Firestore, matching the
 * theater's real physical layout defined in
 * src/config/theaterLayout.json (the same file the React app reads via
 * src/config/theaterLayout.ts, so the UI and the seeded data always agree
 * on section/row/side/seat_index shape).
 *
 * Usage:
 *   node scripts/seedSeats.mjs            # seed only if 'seats' is empty
 *   node scripts/seedSeats.mjs --reseed    # delete ALL existing seats and
 *                                          # reservations, then reseed from
 *                                          # scratch (use after changing the
 *                                          # layout config, e.g. this
 *                                          # Balcony/Main-Floor redesign)
 *
 * Requires the same VITE_FIREBASE_* values as the app, plus admin
 * credentials, read from .env.local in the project root (falls back to
 * process.env):
 *   SEED_ADMIN_EMAIL=admin@example.com
 *   SEED_ADMIN_PASSWORD=your-admin-password
 *
 * firestore.rules requires an authenticated admin session to *create* or
 * *delete* seat/reservation documents, so this script signs in with those
 * credentials before writing (using an existing user created in Firebase
 * Console > Authentication > Users — this script does not create
 * accounts).
 *
 * To change the venue's seating chart, edit
 * src/config/theaterLayout.json — this script and the React app both
 * read from it, so there is only one place to update.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESEED = process.argv.includes('--reseed')

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

// ---- Venue layout: read from the shared JSON config -------------------
// Edit src/config/theaterLayout.json to change the seating chart — both
// this script and the React UI (src/config/theaterLayout.ts) read from it.
const layoutPath = join(__dirname, '..', 'src', 'config', 'theaterLayout.json')
const { sections } = JSON.parse(readFileSync(layoutPath, 'utf-8'))

function buildSeatNumber(section, row, side, seatIndex) {
  return `${section}-R${row}-${side}-${seatIndex}`
}

/** Generate every seat document for the configured layout. */
function generateSeatDocs() {
  const seats = []
  for (const section of sections) {
    for (const rowConfig of section.rows) {
      const sides = [
        { side: 'Left', count: rowConfig.leftCount },
        { side: 'Right', count: rowConfig.rightCount },
      ]
      for (const { side, count } of sides) {
        for (let i = 1; i <= count; i++) {
          seats.push({
            seat_number: buildSeatNumber(section.id, rowConfig.row, side, i),
            status: 'Available',
            reservation_id: null,
            section: section.id,
            row: rowConfig.row,
            side,
            seat_index: i,
          })
        }
      }
    }
  }
  return seats
}

const SEAT_DOCS = generateSeatDocs()
// -------------------------------------------------------------------------

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

async function deleteAllDocs(collectionName) {
  const col = collection(db, collectionName)
  const snap = await getDocs(col)
  console.log(`  Deleting ${snap.size} existing '${collectionName}' document(s)...`)
  for (const docSnap of snap.docs) {
    await deleteDoc(doc(db, collectionName, docSnap.id))
  }
}

async function main() {
  console.log(`Signing in as ${adminEmail}...`)
  await signInWithEmailAndPassword(auth, adminEmail, adminPassword)

  const seatsCol = collection(db, 'seats')
  const existing = await getDocs(seatsCol)

  if (!existing.empty) {
    if (!RESEED) {
      console.log(
        `'seats' collection already has ${existing.size} document(s). ` +
          'Aborting to avoid duplicates. Re-run with --reseed to wipe existing ' +
          'seats AND reservations and reseed from the current layout config.'
      )
      return
    }
    console.log(
      `--reseed given: wiping existing seats and reservations before reseeding ` +
        `(this deletes ALL current bookings — only use this after confirming ` +
        `there are no reservations you need to keep).`
    )
    // Reservations reference seat IDs that are about to be deleted, so wipe
    // them too — otherwise they'd point at nonexistent seats.
    await deleteAllDocs('reservations')
    await deleteAllDocs('seats')
  }

  console.log(`Seeding ${SEAT_DOCS.length} seats (Balcony: 144, Main Floor: 288)...`)
  for (const seat of SEAT_DOCS) {
    await addDoc(seatsCol, seat)
  }
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * Data-access layer for the `seats` collection.
 * Keep all direct Firestore calls for seats in this file so the rest of the
 * app depends on a stable, typed API instead of the Firestore SDK directly.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { COLLECTIONS, type Seat, type NewSeatInput, type SeatStatus } from '../types/models'
import { generateSeatDefinitions } from '../config/theaterLayout'

const seatsCol = collection(db, COLLECTIONS.SEATS)

const UNAVAILABLE_STATUSES: SeatStatus[] = ['Pending', 'Confirmed', 'Blocked']

/**
 * The physical layout is static and ships with the app. Only unavailable
 * seat documents need to come from Firestore. Deterministic document IDs
 * (equal to seat_number) let the generated seats address Firestore directly.
 */
function buildSeatMap(unavailableSeats: Seat[]): Seat[] {
  const unavailableById = new Map(unavailableSeats.map((seat) => [seat.id, seat]))

  return generateSeatDefinitions().map((definition) => {
    const id = definition.seat_number
    return unavailableById.get(id) ?? { id, ...definition }
  })
}

/**
 * Build the full map locally and fetch only non-Available seat documents.
 * An empty theater therefore returns zero Firestore documents, not 503.
 */
export async function getAllSeats(): Promise<Seat[]> {
  const snap = await getDocs(query(seatsCol, where('status', 'in', UNAVAILABLE_STATUSES)))
  const unavailable = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Seat, 'id'>) }))
  return buildSeatMap(unavailable)
}

/** Fetch a single seat by document ID. */
export async function getSeatById(seatId: string): Promise<Seat | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.SEATS, seatId))
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Seat, 'id'>) } : null
}

/** Fetch seats filtered by status (e.g. all 'Available' seats). */
export async function getSeatsByStatus(status: SeatStatus): Promise<Seat[]> {
  const snap = await getDocs(query(seatsCol, where('status', '==', status)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Seat, 'id'>) }))
}

/** Create a seat using its canonical seat_number as its Firestore ID. */
export async function createSeat(seat: NewSeatInput): Promise<string> {
  const ref = doc(db, COLLECTIONS.SEATS, seat.seat_number)
  await setDoc(ref, seat)
  return seat.seat_number
}

/**
 * Bulk-create every seat defined by the theater layout config
 * (src/config/theaterLayout.ts). Returns the generated IDs in order.
 * Prefer running scripts/seedSeats.mjs for initial venue setup (it
 * authenticates as an admin and checks for an existing seat before
 * writing); this in-app helper exists for programmatic reseeding from
 * within the authenticated admin UI if ever needed.
 */
export async function createSeatsBulk(seats: NewSeatInput[] = generateSeatDefinitions()): Promise<string[]> {
  const ids: string[] = []
  for (const seat of seats) {
    const id = await createSeat(seat)
    ids.push(id)
  }
  return ids
}

/** Update arbitrary fields on a seat (e.g. status, reservation_id). */
export async function updateSeat(seatId: string, updates: Partial<Seat>): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.SEATS, seatId), updates)
}

/** Convenience helper to change only the status field. */
export async function setSeatStatus(seatId: string, status: SeatStatus): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.SEATS, seatId), { status })
}

/** Delete a seat document entirely. */
export async function deleteSeat(seatId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.SEATS, seatId))
}

/**
 * Admin action: block a currently 'Available' seat (mark it VIP-only /
 * unbookable). Runs in a transaction so it cannot race against a guest's
 * `createReservation` transaction — whichever commits first wins, and the
 * loser sees a clear error instead of silently corrupting state.
 */
export async function blockSeat(seatId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, COLLECTIONS.SEATS, seatId)
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Seat not found.')
    const status = (snap.data() as Seat).status
    if (status !== 'Available') {
      throw new Error(`Seat is currently '${status}' and cannot be blocked.`)
    }
    tx.update(ref, { status: 'Blocked' })
  })
}

/**
 * Admin action: unblock a 'Blocked' seat, returning it to 'Available'.
 */
export async function unblockSeat(seatId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, COLLECTIONS.SEATS, seatId)
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Seat not found.')
    const status = (snap.data() as Seat).status
    if (status !== 'Blocked') {
      throw new Error(`Seat is currently '${status}', not Blocked.`)
    }
    tx.update(ref, { status: 'Available' })
  })
}

/** Atomically block or unblock a list of seat document IDs for VIP use. */
export async function setVipSeatBlocking(seatIds: string[], blocked: boolean): Promise<void> {
  const uniqueIds = [...new Set(seatIds)]
  if (uniqueIds.length === 0) throw new Error('Enter at least one valid seat.')
  if (uniqueIds.length > 500) throw new Error('A maximum of 500 seats can be changed at once.')

  const batch = writeBatch(db)
  uniqueIds.forEach((seatId) => {
    batch.update(doc(db, COLLECTIONS.SEATS, seatId), {
      status: blocked ? 'Blocked' : 'Available',
      ...(blocked ? {} : { reservation_id: null }),
    })
  })
  await batch.commit()
}

/**
 * Subscribe only to non-Available documents, then merge them into the local
 * 503-seat layout. Available seats produce no Firestore query results.
 */
export function subscribeToSeats(
  callback: (seats: Seat[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(seatsCol, where('status', 'in', UNAVAILABLE_STATUSES))
  return onSnapshot(
    q,
    (snap) => {
      const unavailable = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Seat, 'id'>),
      }))
      callback(buildSeatMap(unavailable))
    },
    (error) => onError?.(error)
  )
}

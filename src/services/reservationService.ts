/**
 * Data-access layer for the `reservations` collection.
 *
 * Reservation creation/cancellation touches both the `reservations`
 * collection and the `seats` collection (each reserved seat's `status` /
 * `reservation_id` must stay in sync). Firestore transactions are used so
 * these multi-document writes are atomic and race-safe (e.g. two servants
 * cannot both book the same seat at once).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type DocumentReference,
  type WriteBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'
import { db, auth } from '../firebase/config'
import { TICKET_PRICE_EGP, MAX_SEATS_PER_BOOKING } from '../config/eventConfig'
import {
  COLLECTIONS,
  type Reservation,
  type NewReservationInput,
} from '../types/models'

const reservationsCol = collection(db, COLLECTIONS.RESERVATIONS)

/** Fetch every reservation once, newest first. */
export async function getAllReservations(): Promise<Reservation[]> {
  const snap = await getDocs(query(reservationsCol, orderBy('created_at', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reservation, 'id'>) }))
}

/** Fetch a single reservation by document ID. */
export async function getReservationById(reservationId: string): Promise<Reservation | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.RESERVATIONS, reservationId))
  return snap.exists()
    ? { id: snap.id, ...(snap.data() as Omit<Reservation, 'id'>) }
    : null
}

/**
 * Create a reservation and atomically mark all its seats as 'Pending'.
 * Fails (throws) if any requested seat is not currently 'Available',
 * preventing double-booking.
 *
 * @param input Reservation fields (without id / created_at).
 * @returns The new reservation's document ID.
 */
export async function createReservation(input: NewReservationInput): Promise<string> {
  if (input.seat_ids.length < 1 || input.seat_ids.length > MAX_SEATS_PER_BOOKING) {
    throw new Error(`A reservation must include between 1 and ${MAX_SEATS_PER_BOOKING} seats.`)
  }
  if (new Set(input.seat_ids).size !== input.seat_ids.length) {
    throw new Error('Duplicate seats are not allowed.')
  }

  const user = auth.currentUser ?? (await signInAnonymously(auth)).user
  const reservationRef = doc(reservationsCol)
  const totalPrice = input.seat_ids.length * TICKET_PRICE_EGP

  await runTransaction(db, async (tx) => {
    const seatRefs = input.seat_ids.map((seatId) => doc(db, COLLECTIONS.SEATS, seatId))
    const seatSnapshots = await Promise.all(seatRefs.map((seatRef) => tx.get(seatRef)))

    const unavailable = seatSnapshots.some(
      (seatSnapshot) => !seatSnapshot.exists() || seatSnapshot.data().status !== 'Available'
    )
    if (unavailable) {
      throw new Error('One or more selected seats were just taken. Please choose different seats.')
    }

    tx.set(reservationRef, {
      guest_name: input.guest_name.trim(),
      phone_number: input.phone_number.trim(),
      payment_method: input.payment_method,
      servant_name: input.servant_name,
      seat_ids: input.seat_ids,
      userId: user.uid,
      status: 'Pending',
      ticket_price: TICKET_PRICE_EGP,
      total_price: totalPrice,
      created_at: serverTimestamp(),
    })

    seatRefs.forEach((seatRef) => {
      tx.update(seatRef, {
        status: 'Pending',
        reservation_id: reservationRef.id,
        held_by: user.uid,
      })
    })
  })

  return reservationRef.id
}

/**
 * Confirm a pending reservation (e.g. after payment is verified) by
 * flipping the reservation's seats to 'Confirmed'.
 */
export async function confirmReservation(reservationId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const resRef = doc(db, COLLECTIONS.RESERVATIONS, reservationId)
    const resSnap = await tx.get(resRef)
    if (!resSnap.exists()) throw new Error('Reservation not found.')

    const seatIds = (resSnap.data() as Reservation).seat_ids
    tx.update(resRef, { status: 'Confirmed' })
    seatIds.forEach((seatId) => {
      tx.update(doc(db, COLLECTIONS.SEATS, seatId), { status: 'Confirmed' })
    })
  })
}

/**
 * Soft-cancel a reservation and release its seats back to 'Available'.
 * The reservation is retained for audit, filtering, and revenue reporting.
 */
export async function cancelReservation(reservationId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const resRef = doc(db, COLLECTIONS.RESERVATIONS, reservationId)
    const resSnap = await tx.get(resRef)
    if (!resSnap.exists()) throw new Error('Reservation not found.')

    const seatIds = (resSnap.data() as Reservation).seat_ids
    seatIds.forEach((seatId) => {
      tx.update(doc(db, COLLECTIONS.SEATS, seatId), {
        status: 'Available',
        reservation_id: null,
        held_by: null,
      })
    })
    tx.update(resRef, { status: 'Canceled' })
  })
}

/**
 * Atomically confirm multiple reservations and all of their seats.
 * Firestore batches support at most 500 writes, so reject oversized UI
 * selections rather than silently splitting one requested atomic action.
 */
export async function bulkConfirmReservations(reservations: Reservation[]): Promise<void> {
  const writeCount = reservations.length + reservations.reduce((sum, item) => sum + item.seat_ids.length, 0)
  if (writeCount > 500) throw new Error('Too many reservations selected for one atomic update.')

  const batch = writeBatch(db)
  for (const reservation of reservations) {
    if (!reservation.id) continue
    batch.update(doc(db, COLLECTIONS.RESERVATIONS, reservation.id), { status: 'Confirmed' })
    reservation.seat_ids.forEach((seatId) => {
      batch.update(doc(db, COLLECTIONS.SEATS, seatId), { status: 'Confirmed' })
    })
  }
  await batch.commit()
}

/** Atomically soft-cancel multiple reservations and release their seats. */
export async function bulkCancelReservations(reservations: Reservation[]): Promise<void> {
  const writeCount = reservations.length + reservations.reduce((sum, item) => sum + item.seat_ids.length, 0)
  if (writeCount > 500) throw new Error('Too many reservations selected for one atomic update.')

  const batch = writeBatch(db)
  for (const reservation of reservations) {
    if (!reservation.id) continue
    batch.update(doc(db, COLLECTIONS.RESERVATIONS, reservation.id), { status: 'Canceled' })
    reservation.seat_ids.forEach((seatId) => {
      batch.update(doc(db, COLLECTIONS.SEATS, seatId), {
        status: 'Available',
        reservation_id: null,
        held_by: null,
      })
    })
  }
  await batch.commit()
}

/**
 * Delete all test reservations and release every non-VIP occupied seat.
 * Firestore permits 500 writes per batch; use smaller chunks so the reset
 * remains reliable for large test runs. Blocked VIP seats are never changed.
 */
export async function resetAllTestReservationData(): Promise<{
  deletedReservations: number
  releasedSeats: number
}> {
  const [reservationSnapshot, seatSnapshot] = await Promise.all([
    getDocs(reservationsCol),
    getDocs(
      query(
        collection(db, COLLECTIONS.SEATS),
        where('status', 'in', ['Pending', 'Confirmed'])
      )
    ),
  ])

  type ResetOperation = (batch: WriteBatch) => void
  const operations: ResetOperation[] = []

  reservationSnapshot.docs.forEach((reservationDoc) => {
    operations.push((batch) => batch.delete(reservationDoc.ref))
  })

  const seatsToRelease: DocumentReference[] = seatSnapshot.docs
    .map((seatDoc) => seatDoc.ref)

  seatsToRelease.forEach((seatRef) => {
    operations.push((batch) =>
      batch.update(seatRef, {
        status: 'Available',
        reservation_id: null,
        held_by: null,
      })
    )
  })

  const BATCH_SIZE = 450
  for (let start = 0; start < operations.length; start += BATCH_SIZE) {
    const batch = writeBatch(db)
    operations.slice(start, start + BATCH_SIZE).forEach((operation) => operation(batch))
    await batch.commit()
  }

  return {
    deletedReservations: reservationSnapshot.size,
    releasedSeats: seatsToRelease.length,
  }
}

/** Update simple reservation fields (guest name, phone, etc.) without touching seats. */
export async function updateReservation(
  reservationId: string,
  updates: Partial<Omit<Reservation, 'id' | 'created_at' | 'seat_ids'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.RESERVATIONS, reservationId), updates)
}

/** Hard-delete a reservation document without touching seat statuses. Prefer cancelReservation(). */
export async function deleteReservationRaw(reservationId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.RESERVATIONS, reservationId))
}

/**
 * Subscribe to realtime updates for the full reservation list. Returns an
 * unsubscribe function — call it on component unmount / cleanup.
 */
export function subscribeToReservations(
  callback: (reservations: Reservation[]) => void
): Unsubscribe {
  const q = query(reservationsCol, orderBy('created_at', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reservation, 'id'>) })))
  })
}

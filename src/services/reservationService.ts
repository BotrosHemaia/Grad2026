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
  orderBy,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase/config'
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
  if (input.seat_ids.length === 0) {
    throw new Error('A reservation must include at least one seat.')
  }

  const reservationRef = doc(reservationsCol)

  await runTransaction(db, async (tx) => {
    const seatRefs = input.seat_ids.map((seatId) => doc(db, COLLECTIONS.SEATS, seatId))
    const seatSnaps = await Promise.all(seatRefs.map((ref) => tx.get(ref)))

    seatSnaps.forEach((snap, i) => {
      if (!snap.exists()) {
        throw new Error(`Seat ${input.seat_ids[i]} does not exist.`)
      }
      const status = snap.data().status
      if (status !== 'Available') {
        throw new Error(`Seat ${input.seat_ids[i]} is not available (status: ${status}).`)
      }
    })

    tx.set(reservationRef, {
      guest_name: input.guest_name,
      phone_number: input.phone_number,
      payment_method: input.payment_method,
      servant_name: input.servant_name,
      seat_ids: input.seat_ids,
      created_at: serverTimestamp(),
    })

    seatRefs.forEach((ref) => {
      tx.update(ref, { status: 'Pending', reservation_id: reservationRef.id })
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
    seatIds.forEach((seatId) => {
      tx.update(doc(db, COLLECTIONS.SEATS, seatId), { status: 'Confirmed' })
    })
  })
}

/**
 * Cancel a reservation: deletes the reservation document and releases its
 * seats back to 'Available'.
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
      })
    })
    tx.delete(resRef)
  })
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

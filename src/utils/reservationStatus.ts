import type { Reservation, Seat, SeatStatus } from '../types/models'

/**
 * The `reservations` collection has no `status` field of its own — a
 * reservation's effective status is derived from the live status of the
 * seats it holds:
 *   - All seats 'Pending'   -> reservation is 'Pending' (awaiting payment)
 *   - All seats 'Confirmed' -> reservation is 'Confirmed' (approved)
 *   - Anything else (mixed / missing seats) -> 'Unknown' (shouldn't happen
 *     in normal operation, since confirmReservation/cancelReservation
 *     always update every seat_id together)
 *
 * Cancelled reservations are deleted outright by cancelReservation(), so
 * there is no 'Cancelled' state to represent here.
 */
export type DerivedReservationStatus = 'Pending' | 'Confirmed' | 'Canceled' | 'Unknown'

export function getReservationStatus(
  reservation: Reservation,
  seatsById: Map<string, Seat>
): DerivedReservationStatus {
  if (reservation.status === 'Canceled') return 'Canceled'
  if (reservation.status === 'Confirmed') return 'Confirmed'
  if (reservation.status === 'Pending') return 'Pending'

  const statuses: SeatStatus[] = reservation.seat_ids
    .map((id) => seatsById.get(id)?.status)
    .filter((s): s is SeatStatus => Boolean(s))

  if (statuses.length === 0) return 'Unknown'
  if (statuses.every((s) => s === 'Pending')) return 'Pending'
  if (statuses.every((s) => s === 'Confirmed')) return 'Confirmed'
  return 'Unknown'
}

/** Convenience: build a Map<seatId, Seat> for O(1) lookups. */
export function indexSeatsById(seats: Seat[]): Map<string, Seat> {
  return new Map(seats.filter((s) => s.id).map((s) => [s.id as string, s]))
}

/** Resolve seat numbers (e.g. "A1") for a reservation's seat_ids, in order. */
export function getSeatNumbers(reservation: Reservation, seatsById: Map<string, Seat>): string[] {
  return reservation.seat_ids.map((id) => seatsById.get(id)?.seat_number ?? '?')
}

/**
 * Build a Map<seatId, Reservation> so the admin map can look up "who
 * reserved this seat" for any Pending/Confirmed seat cell (tooltip, etc.).
 * Cancelled reservations are deleted outright, so every reservation still
 * in the collection is either Pending or Confirmed and safe to index.
 */
export function indexReservationsBySeatId(reservations: Reservation[]): Map<string, Reservation> {
  const map = new Map<string, Reservation>()
  for (const reservation of reservations) {
    for (const seatId of reservation.seat_ids) {
      map.set(seatId, reservation)
    }
  }
  return map
}

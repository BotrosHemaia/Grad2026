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
export type DerivedReservationStatus = 'Pending' | 'Confirmed' | 'Unknown'

export function getReservationStatus(
  reservation: Reservation,
  seatsById: Map<string, Seat>
): DerivedReservationStatus {
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

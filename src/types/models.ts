/**
 * Data models for the Graduation Party Seat Reservation System.
 *
 * Backing store: Cloud Firestore
 *   - Collection "seats"        -> Seat
 *   - Collection "reservations" -> Reservation
 */

/** Lifecycle status of a single seat. */
export type SeatStatus = 'Available' | 'Pending' | 'Confirmed' | 'Blocked'

/** Accepted payment methods for a reservation. */
export type PaymentMethod = 'Cash' | 'InstaPay'

/**
 * Firestore document shape for the `seats` collection.
 * Document ID (Firestore auto-id or custom, e.g. "A1") is stored separately
 * as `id` when read back from the DB via the service layer.
 */
export interface Seat {
  /** Firestore document ID. Optional on create, always present on read. */
  id?: string
  /** Human-readable seat label, e.g. "A1", "12", "VIP-03". */
  seat_number: string
  /** Current status of the seat. Defaults to 'Available'. */
  status: SeatStatus
  /**
   * Optional convenience back-reference to the reservation currently
   * holding this seat (Pending or Confirmed). Kept in sync by the
   * service layer; not required by the schema but simplifies lookups.
   */
  reservation_id?: string | null
}

/**
 * Firestore document shape for the `reservations` collection.
 */
export interface Reservation {
  /** Firestore document ID. Optional on create, always present on read. */
  id?: string
  guest_name: string
  phone_number: string
  payment_method: PaymentMethod
  /** Name of the servant/usher/staff member who registered the reservation. */
  servant_name: string
  /** Seat document IDs included in this reservation. */
  seat_ids: string[]
  /** Server-side timestamp of creation (Firestore Timestamp on read). */
  created_at: unknown
}

/** Shape accepted when creating a new reservation (no id / created_at yet). */
export type NewReservationInput = Omit<Reservation, 'id' | 'created_at'>

/** Shape accepted when creating a new seat (no id yet). */
export type NewSeatInput = Omit<Seat, 'id'>

/** Collection name constants — use these instead of hardcoded strings. */
export const COLLECTIONS = {
  SEATS: 'seats',
  RESERVATIONS: 'reservations',
} as const

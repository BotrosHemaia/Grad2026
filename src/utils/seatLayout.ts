import type { Seat, TheaterSection } from '../types/models'
import { THEATER_LAYOUT } from '../config/theaterLayout'

/**
 * Groups a flat list of seats (as read from Firestore) into the theater's
 * physical structure for rendering: Section -> Row -> { left seats, right
 * seats }, ready to render with a visible center-aisle gap between the two
 * seat blocks.
 *
 * The row/section order always follows `THEATER_LAYOUT` (the venue's
 * canonical seating chart), not whatever order Firestore happens to
 * return — so the map renders correctly even if seats come back
 * out-of-order, and rows with zero seats in the live data still don't
 * appear (defensive, shouldn't normally happen once seeded).
 */
export interface SeatMapRow {
  row: number
  /** Seats on the left of the aisle, ordered outward-from-aisle (index N..1) so the seat nearest the aisle renders next to the gap. */
  leftSeats: Seat[]
  /** Seats on the right of the aisle, ordered aisle-outward (index 1..N) so the seat nearest the aisle renders next to the gap. */
  rightSeats: Seat[]
}

export interface SeatMapSection {
  id: TheaterSection
  label: string
  rows: SeatMapRow[]
}

export function buildTheaterSeatMap(seats: Seat[]): SeatMapSection[] {
  // Index by "section|row|side|seat_index" for O(1) lookup while walking
  // the canonical layout, so every rendered seat is the live Firestore
  // document (correct id/status) rather than a synthetic placeholder.
  const bySlot = new Map<string, Seat>()
  for (const seat of seats) {
    if (!seat.section || !seat.side || seat.row == null || seat.seat_index == null) continue
    bySlot.set(`${seat.section}|${seat.row}|${seat.side}|${seat.seat_index}`, seat)
  }

  return THEATER_LAYOUT.map((sectionConfig) => ({
    id: sectionConfig.id,
    label: sectionConfig.label,
    rows: sectionConfig.rows.map((rowConfig) => {
      const leftSeats: Seat[] = []
      for (let i = rowConfig.leftCount; i >= 1; i--) {
        const seat = bySlot.get(`${sectionConfig.id}|${rowConfig.row}|Left|${i}`)
        if (seat) leftSeats.push(seat)
      }
      const rightSeats: Seat[] = []
      for (let i = 1; i <= rowConfig.rightCount; i++) {
        const seat = bySlot.get(`${sectionConfig.id}|${rowConfig.row}|Right|${i}`)
        if (seat) rightSeats.push(seat)
      }
      return { row: rowConfig.row, leftSeats, rightSeats }
    }),
  }))
}

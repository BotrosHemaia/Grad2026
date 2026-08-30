import type { Seat, TheaterSection } from '../types/models'
import { THEATER_LAYOUT, type TheaterBoxConfig } from '../config/theaterLayout'

/**
 * Groups a flat list of seats (as read from Firestore) into the theater's
 * physical structure for rendering, driven entirely by `THEATER_LAYOUT`
 * (the venue's canonical, explicitly hard-mapped seating chart — see
 * theaterLayout.ts) so the map always renders correctly and in the right
 * order regardless of what order Firestore happens to return documents in.
 *
 * Each entry in a section's `rows` is one of:
 *   - `paired`: a normal Left/Right row (optionally with `leftBox` /
 *     `rightBox` / `centerBox` decorative elements alongside the seats —
 *     e.g. Main Floor's OR/PR rows render a real (but seat-less) `rightBox`
 *     "Sound Control", and some Balcony rows carry a `centerBox` like
 *     "Control Room" or "EXIT 4").
 *   - `center`: a small standalone row with no Left/Right aisle split
 *     (the Balcony's "ML" row).
 */
export interface SeatMapPairedRow {
  kind: 'paired'
  rowLabel: string
  /** Seats on the left of the aisle, ordered outward-from-aisle (nearest-aisle seat last) so it renders next to the gap. */
  leftSeats: Seat[]
  /** Seats on the right of the aisle, ordered aisle-outward (nearest-aisle seat first) so it renders next to the gap. */
  rightSeats: Seat[]
  leftBox?: TheaterBoxConfig
  rightBox?: TheaterBoxConfig
  centerBox?: TheaterBoxConfig
}

export interface SeatMapCenterRow {
  kind: 'center'
  rowLabel: string
  seats: Seat[]
}

export type SeatMapRow = SeatMapPairedRow | SeatMapCenterRow

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
    rows: sectionConfig.rows.map((rowConfig): SeatMapRow => {
      if (rowConfig.kind === 'centerRow') {
        const start = rowConfig.startIndex ?? 1
        const rowSeats: Seat[] = []
        for (let i = start; i < start + rowConfig.seatCount; i++) {
          const seat = bySlot.get(`${sectionConfig.id}|${rowConfig.rowLabel}|Center|${i}`)
          if (seat) rowSeats.push(seat)
        }
        return { kind: 'center', rowLabel: rowConfig.rowLabel, seats: rowSeats }
      }

      const leftStart = rowConfig.leftStartIndex ?? 1
      const rightStart = rowConfig.rightStartIndex ?? 1

      const leftSeats: Seat[] = []
      for (let i = leftStart + rowConfig.leftCount - 1; i >= leftStart; i--) {
        const seat = bySlot.get(`${sectionConfig.id}|${rowConfig.rowLabel}|Left|${i}`)
        if (seat) leftSeats.push(seat)
      }
      const rightSeats: Seat[] = []
      for (let i = rightStart; i < rightStart + rowConfig.rightCount; i++) {
        const seat = bySlot.get(`${sectionConfig.id}|${rowConfig.rowLabel}|Right|${i}`)
        if (seat) rightSeats.push(seat)
      }
      return {
        kind: 'paired',
        rowLabel: rowConfig.rowLabel,
        leftSeats,
        rightSeats,
        leftBox: rowConfig.leftBox,
        rightBox: rowConfig.rightBox,
        centerBox: rowConfig.centerBox,
      }
    }),
  }))
}

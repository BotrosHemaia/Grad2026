import rawLayout from './theaterLayout.json'
import type { Seat, SeatSide, TheaterSection } from '../types/models'

/**
 * Single source of truth for the theater's physical seating layout.
 *
 * The raw numbers live in `theaterLayout.json` (plain data, so the seed
 * script — a standalone Node ESM script — can load the exact same file via
 * `fs.readFileSync` + `JSON.parse` without needing to run through Vite/TS).
 * This module wraps that JSON with typed helpers used by the React UI.
 *
 * Physical layout (per the venue's real seating chart):
 *   - Balcony: Row 1 has 4 seats left / 4 right; Rows 2-7 have 8 left / 8
 *     right; Rows 8-9 have 10 left / 10 right. Every row has a center
 *     aisle between its Left and Right blocks.
 *   - Main Floor: Rows 1-12 each have 12 seats left / 12 right, with a
 *     center aisle.
 *
 * Seat numbering: "<Section>-R<row>-<Side>-<index>", e.g.
 * "Balcony-R1-Left-1", "Main-R5-Right-12" — index 1 is always the seat
 * closest to the center aisle, counting outward toward the wall.
 */

export interface TheaterRowConfig {
  row: number
  leftCount: number
  rightCount: number
}

export interface TheaterSectionConfig {
  id: TheaterSection
  label: string
  rows: TheaterRowConfig[]
}

export const THEATER_LAYOUT: TheaterSectionConfig[] = rawLayout.sections as TheaterSectionConfig[]

/** Build the canonical seat_number label from its structured fields. */
export function buildSeatNumber(section: TheaterSection, row: number, side: SeatSide, seatIndex: number): string {
  return `${section}-R${row}-${side}-${seatIndex}`
}

/**
 * Generate the full list of seats for the configured layout, in a stable
 * reading order (section, then row, then Left block outward-from-aisle,
 * then Right block outward-from-aisle). Used by both the seed script logic
 * (conceptually mirrored in scripts/seedSeats.mjs) and anywhere the app
 * needs the "shape" of the venue without live Firestore data.
 */
export function generateSeatDefinitions(): Omit<Seat, 'id'>[] {
  const seats: Omit<Seat, 'id'>[] = []
  for (const section of THEATER_LAYOUT) {
    for (const rowConfig of section.rows) {
      const sides: { side: SeatSide; count: number }[] = [
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

/** Total seat count across the whole venue, per the current layout config. */
export function getTotalSeatCount(): number {
  return THEATER_LAYOUT.reduce(
    (sum, section) =>
      sum + section.rows.reduce((rowSum, r) => rowSum + r.leftCount + r.rightCount, 0),
    0
  )
}

import rawLayout from './theaterLayout.json'
import type { Seat, SeatSide, TheaterSection } from '../types/models'

/**
 * Single source of truth for the theater's physical seating layout.
 *
 * The raw structure lives in `theaterLayout.json` (plain data, so the seed
 * script — a standalone Node ESM script — can load the exact same file via
 * `fs.readFileSync` + `JSON.parse` without needing to run through Vite/TS).
 * This module wraps that JSON with typed helpers used by the React UI.
 *
 * The venue's real seating chart is **highly irregular** — every row is
 * hard-mapped explicitly in `theaterLayout.json` (letter label + exact
 * left/right seat counts + any exceptions), never derived from a
 * repeating pattern/formula. See that file for the literal per-row data;
 * this module only provides types + small generic helpers that walk it.
 *
 * Rendered top-to-bottom, matching the physical room:
 *   1. Balcony    (farthest from the stage, rendered at the very top)
 *   2. Main Floor (directly above the stage)
 *   3. Stage / Screen (rendered at the very bottom)
 * Section order in this config always follows that: Balcony first, then
 * Main. (The Stage/Screen banner itself is not part of this config — it's
 * a fixed decorative element rendered by TheaterSeatMap.tsx.)
 *
 * A section's `rows` array is a mix of three row "kinds":
 *   - `"row"`: a normal Left/Right paired row (e.g. Main Floor's "A".."P",
 *     Balcony's "A".."K"). `leftCount`/`rightCount` are independent so
 *     asymmetric rows (e.g. Balcony "JL":5 / "JR":4) are expressed
 *     directly. `leftStartIndex`/`rightStartIndex` (default 1) let a
 *     side's clickable seats start at a number other than 1 — used by
 *     Main Floor's "OR"/"PR", whose seats 1-3 don't exist and are instead
 *     covered by a `rightBox` (e.g. the red "Sound Control" box).
 *   - `"centerRow"`: a small standalone row with no Left/Right split,
 *     rendered in the center of the aisle (used only for the Balcony's
 *     "ML" row: 3 seats, no aisle).
 *   - A row can also carry a `centerBox` (decorative box rendered in the
 *     aisle gap instead of/alongside a centerRow, e.g. "Control Room",
 *     "EXIT 4") in addition to its seats.
 *
 * Seat numbering: "<Section>-<RowLabel><Side>-<index>", e.g.
 * "Balcony-AL-1", "Main-PR-4" (side abbreviated to L/R; the special
 * Balcony "ML" row seats are "Balcony-ML-1".."Balcony-ML-3", no side
 * suffix since it has no Left/Right split) — index counts outward from
 * the aisle (or, for OR/PR, starts at the configured `rightStartIndex`).
 */

/** A decorative, non-seat structural element rendered inline in the grid (e.g. "Sound Control", "Control Room", "EXIT 4"). */
export interface TheaterBoxConfig {
  /** Stable id, used as the React key. */
  id: string
  /** Visible label, e.g. "Sound Control". */
  label: string
  /** Color treatment for the box. */
  color: 'red' | 'navy' | 'green'
  /** How many seat-widths of visual space the box should span (defaults to 1). */
  span?: number
}

/** A normal Left/Right paired row. */
export interface TheaterPairedRowConfig {
  kind: 'row'
  /** Letter row label, e.g. "A", "P", "K". Unique within its section+side. */
  rowLabel: string
  leftCount: number
  rightCount: number
  /** First seat number on the left side (default 1). */
  leftStartIndex?: number
  /** First seat number on the right side (default 1). Used by OR/PR, which start at 4. */
  rightStartIndex?: number
  /** Decorative box rendered where the left side's missing seats would be. */
  leftBox?: TheaterBoxConfig
  /** Decorative box rendered where the right side's missing seats would be (e.g. OR/PR's "Sound Control"). */
  rightBox?: TheaterBoxConfig
  /** Decorative box rendered in the center aisle gap for this row (e.g. "Control Room", "EXIT 4"). */
  centerBox?: TheaterBoxConfig
}

/** A small standalone center row with no Left/Right aisle split (the Balcony's "ML" row). */
export interface TheaterCenterRowConfig {
  kind: 'centerRow'
  rowLabel: string
  seatCount: number
  /** First seat number (default 1). */
  startIndex?: number
}

export type TheaterRowConfig = TheaterPairedRowConfig | TheaterCenterRowConfig

export interface TheaterSectionConfig {
  id: TheaterSection
  label: string
  rows: TheaterRowConfig[]
}

export const THEATER_LAYOUT: TheaterSectionConfig[] = rawLayout.sections as TheaterSectionConfig[]

/**
 * Build the canonical seat_number label from its structured fields.
 * Side is abbreviated to a single letter (L/R); 'Center' rows (the
 * Balcony's "ML") omit the side suffix entirely since they have no
 * Left/Right split.
 */
export function buildSeatNumber(section: TheaterSection, row: string, side: SeatSide, seatIndex: number): string {
  if (side === 'Center') return `${section}-${row}-${seatIndex}`
  return `${section}-${row}${side === 'Left' ? 'L' : 'R'}-${seatIndex}`
}

/**
 * Generate the full list of seats for the configured layout, in a stable
 * reading order (section, then row as listed in the JSON config, then
 * Left block outward-from-aisle, then Right block outward-from-aisle;
 * centerRow seats in ascending order). Used by both the seed script logic
 * (mirrored in scripts/seedSeats.mjs) and anywhere the app needs the
 * "shape" of the venue without live Firestore data. Purely decorative
 * boxes (Sound Control / Control Room / EXIT 4) never produce seat
 * documents — they exist only in the layout config for rendering.
 */
export function generateSeatDefinitions(): Omit<Seat, 'id'>[] {
  const seats: Omit<Seat, 'id'>[] = []
  for (const section of THEATER_LAYOUT) {
    for (const rowConfig of section.rows) {
      if (rowConfig.kind === 'centerRow') {
        const start = rowConfig.startIndex ?? 1
        for (let i = start; i < start + rowConfig.seatCount; i++) {
          seats.push({
            seat_number: buildSeatNumber(section.id, rowConfig.rowLabel, 'Center', i),
            status: 'Available',
            reservation_id: null,
            section: section.id,
            row: rowConfig.rowLabel,
            side: 'Center',
            seat_index: i,
          })
        }
        continue
      }

      const leftStart = rowConfig.leftStartIndex ?? 1
      const rightStart = rowConfig.rightStartIndex ?? 1
      const sides: { side: SeatSide; start: number; count: number }[] = [
        { side: 'Left', start: leftStart, count: rowConfig.leftCount },
        { side: 'Right', start: rightStart, count: rowConfig.rightCount },
      ]
      for (const { side, start, count } of sides) {
        for (let i = start; i < start + count; i++) {
          seats.push({
            seat_number: buildSeatNumber(section.id, rowConfig.rowLabel, side, i),
            status: 'Available',
            reservation_id: null,
            section: section.id,
            row: rowConfig.rowLabel,
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
      sum +
      section.rows.reduce((rowSum, r) => {
        if (r.kind === 'centerRow') return rowSum + r.seatCount
        return rowSum + r.leftCount + r.rightCount
      }, 0),
    0
  )
}

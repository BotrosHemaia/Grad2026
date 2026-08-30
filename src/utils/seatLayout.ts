import type { Seat } from '../types/models'

/**
 * Groups a flat list of seats into rows for grid rendering.
 *
 * Assumes `seat_number` follows a "<RowLetter><Number>" convention, e.g.
 * "A1", "A2", ... "B1", "B2" (as produced by scripts/seedSeats.mjs).
 * Seats that don't match this pattern are grouped under a single
 * fallback row ("") so the grid still renders something sensible.
 *
 * @returns Array of { row, seats } sorted by row letter, seats sorted by
 * their numeric suffix.
 */
export interface SeatRow {
  row: string
  seats: Seat[]
}

const SEAT_NUMBER_PATTERN = /^([A-Za-z]*)(\d+)$/

export function groupSeatsByRow(seats: Seat[]): SeatRow[] {
  const rowMap = new Map<string, Seat[]>()

  for (const seat of seats) {
    const match = SEAT_NUMBER_PATTERN.exec(seat.seat_number)
    const row = match ? match[1] || '—' : '—'
    if (!rowMap.has(row)) rowMap.set(row, [])
    rowMap.get(row)!.push(seat)
  }

  const rows: SeatRow[] = Array.from(rowMap.entries()).map(([row, rowSeats]) => ({
    row,
    seats: rowSeats.slice().sort((a, b) => seatSortKey(a.seat_number) - seatSortKey(b.seat_number)),
  }))

  rows.sort((a, b) => a.row.localeCompare(b.row))
  return rows
}

function seatSortKey(seatNumber: string): number {
  const match = SEAT_NUMBER_PATTERN.exec(seatNumber)
  return match ? parseInt(match[2], 10) : Number.MAX_SAFE_INTEGER
}

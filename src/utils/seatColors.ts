import type { SeatStatus } from '../types/models'

/**
 * Shared Tailwind color classes for each seat status, per spec:
 *   Available -> green, Pending -> gray, Confirmed -> black, Blocked -> red
 *
 * Used by both the Guest seat grid and the Admin seat map so the color
 * coding always stays in sync.
 */
export const SEAT_STATUS_STYLES: Record<SeatStatus, string> = {
  Available: 'bg-green-500 text-white',
  Pending: 'bg-gray-400 text-white',
  Confirmed: 'bg-black text-white',
  Blocked: 'bg-red-500 text-white',
}

export const SEAT_STATUS_LEGEND: { label: string; status: SeatStatus }[] = [
  { label: 'Available', status: 'Available' },
  { label: 'Pending', status: 'Pending' },
  { label: 'Confirmed', status: 'Confirmed' },
  { label: 'Blocked (VIP)', status: 'Blocked' },
]

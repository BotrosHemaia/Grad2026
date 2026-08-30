import type { Seat as SeatModel } from '../types/models'
import { SEAT_STATUS_STYLES } from '../utils/seatColors'

interface SeatProps {
  seat: SeatModel
  isSelected: boolean
  disabled: boolean
  onToggle: (seat: SeatModel) => void
}

/**
 * Single clickable seat cell in the guest-facing theater grid.
 *
 * Color coding (per spec, see utils/seatColors.ts):
 *   Available -> green, Pending -> gray, Confirmed -> black, Blocked -> red
 *
 * Only 'Available' seats are interactive. A selected seat gets a blue ring
 * so guests can see their current picks at a glance.
 */
export default function Seat({ seat, isSelected, disabled, onToggle }: SeatProps) {
  const isClickable = seat.status === 'Available' && !disabled

  const handleClick = () => {
    if (!isClickable) return
    onToggle(seat)
  }

  return (
    <button
      type="button"
      id={`seat-${seat.id}`}
      onClick={handleClick}
      disabled={!isClickable}
      aria-pressed={isSelected}
      aria-label={`Seat ${seat.seat_number} — ${seat.status}${isSelected ? ' — selected' : ''}`}
      title={`Seat ${seat.seat_number} — ${seat.status}`}
      className={[
        'w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-md text-xs font-semibold flex items-center justify-center transition-transform',
        SEAT_STATUS_STYLES[seat.status],
        seat.status === 'Available' ? 'hover:bg-green-600' : '',
        isSelected ? 'ring-4 ring-blue-500 ring-offset-1 scale-105' : '',
        isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-90',
      ].join(' ')}
    >
      {seat.seat_number}
    </button>
  )
}

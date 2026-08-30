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
        'w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-md text-[10px] sm:text-xs font-semibold flex items-center justify-center',
        'transition-all duration-150 ease-out',
        SEAT_STATUS_STYLES[seat.status],
        seat.status === 'Available' ? 'hover:bg-green-600 hover:shadow-md hover:shadow-green-500/40' : '',
        isSelected ? 'ring-4 ring-gold-500 ring-offset-1 scale-110 shadow-gold-glow' : '',
        isClickable ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-not-allowed opacity-90',
      ].join(' ')}
    >
      {seat.seat_index}
    </button>
  )
}

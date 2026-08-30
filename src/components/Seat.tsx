import type { Seat as SeatModel } from '../types/models'

interface SeatProps {
  seat: SeatModel
  isSelected: boolean
  disabled: boolean
  onToggle: (seat: SeatModel) => void
}

/**
 * Single clickable seat cell in the theater grid.
 *
 * Color coding (per spec):
 *   Available -> green
 *   Pending   -> gray
 *   Confirmed -> black
 *   Blocked   -> red
 *
 * Only 'Available' seats are interactive. A selected seat gets a blue ring
 * so guests can see their current picks at a glance.
 */
const STATUS_STYLES: Record<SeatModel['status'], string> = {
  Available: 'bg-green-500 hover:bg-green-600 text-white cursor-pointer',
  Pending: 'bg-gray-400 text-white cursor-not-allowed',
  Confirmed: 'bg-black text-white cursor-not-allowed',
  Blocked: 'bg-red-500 text-white cursor-not-allowed',
}

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
        STATUS_STYLES[seat.status],
        isSelected ? 'ring-4 ring-blue-500 ring-offset-1 scale-105' : '',
        isClickable ? 'hover:scale-105' : 'opacity-90',
      ].join(' ')}
    >
      {seat.seat_number}
    </button>
  )
}

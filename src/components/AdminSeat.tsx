import type { Seat as SeatModel, Reservation } from '../types/models'
import { SEAT_STATUS_STYLES } from '../utils/seatColors'

interface AdminSeatProps {
  seat: SeatModel
  /** Block/Unblock toggle mode is active. */
  blockModeOn: boolean
  /** True while this specific seat's block/unblock request is in flight. */
  isUpdating: boolean
  onClick: (seat: SeatModel) => void
  /** The reservation currently holding this seat, if any (Pending/Confirmed). */
  reservation?: Reservation
}

/**
 * Single seat cell for the Admin Dashboard's live map view.
 *
 * Always reflects the real-time color of the seat's status. When
 * "Block Mode" is on, 'Available' and 'Blocked' seats become clickable so
 * the admin can toggle VIP blocking; 'Pending' and 'Confirmed' seats stay
 * non-interactive here (manage those via the reservations table instead).
 *
 * For 'Pending'/'Confirmed' seats, the hover tooltip shows the reserving
 * guest's name and phone so admins can always tell who booked which seat —
 * even after it's been approved and no longer appears in the Pending table.
 */
export default function AdminSeat({ seat, blockModeOn, isUpdating, onClick, reservation }: AdminSeatProps) {
  const isToggleable = blockModeOn && (seat.status === 'Available' || seat.status === 'Blocked')
  const isClickable = isToggleable && !isUpdating

  const tooltip = reservation
    ? `Seat ${seat.seat_number} — ${seat.status} — ${reservation.guest_name} (${reservation.phone_number})`
    : `Seat ${seat.seat_number} — ${seat.status}${isToggleable ? ' (click to toggle Block)' : ''}`

  return (
    <button
      type="button"
      id={`admin-seat-${seat.id}`}
      onClick={() => isClickable && onClick(seat)}
      disabled={!isClickable}
      title={tooltip}
      className={[
        'w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-md text-[10px] sm:text-xs font-semibold flex items-center justify-center transition-transform',
        SEAT_STATUS_STYLES[seat.status],
        isToggleable ? 'ring-2 ring-offset-1 ring-yellow-400' : '',
        isClickable ? 'cursor-pointer hover:scale-105' : '',
        isUpdating ? 'opacity-50 animate-pulse' : '',
        !isToggleable && blockModeOn ? 'opacity-60' : '',
      ].join(' ')}
    >
      {seat.seat_index}
    </button>
  )
}

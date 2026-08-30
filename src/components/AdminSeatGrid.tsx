import type { Seat as SeatModel, Reservation } from '../types/models'
import AdminSeat from './AdminSeat'
import TheaterSeatMap from './TheaterSeatMap'

interface AdminSeatGridProps {
  seats: SeatModel[]
  blockModeOn: boolean
  updatingSeatIds: Set<string>
  onToggleSeat: (seat: SeatModel) => void
  /** Map<seatId, Reservation> — used to show "who booked this seat" tooltips. */
  reservationsBySeatId: Map<string, Reservation>
}

/**
 * Full theater map for the Admin Dashboard (Balcony + Main Floor, each with
 * a center aisle — see TheaterSeatMap for the shared physical layout).
 * Renders every seat with its live, real-time color
 * (Available/Pending/Confirmed/Blocked). When Block Mode is on, clicking
 * an Available seat blocks it and clicking a Blocked seat unblocks it.
 */
export default function AdminSeatGrid({
  seats,
  blockModeOn,
  updatingSeatIds,
  onToggleSeat,
  reservationsBySeatId,
}: AdminSeatGridProps) {
  return (
    <div id="admin-seat-grid">
      <TheaterSeatMap
        seats={seats}
        renderSeat={(seat) => (
          <AdminSeat
            seat={seat}
            blockModeOn={blockModeOn}
            isUpdating={updatingSeatIds.has(seat.id!)}
            onClick={onToggleSeat}
            reservation={seat.id ? reservationsBySeatId.get(seat.id) : undefined}
          />
        )}
      />
    </div>
  )
}

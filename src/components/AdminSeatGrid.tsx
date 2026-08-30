import type { Seat as SeatModel, Reservation } from '../types/models'
import AdminSeat from './AdminSeat'
import { groupSeatsByRow } from '../utils/seatLayout'

interface AdminSeatGridProps {
  seats: SeatModel[]
  blockModeOn: boolean
  updatingSeatIds: Set<string>
  onToggleSeat: (seat: SeatModel) => void
  /** Map<seatId, Reservation> — used to show "who booked this seat" tooltips. */
  reservationsBySeatId: Map<string, Reservation>
}

/**
 * Full theater map for the Admin Dashboard. Renders every seat with its
 * live, real-time color (Available/Pending/Confirmed/Blocked). When Block
 * Mode is on, clicking an Available seat blocks it and clicking a Blocked
 * seat unblocks it.
 */
export default function AdminSeatGrid({
  seats,
  blockModeOn,
  updatingSeatIds,
  onToggleSeat,
  reservationsBySeatId,
}: AdminSeatGridProps) {
  const rows = groupSeatsByRow(seats)

  if (seats.length === 0) {
    return <p className="text-center text-gray-500 py-8">No seats have been set up yet.</p>
  }

  return (
    <div id="admin-seat-grid" className="flex flex-col items-center gap-2 py-4 overflow-x-auto">
      <div className="mb-2 px-6 py-1.5 bg-gray-200 rounded-full text-xs uppercase tracking-widest text-gray-600">
        Stage / Screen
      </div>

      {rows.map(({ row, seats: rowSeats }) => (
        <div key={row} className="flex items-center gap-2">
          <span className="w-5 text-xs font-semibold text-gray-500 text-right">{row}</span>
          <div className="flex gap-1.5 sm:gap-2">
            {rowSeats.map((seat) => (
              <AdminSeat
                key={seat.id}
                seat={seat}
                blockModeOn={blockModeOn}
                isUpdating={updatingSeatIds.has(seat.id!)}
                onClick={onToggleSeat}
                reservation={seat.id ? reservationsBySeatId.get(seat.id) : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

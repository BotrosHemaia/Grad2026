import type { Seat as SeatModel } from '../types/models'
import SeatComponent from './Seat'
import { groupSeatsByRow } from '../utils/seatLayout'
import { MAX_SEATS_PER_BOOKING } from '../config/eventConfig'

interface SeatGridProps {
  seats: SeatModel[]
  selectedSeatIds: string[]
  onToggleSeat: (seat: SeatModel) => void
  submitting: boolean
}

/**
 * Visual grid map of numbered theater seats, grouped into rows.
 * Only 'Available' seats are clickable; selection is capped at
 * MAX_SEATS_PER_BOOKING (enforced both here for the disabled state and in
 * the parent's onToggleSeat handler for the actual selection logic).
 */
export default function SeatGrid({ seats, selectedSeatIds, onToggleSeat, submitting }: SeatGridProps) {
  const rows = groupSeatsByRow(seats)
  const maxReached = selectedSeatIds.length >= MAX_SEATS_PER_BOOKING

  if (seats.length === 0) {
    return <p className="text-center text-gray-500 py-8">No seats have been set up yet.</p>
  }

  return (
    <div id="seat-grid" className="flex flex-col items-center gap-2 py-4 overflow-x-auto">
      <div className="mb-2 px-6 py-1.5 bg-gray-200 rounded-full text-xs uppercase tracking-widest text-gray-600">
        Stage / Screen
      </div>

      {rows.map(({ row, seats: rowSeats }) => (
        <div key={row} className="flex items-center gap-2">
          <span className="w-5 text-xs font-semibold text-gray-500 text-right">{row}</span>
          <div className="flex gap-1.5 sm:gap-2">
            {rowSeats.map((seat) => {
              const isSelected = selectedSeatIds.includes(seat.id!)
              // Disable further selection of *other* available seats once the
              // cap is reached (a seat that is already selected must stay
              // clickable so the guest can deselect it).
              const disabled = submitting || (maxReached && !isSelected)
              return (
                <SeatComponent
                  key={seat.id}
                  seat={seat}
                  isSelected={isSelected}
                  disabled={disabled}
                  onToggle={onToggleSeat}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

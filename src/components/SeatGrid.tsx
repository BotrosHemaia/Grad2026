import type { Seat as SeatModel } from '../types/models'
import SeatComponent from './Seat'
import TheaterSeatMap from './TheaterSeatMap'
import { MAX_SEATS_PER_BOOKING } from '../config/eventConfig'

interface SeatGridProps {
  seats: SeatModel[]
  selectedSeatIds: string[]
  onToggleSeat: (seat: SeatModel) => void
  submitting: boolean
}

/**
 * Visual grid map of the theater (Balcony + Main Floor, each with a center
 * aisle) — see TheaterSeatMap for the shared physical layout. Only
 * 'Available' seats are clickable; selection is capped at
 * MAX_SEATS_PER_BOOKING (enforced both here for the disabled state and in
 * the parent's onToggleSeat handler for the actual selection logic).
 */
export default function SeatGrid({ seats, selectedSeatIds, onToggleSeat, submitting }: SeatGridProps) {
  const maxReached = selectedSeatIds.length >= MAX_SEATS_PER_BOOKING

  return (
    <div id="seat-grid">
      <TheaterSeatMap
        seats={seats}
        renderSeat={(seat) => {
          const isSelected = selectedSeatIds.includes(seat.id!)
          // Disable further selection of *other* available seats once the
          // cap is reached (a seat that is already selected must stay
          // clickable so the guest can deselect it).
          const disabled = submitting || (maxReached && !isSelected)
          return (
            <SeatComponent
              seat={seat}
              isSelected={isSelected}
              disabled={disabled}
              onToggle={onToggleSeat}
            />
          )
        }}
      />
    </div>
  )
}

import type { ReactNode } from 'react'
import type { Seat } from '../types/models'
import { buildTheaterSeatMap } from '../utils/seatLayout'

interface TheaterSeatMapProps {
  seats: Seat[]
  /** Renders a single seat cell (guest's clickable Seat or admin's AdminSeat). */
  renderSeat: (seat: Seat) => ReactNode
}

/**
 * Shared visual structure for the theater seat map, used by both the guest
 * booking page and the Admin Dashboard so the two views always render an
 * identical physical layout (only the individual seat cell — clickable vs.
 * admin-toggleable — differs, via the `renderSeat` render-prop).
 *
 * Renders the venue's real layout top-to-bottom, matching the physical
 * room (Stage/Screen at the front, Main Floor right in front of it,
 * Balcony behind/further from the stage):
 *   1. Main Floor (Rows 1-12, front to back: 12+12 seats each)
 *   2. Balcony    (Rows 1-9, front [nearest Main Floor] to back:
 *                  Rows 1-2: 10+10; Rows 3-8: 8+8; Row 9: 4+4)
 * Each row shows its Left seat block, a visible center-aisle gap, then its
 * Right seat block — mirroring the physical aisle that splits the venue.
 * Section order simply follows `THEATER_LAYOUT` (see theaterLayout.ts), so
 * changing that config's array order changes the rendered order too.
 */
export default function TheaterSeatMap({ seats, renderSeat }: TheaterSeatMapProps) {
  const sections = buildTheaterSeatMap(seats)

  if (seats.length === 0) {
    return <p className="text-center text-gray-500 py-8">No seats have been set up yet.</p>
  }

  return (
    <div id="theater-seat-map" className="flex flex-col items-center gap-8 py-4 overflow-x-auto">
      <div className="px-6 py-1.5 bg-gray-800 text-white rounded-full text-xs uppercase tracking-widest">
        Stage / Screen
      </div>

      {sections.map((section) => (
        <section
          key={section.id}
          id={`theater-section-${section.id}`}
          aria-label={section.label}
          className="flex flex-col items-center gap-2 w-full"
        >
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 border-b-2 border-gray-300 pb-1 px-4">
            {section.label}
          </h3>

          <div className="flex flex-col items-center gap-1">
            {section.rows.map((row) => (
              <div key={row.row} className="flex items-center gap-1">
                <span className="w-9 shrink-0 text-[10px] font-semibold text-gray-400 text-right">
                  R{row.row}
                </span>

                {/* Left block: rendered outward-from-aisle already, so the
                    first item here is farthest from the aisle and the last
                    item sits right next to the gap. */}
                <div className="flex gap-1">
                  {row.leftSeats.map((seat) => (
                    <span key={seat.id}>{renderSeat(seat)}</span>
                  ))}
                </div>

                {/* Center aisle — a visible gap (with a faint divider line)
                    representing the physical walkway between the Left and
                    Right seat blocks. */}
                <div
                  className="w-5 sm:w-6 h-6 shrink-0 flex items-center justify-center"
                  aria-hidden="true"
                  title="Aisle"
                >
                  <div className="w-px h-full border-l border-dashed border-gray-300" />
                </div>

                {/* Right block: index 1 (nearest aisle) first. */}
                <div className="flex gap-1">
                  {row.rightSeats.map((seat) => (
                    <span key={seat.id}>{renderSeat(seat)}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

import type { ReactNode } from 'react'
import type { Seat } from '../types/models'
import { buildTheaterSeatMap } from '../utils/seatLayout'
import type { TheaterBoxConfig } from '../config/theaterLayout'

interface TheaterSeatMapProps {
  seats: Seat[]
  /** Renders a single seat cell (guest's clickable Seat or admin's AdminSeat). */
  renderSeat: (seat: Seat) => ReactNode
}

/** Tailwind classes for a decorative structural box, keyed by its configured color. */
const BOX_COLOR_STYLES: Record<TheaterBoxConfig['color'], string> = {
  red: 'bg-red-500 text-white border-red-600',
  navy: 'bg-navy-800 text-white border-navy-900',
  green: 'bg-emerald-600 text-white border-emerald-700',
}

/** A decorative, non-seat structural element (Sound Control / Control Room / EXIT 4). */
function StructuralBox({ box, sizeClass }: { box: TheaterBoxConfig; sizeClass: string }) {
  return (
    <div
      id={`theater-box-${box.id}`}
      title={box.label}
      className={[
        sizeClass,
        'shrink-0 rounded-md border text-[9px] sm:text-[10px] font-bold uppercase tracking-tight flex items-center justify-center text-center leading-tight px-1',
        BOX_COLOR_STYLES[box.color],
      ].join(' ')}
    >
      {box.label}
    </div>
  )
}

/** Width of one seat slot (must match Seat.tsx / AdminSeat.tsx's own w-7/w-8 sizing) used to size boxes that span N seat-widths. */
const SEAT_SLOT_CLASS = 'w-7 sm:w-8 h-7 sm:h-8'

function boxSizeClass(box: TheaterBoxConfig) {
  const span = box.span ?? 1
  if (span <= 1) return SEAT_SLOT_CLASS
  // Approximate N seat-widths + the small gaps between them (gap-1 = 0.25rem).
  return `${SEAT_SLOT_CLASS} min-w-[${span * 2}rem]`
}

/**
 * Shared visual structure for the theater seat map, used by both the guest
 * booking page and the Admin Dashboard so the two views always render an
 * identical physical layout (only the individual seat cell — clickable vs.
 * admin-toggleable — differs, via the `renderSeat` render-prop).
 *
 * Renders the venue's real layout top-to-bottom, matching the physical
 * room as viewed from behind the last row looking toward the stage:
 *   1. Balcony    (farthest from the stage, rendered at the very top)
 *   2. Main Floor (directly above/in front of the stage)
 *   3. Stage / Screen banner (rendered at the very bottom, last)
 * This is the *reverse* of a naive "stage first" rendering — intentional,
 * since the venue's Balcony sits physically above and behind the Main
 * Floor, which itself sits in front of the stage.
 *
 * Each row renders its Left seat block, a visible center-aisle gap
 * (which may also host a decorative `centerBox`, e.g. "Control Room" /
 * "EXIT 4"), then its Right seat block. A row's Left/Right box (e.g. the
 * Main Floor's OR/PR "Sound Control" box) renders inline within that
 * side's seat block, occupying the visual space where seats 1-3 would be.
 * The Balcony's standalone "ML" row (no aisle split) renders as its own
 * centered mini-row between the two structural boxes.
 */
export default function TheaterSeatMap({ seats, renderSeat }: TheaterSeatMapProps) {
  const sections = buildTheaterSeatMap(seats)
  // Render Balcony above Main Floor, regardless of THEATER_LAYOUT's own
  // (data) order — keeps this render-order decision explicit and local to
  // the UI layer rather than implicitly relying on JSON array order.
  const orderedSections = [...sections].sort((a, b) => (a.id === 'Balcony' ? -1 : b.id === 'Balcony' ? 1 : 0))

  if (seats.length === 0) {
    return <p className="text-center text-gray-500 py-8">No seats have been set up yet.</p>
  }

  return (
    <div>
      {/* Mobile swipe hint — only visible on small screens, hints that the
          map below can be scrolled horizontally. Purely decorative. */}
      <p className="sm:hidden flex items-center justify-center gap-1.5 text-[11px] text-navy-400 font-medium mb-2">
        <i className="fas fa-arrow-left" aria-hidden="true"></i>
        Swipe to see all seats
        <i className="fas fa-arrow-right" aria-hidden="true"></i>
      </p>

      <div
        id="theater-seat-map"
        className="flex flex-col items-center gap-8 py-4 overflow-x-auto scroll-touch thin-scrollbar"
      >
        <div className="min-w-max flex flex-col items-center gap-8 w-full px-1">
          {orderedSections.map((section) => (
            <section
              key={section.id}
              id={`theater-section-${section.id}`}
              aria-label={section.label}
              className="flex flex-col items-center gap-2 w-full"
            >
              <h3 className="text-sm font-bold uppercase tracking-widest text-navy-700 border-b-2 border-gold-400 pb-1 px-4">
                {section.label}
              </h3>

              <div className="flex flex-col items-center gap-1">
                {section.rows.map((row) => {
                  if (row.kind === 'center') {
                    // Standalone center row (Balcony's "ML") — no Left/Right
                    // split, no aisle gap; render centered above/below the
                    // paired rows via normal flex flow (position in the
                    // JSON array controls where it lands visually).
                    return (
                      <div key={row.rowLabel} className="flex items-center gap-1">
                        <span className="w-9 shrink-0 text-[10px] font-semibold text-navy-300 text-right">
                          {row.rowLabel}
                        </span>
                        <div className="flex gap-1">
                          {row.seats.map((seat) => (
                            <span key={seat.id}>{renderSeat(seat)}</span>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={row.rowLabel} className="flex items-center gap-1">
                      <span className="w-9 shrink-0 text-[10px] font-semibold text-navy-300 text-right">
                        {row.rowLabel}L
                      </span>

                      {/* Left block: rendered outward-from-aisle already, so the
                          first item here is farthest from the aisle and the last
                          item sits right next to the gap. An optional leftBox
                          (structural element) renders alongside the seats. */}
                      <div className="flex gap-1">
                        {row.leftBox && <StructuralBox box={row.leftBox} sizeClass={boxSizeClass(row.leftBox)} />}
                        {row.leftSeats.map((seat) => (
                          <span key={seat.id}>{renderSeat(seat)}</span>
                        ))}
                      </div>

                      {/* Center aisle — a visible gap (with a faint divider line)
                          representing the physical walkway between the Left and
                          Right seat blocks. May host a decorative centerBox
                          (e.g. "Control Room", "EXIT 4") instead of an empty gap. */}
                      <div
                        className="w-5 sm:w-6 h-6 shrink-0 flex items-center justify-center"
                        aria-hidden={!row.centerBox}
                        title={row.centerBox ? row.centerBox.label : 'Aisle'}
                      >
                        {row.centerBox ? (
                          <StructuralBox box={row.centerBox} sizeClass="w-16 sm:w-20 h-6" />
                        ) : (
                          <div className="w-px h-full border-l border-dashed border-navy-200" />
                        )}
                      </div>

                      {/* Right block: index 1 (nearest aisle) first. An optional
                          rightBox (e.g. Main Floor OR/PR's "Sound Control")
                          renders first, occupying the space of the missing
                          low-numbered seats, followed by the real seats. */}
                      <div className="flex gap-1">
                        {row.rightBox && <StructuralBox box={row.rightBox} sizeClass={boxSizeClass(row.rightBox)} />}
                        {row.rightSeats.map((seat) => (
                          <span key={seat.id}>{renderSeat(seat)}</span>
                        ))}
                      </div>

                      <span className="w-9 shrink-0 text-[10px] font-semibold text-navy-300 text-left">
                        {row.rowLabel}R
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}

          <div className="px-8 py-2 bg-navy-900 text-white rounded-full text-xs uppercase tracking-widest shadow-navy-lg flex items-center gap-2">
            <i className="fas fa-film text-gold-400" aria-hidden="true"></i>
            Stage / Screen
          </div>
        </div>
      </div>
    </div>
  )
}

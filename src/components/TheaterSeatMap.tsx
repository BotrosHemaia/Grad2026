import type { CSSProperties, ReactNode } from 'react'
import type { Seat } from '../types/models'
import { buildTheaterSeatMap, type SeatMapPairedRow } from '../utils/seatLayout'
import type { TheaterBoxConfig } from '../config/theaterLayout'

interface TheaterSeatMapProps {
  seats: Seat[]
  renderSeat: (seat: Seat) => ReactNode
}

const BOX_COLOR_STYLES: Record<TheaterBoxConfig['color'], string> = {
  red: 'bg-red-600 text-white border-red-700',
  navy: 'bg-gray-300 text-navy-950 border-navy-900',
  green: 'bg-gray-300 text-navy-950 border-navy-900',
}

const blockWidth = (span = 1) => `calc(${span} * var(--seat-size) + ${Math.max(0, span - 1)} * var(--seat-gap))`
const blockHeight = (rowSpan = 1) =>
  `calc(${rowSpan} * var(--seat-size) + ${Math.max(0, rowSpan - 1)} * var(--row-gap))`

function StructuralBox({ box }: { box: TheaterBoxConfig }) {
  const style: CSSProperties = {
    width: blockWidth(box.span),
    height: blockHeight(box.rowSpan),
  }

  return (
    <div
      id={`theater-box-${box.id}`}
      title={box.label}
      style={style}
      className={[
        'relative z-10 shrink-0 border-2 text-xs sm:text-sm font-semibold',
        'flex items-center justify-center text-center leading-tight px-1',
        BOX_COLOR_STYLES[box.color],
      ].join(' ')}
    >
      {box.label}
    </div>
  )
}

/**
 * Keeps a multi-row box out of normal flex sizing. The slot has exactly one
 * seat row's height, while the absolutely positioned box may extend across
 * subsequent rows. This preserves the normal row-gap between adjacent seats.
 */
function StructuralBoxSlot({ box }: { box: TheaterBoxConfig }) {
  return (
    <div
      className="relative shrink-0 self-start"
      style={{ width: blockWidth(box.span), height: 'var(--seat-size)' }}
    >
      <div className="absolute left-0 top-0">
        <StructuralBox box={box} />
      </div>
    </div>
  )
}

function MissingSeatSpacer({ count }: { count: number }) {
  if (count <= 0) return null
  return <span aria-hidden="true" className="shrink-0" style={{ width: blockWidth(count) }} />
}

function PairedRow({
  row,
  sectionId,
  renderSeat,
}: {
  row: SeatMapPairedRow
  sectionId: 'Main' | 'Balcony'
  renderSeat: (seat: Seat) => ReactNode
}) {
  const rightStart = row.rightSeats[0]?.seat_index ?? 1
  const centerWidth = sectionId === 'Balcony' ? 'w-36 sm:w-44' : 'w-20 sm:w-28'

  return (
    <div className="flex items-start gap-2 h-7 sm:h-8">
      {/* Left side: descending seats, then its label at the inner edge. */}
      <div className="w-[26.25rem] sm:w-[29.25rem] shrink-0 flex justify-end items-center gap-1">
        {row.leftBox && <StructuralBoxSlot box={row.leftBox} />}
        {row.leftSeats.map((seat) => <span key={seat.id}>{renderSeat(seat)}</span>)}
        <span className="w-8 ml-1 shrink-0 text-sm font-medium text-navy-500 text-left">
          {row.rowLabel}L
        </span>
      </div>

      <div
        className={`${centerWidth} relative h-7 sm:h-8 shrink-0 flex items-start justify-center`}
        aria-label="Central aisle"
      >
        {row.centerBox ? <StructuralBoxSlot box={row.centerBox} /> : null}
      </div>

      {/* Right side: its label at the inner edge, then ascending seats.
          For OR/PR, the Mixer/spacer occupies positions 1–3 after OR/PR. */}
      <div className="w-[26.25rem] sm:w-[29.25rem] shrink-0 flex justify-start items-center gap-1">
        <span className="w-8 mr-1 shrink-0 text-sm font-medium text-navy-500 text-right">
          {row.rowLabel}R
        </span>
        {row.rightBox ? <StructuralBoxSlot box={row.rightBox} /> : <MissingSeatSpacer count={rightStart - 1} />}
        {row.rightSeats.map((seat) => <span key={seat.id}>{renderSeat(seat)}</span>)}
      </div>

    </div>
  )
}

export default function TheaterSeatMap({ seats, renderSeat }: TheaterSeatMapProps) {
  const sections = buildTheaterSeatMap(seats)

  if (seats.length === 0) {
    return <p className="text-center text-gray-500 py-8">No seats have been set up yet.</p>
  }

  return (
    <div>
      <p className="sm:hidden flex items-center justify-center gap-1.5 text-[11px] text-navy-400 font-medium mb-2">
        <i className="fas fa-arrow-left" aria-hidden="true" />
        Swipe to see all seats
        <i className="fas fa-arrow-right" aria-hidden="true" />
      </p>

      <div
        id="theater-seat-map"
        className="w-full overflow-x-auto lg:overflow-x-visible scroll-touch thin-scrollbar lg:[scrollbar-width:none] pb-4"
      >
        <div
          className="min-w-max lg:min-w-0 lg:w-full flex flex-col items-center px-2 [--seat-size:1.75rem] sm:[--seat-size:2rem] [--seat-gap:0.25rem] [--row-gap:0.25rem]"
        >
          <div className="w-72 sm:w-96 h-14 mb-8 bg-gray-300 border-2 border-navy-900 text-navy-900 text-xl flex items-center justify-center">
            Stage
          </div>

          {sections.map((section, sectionIndex) => (
            <section
              key={section.id}
              id={`theater-section-${section.id}`}
              aria-label={section.label}
              className={sectionIndex === 0 ? 'flex flex-col items-center' : 'flex flex-col items-center mt-12'}
            >
              {section.id !== 'Main' && (
                <h3 className="w-72 sm:w-[40rem] mb-5 py-2 bg-gray-200 border-2 border-navy-800 text-center text-xl sm:text-2xl font-semibold text-navy-900">
                  {section.label}
                </h3>
              )}

              <div className="flex flex-col gap-1">
                {section.rows.map((row) => {
                  if (row.kind === 'center') {
                    return (
                      <div key={row.rowLabel} className="h-7 sm:h-8 flex items-center justify-center gap-3">
                        <div className="flex gap-1">
                          {row.seats.map((seat) => <span key={seat.id}>{renderSeat(seat)}</span>)}
                        </div>
                        <span className="text-sm font-medium text-navy-500">{row.rowLabel}</span>
                      </div>
                    )
                  }

                  return (
                    <PairedRow
                      key={row.rowLabel}
                      row={row}
                      sectionId={section.id}
                      renderSeat={renderSeat}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

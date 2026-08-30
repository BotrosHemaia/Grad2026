import { SEAT_STATUS_STYLES, SEAT_STATUS_LEGEND } from '../utils/seatColors'

/** Static color-coding legend shown above/below any seat grid. */
export default function SeatLegend() {
  return (
    <div id="seat-legend" className="flex flex-wrap items-center gap-4 sm:gap-5 justify-center py-2">
      {SEAT_STATUS_LEGEND.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`w-4 h-4 rounded-md inline-block shadow-sm ${SEAT_STATUS_STYLES[item.status]}`} />
          <span className="text-sm text-navy-700 font-medium">{item.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 rounded-md inline-block bg-green-500 ring-4 ring-gold-500 ring-offset-1" />
        <span className="text-sm text-navy-700 font-medium">Selected</span>
      </div>
    </div>
  )
}

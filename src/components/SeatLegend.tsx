/** Static color-coding legend shown above/below the seat grid. */
export default function SeatLegend() {
  const items: { label: string; colorClass: string }[] = [
    { label: 'Available', colorClass: 'bg-green-500' },
    { label: 'Pending', colorClass: 'bg-gray-400' },
    { label: 'Confirmed', colorClass: 'bg-black' },
    { label: 'Blocked (VIP)', colorClass: 'bg-red-500' },
  ]

  return (
    <div id="seat-legend" className="flex flex-wrap items-center gap-4 justify-center py-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`w-4 h-4 rounded-md inline-block ${item.colorClass}`} />
          <span className="text-sm text-gray-700">{item.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 rounded-md inline-block bg-green-500 ring-4 ring-blue-500 ring-offset-1" />
        <span className="text-sm text-gray-700">Selected</span>
      </div>
    </div>
  )
}

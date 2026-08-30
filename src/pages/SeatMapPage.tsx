import { useEffect, useState } from 'react'
import type { Seat } from '../types/models'
import { subscribeToSeats } from '../services/seatService'

/**
 * Placeholder page that subscribes to the `seats` collection in realtime.
 * This proves the Firebase data layer is wired correctly. Replace the
 * rendering below with the actual seat-grid UI later.
 */
export default function SeatMapPage() {
  const [seats, setSeats] = useState<Seat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToSeats((data) => {
      setSeats(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  if (loading) return <p>Loading seats…</p>

  return (
    <div id="seat-map-placeholder">
      <h2>Seat Map ({seats.length} seats)</h2>
      <ul id="seat-list">
        {seats.map((seat) => (
          <li key={seat.id}>
            {seat.seat_number} — {seat.status}
          </li>
        ))}
      </ul>
    </div>
  )
}

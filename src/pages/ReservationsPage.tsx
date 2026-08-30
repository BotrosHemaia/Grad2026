import { useEffect, useState } from 'react'
import type { Reservation } from '../types/models'
import { subscribeToReservations } from '../services/reservationService'

/**
 * Placeholder page that subscribes to the `reservations` collection in
 * realtime. This proves the Firebase data layer is wired correctly.
 * Replace the rendering below with the actual reservation form / list UI
 * later.
 */
export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToReservations((data) => {
      setReservations(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  if (loading) return <p>Loading reservations…</p>

  return (
    <div id="reservations-placeholder">
      <h2>Reservations ({reservations.length})</h2>
      <ul id="reservation-list">
        {reservations.map((r) => (
          <li key={r.id}>
            {r.guest_name} — {r.seat_ids.length} seat(s) — {r.payment_method}
          </li>
        ))}
      </ul>
    </div>
  )
}

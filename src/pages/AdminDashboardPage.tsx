import { useEffect, useMemo, useState } from 'react'
import type { Seat, Reservation } from '../types/models'
import { subscribeToSeats, blockSeat, unblockSeat } from '../services/seatService'
import {
  subscribeToReservations,
  confirmReservation,
  cancelReservation,
} from '../services/reservationService'
import { adminSignOut } from '../services/authService'
import AdminSeatGrid from '../components/AdminSeatGrid'
import SeatLegend from '../components/SeatLegend'
import ReservationsTable from '../components/ReservationsTable'
import { getReservationStatus, indexSeatsById } from '../utils/reservationStatus'

/**
 * Admin Dashboard: real-time theater map + VIP block/unblock toggle mode +
 * pending-reservations management (Approve / Cancel).
 *
 * All reads are realtime Firestore subscriptions (`onSnapshot`), so any
 * change made here — or by a guest booking seats concurrently, or by
 * another admin — reflects instantly across every open tab/device without
 * a manual refresh.
 */
export default function AdminDashboardPage() {
  const [seats, setSeats] = useState<Seat[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const [blockModeOn, setBlockModeOn] = useState(false)
  const [updatingSeatIds, setUpdatingSeatIds] = useState<Set<string>>(new Set())
  const [seatActionError, setSeatActionError] = useState<string | null>(null)

  const [processingReservationIds, setProcessingReservationIds] = useState<Set<string>>(new Set())
  const [reservationActionError, setReservationActionError] = useState<string | null>(null)

  useEffect(() => {
    const unsubSeats = subscribeToSeats(
      (data) => {
        setSeats(data)
        setLoading(false)
      },
      (error) => {
        console.error('Failed to subscribe to seats:', error)
        setConnectionError('Could not load the seat map. Please check your connection.')
        setLoading(false)
      }
    )
    const unsubReservations = subscribeToReservations((data) => setReservations(data))
    return () => {
      unsubSeats()
      unsubReservations()
    }
  }, [])

  const seatsById = useMemo(() => indexSeatsById(seats), [seats])

  const pendingReservations = useMemo(
    () => reservations.filter((r) => getReservationStatus(r, seatsById) === 'Pending'),
    [reservations, seatsById]
  )

  const handleToggleSeat = async (seat: Seat) => {
    if (!seat.id) return
    setSeatActionError(null)
    setUpdatingSeatIds((prev) => new Set(prev).add(seat.id!))
    try {
      if (seat.status === 'Available') {
        await blockSeat(seat.id)
      } else if (seat.status === 'Blocked') {
        await unblockSeat(seat.id)
      }
    } catch (err) {
      console.error('Failed to toggle seat block state:', err)
      setSeatActionError(
        err instanceof Error ? err.message : 'Failed to update seat. Please try again.'
      )
    } finally {
      setUpdatingSeatIds((prev) => {
        const next = new Set(prev)
        next.delete(seat.id!)
        return next
      })
    }
  }

  const handleApprove = async (reservation: Reservation) => {
    if (!reservation.id) return
    setReservationActionError(null)
    setProcessingReservationIds((prev) => new Set(prev).add(reservation.id!))
    try {
      // Flips every seat in this reservation to 'Confirmed' (black) atomically.
      await confirmReservation(reservation.id)
    } catch (err) {
      console.error('Failed to approve reservation:', err)
      setReservationActionError(
        err instanceof Error ? err.message : 'Failed to approve reservation. Please try again.'
      )
    } finally {
      setProcessingReservationIds((prev) => {
        const next = new Set(prev)
        next.delete(reservation.id!)
        return next
      })
    }
  }

  const handleCancel = async (reservation: Reservation) => {
    if (!reservation.id) return
    setReservationActionError(null)
    setProcessingReservationIds((prev) => new Set(prev).add(reservation.id!))
    try {
      // Releases every seat back to 'Available' (green) and deletes the
      // reservation document, atomically.
      await cancelReservation(reservation.id)
    } catch (err) {
      console.error('Failed to cancel reservation:', err)
      setReservationActionError(
        err instanceof Error ? err.message : 'Failed to cancel reservation. Please try again.'
      )
    } finally {
      setProcessingReservationIds((prev) => {
        const next = new Set(prev)
        next.delete(reservation.id!)
        return next
      })
    }
  }

  return (
    <div id="admin-dashboard-page" className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        <button
          type="button"
          id="admin-logout-button"
          onClick={() => adminSignOut()}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <i className="fas fa-arrow-right-from-bracket" aria-hidden="true"></i> Sign Out
        </button>
      </div>

      {connectionError && (
        <p className="text-center text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {connectionError}
        </p>
      )}

      {/* --- Visual Map View --------------------------------------------- */}
      <section id="admin-map-section" aria-label="Seat Map" className="bg-white rounded-2xl shadow-md p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 className="text-lg font-semibold text-gray-800">Theater Map</h2>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm font-medium text-gray-700">Block/Unblock Mode</span>
            <span className="relative inline-block w-11 h-6">
              <input
                type="checkbox"
                id="block-mode-toggle"
                checked={blockModeOn}
                onChange={(e) => setBlockModeOn(e.target.checked)}
                className="peer sr-only"
              />
              <span className="absolute inset-0 rounded-full bg-gray-300 peer-checked:bg-yellow-500 transition-colors"></span>
              <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"></span>
            </span>
          </label>
        </div>

        {blockModeOn && (
          <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md p-2 mb-2">
            <i className="fas fa-info-circle mr-1" aria-hidden="true"></i>
            Block Mode is ON — click a green (Available) seat to block it for VIPs, or click a red
            (Blocked) seat to make it available again.
          </p>
        )}

        {seatActionError && (
          <p className="text-sm text-red-700 bg-red-100 rounded-md p-2 mb-2">{seatActionError}</p>
        )}

        <SeatLegend />

        {loading ? (
          <p className="text-center text-gray-500 py-10">Loading seat map…</p>
        ) : (
          <AdminSeatGrid
            seats={seats}
            blockModeOn={blockModeOn}
            updatingSeatIds={updatingSeatIds}
            onToggleSeat={handleToggleSeat}
          />
        )}
      </section>

      {/* --- Manage Reservations ------------------------------------------ */}
      <section
        id="admin-reservations-section"
        aria-label="Pending Reservations"
        className="bg-white rounded-2xl shadow-md p-4"
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Pending Reservations ({pendingReservations.length})
        </h2>

        {reservationActionError && (
          <p className="text-sm text-red-700 bg-red-100 rounded-md p-2 mb-2">
            {reservationActionError}
          </p>
        )}

        <ReservationsTable
          reservations={pendingReservations}
          seatsById={seatsById}
          processingIds={processingReservationIds}
          onApprove={handleApprove}
          onCancel={handleCancel}
        />
      </section>
    </div>
  )
}

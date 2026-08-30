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
import {
  getReservationStatus,
  indexSeatsById,
  indexReservationsBySeatId,
} from '../utils/reservationStatus'

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
  const reservationsBySeatId = useMemo(() => indexReservationsBySeatId(reservations), [reservations])

  const pendingReservations = useMemo(
    () => reservations.filter((r) => getReservationStatus(r, seatsById) === 'Pending'),
    [reservations, seatsById]
  )

  const confirmedReservations = useMemo(
    () => reservations.filter((r) => getReservationStatus(r, seatsById) === 'Confirmed'),
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
    <div id="admin-dashboard-page" className="min-h-screen bg-gray-50">
      <div className="bg-navy-900 px-4 py-4 sm:py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gold-500/15 text-gold-400 text-sm ring-1 ring-gold-400/40">
              <i className="fas fa-graduation-cap" aria-hidden="true"></i>
            </span>
            Admin Dashboard
          </h1>
          <button
            type="button"
            id="admin-logout-button"
            onClick={() => adminSignOut()}
            className="text-sm text-navy-100/80 hover:text-white flex items-center gap-1.5 transition-colors duration-150"
          >
            <i className="fas fa-arrow-right-from-bracket" aria-hidden="true"></i> Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {connectionError && (
          <p className="text-center text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
            {connectionError}
          </p>
        )}

        {/* --- Visual Map View --------------------------------------------- */}
        <section id="admin-map-section" aria-label="Seat Map" className="bg-white rounded-2xl shadow-md ring-1 ring-gray-100 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h2 className="font-display text-lg font-semibold text-navy-900">Theater Map</h2>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-sm font-medium text-navy-700">Block/Unblock Mode</span>
              <span className="relative inline-block w-11 h-6">
                <input
                  type="checkbox"
                  id="block-mode-toggle"
                  checked={blockModeOn}
                  onChange={(e) => setBlockModeOn(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full bg-gray-300 peer-checked:bg-gold-500 transition-colors duration-200"></span>
                <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 peer-checked:translate-x-5"></span>
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
            <p className="text-center text-gray-500 py-10">
              <i className="fas fa-circle-notch fa-spin mr-2" aria-hidden="true"></i>
              Loading seat map…
            </p>
          ) : (
            <AdminSeatGrid
              seats={seats}
              blockModeOn={blockModeOn}
              updatingSeatIds={updatingSeatIds}
              onToggleSeat={handleToggleSeat}
              reservationsBySeatId={reservationsBySeatId}
            />
          )}
          {!loading && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              <i className="fas fa-circle-info mr-1" aria-hidden="true"></i>
              Hover over a black (Confirmed) or gray (Pending) seat to see who reserved it.
            </p>
          )}
        </section>

        {/* --- Manage Reservations ------------------------------------------ */}
        <section
          id="admin-reservations-section"
          aria-label="Pending Reservations"
          className="bg-white rounded-2xl shadow-md ring-1 ring-gray-100 p-4 sm:p-6"
        >
          <h2 className="font-display text-lg font-semibold text-navy-900 mb-3">
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

        {/* --- Confirmed Reservations (who booked which seat + admin-only Cancel) --- */}
        <section
          id="admin-confirmed-section"
          aria-label="Confirmed Reservations"
          className="bg-white rounded-2xl shadow-md ring-1 ring-gray-100 p-4 sm:p-6"
        >
          <h2 className="font-display text-lg font-semibold text-navy-900 mb-3">
            Confirmed Reservations ({confirmedReservations.length})
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            Approved bookings — kept here so you always know who reserved which seat. Cancelling a
            confirmed reservation here releases its seats back to Available and removes the booking.
          </p>

          <ReservationsTable
            reservations={confirmedReservations}
            seatsById={seatsById}
            processingIds={processingReservationIds}
            onCancel={handleCancel}
            emptyMessage="No confirmed reservations yet."
            emptyMessageId="no-confirmed-reservations"
          />
        </section>
      </div>
    </div>
  )
}

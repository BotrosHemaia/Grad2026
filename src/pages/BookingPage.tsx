import { useEffect, useMemo, useState } from 'react'
import type { Seat } from '../types/models'
import { subscribeToSeats } from '../services/seatService'
import { createReservation } from '../services/reservationService'
import SeatGrid from '../components/SeatGrid'
import SeatLegend from '../components/SeatLegend'
import BookingForm, { type BookingFormValues } from '../components/BookingForm'
import { MAX_SEATS_PER_BOOKING } from '../config/eventConfig'

interface BookingPageProps {
  onBack: () => void
}

/**
 * Guest booking flow: live seat grid + booking form.
 *
 * Race-condition safety: the actual Firestore write happens inside
 * `createReservation`, which runs a `runTransaction` that re-reads each
 * selected seat's current status and aborts the whole write if any seat
 * was already taken by someone else between the guest clicking it and
 * submitting the form. This guarantees two guests can never be
 * simultaneously confirmed into the same seat.
 */
export default function BookingPage({ onBack }: BookingPageProps) {
  const [seats, setSeats] = useState<Seat[]>([])
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{ seatNumbers: string[] } | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeToSeats(
      (data) => {
        setSeats(data)
        setLoading(false)
      },
      (error) => {
        console.error('Failed to subscribe to seats:', error)
        setConnectionError('Could not load the seat map. Please check your connection and try again.')
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [])

  // If a seat the guest had selected changes status underneath them
  // (e.g. someone else grabs it first), drop it from the selection so the
  // UI never shows a stale/impossible pick.
  useEffect(() => {
    setSelectedSeatIds((prev) =>
      prev.filter((id) => {
        const seat = seats.find((s) => s.id === id)
        return seat && seat.status === 'Available'
      })
    )
  }, [seats])

  const selectedSeatNumbers = useMemo(
    () =>
      selectedSeatIds
        .map((id) => seats.find((s) => s.id === id)?.seat_number)
        .filter((n): n is string => Boolean(n)),
    [selectedSeatIds, seats]
  )

  const handleToggleSeat = (seat: Seat) => {
    if (!seat.id || seat.status !== 'Available') return
    setSubmitError(null)

    setSelectedSeatIds((prev) => {
      if (prev.includes(seat.id!)) {
        return prev.filter((id) => id !== seat.id)
      }
      if (prev.length >= MAX_SEATS_PER_BOOKING) {
        setSubmitError(`You can only select up to ${MAX_SEATS_PER_BOOKING} seats.`)
        return prev
      }
      return [...prev, seat.id!]
    })
  }

  const handleSubmit = async (values: BookingFormValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      // This call performs the atomic Firestore transaction: it re-checks
      // every selected seat is still 'Available' and flips them all to
      // 'Pending' together with creating the reservation document. If any
      // seat was grabbed by another guest in the meantime, the whole
      // operation is rejected and nothing is written.
      await createReservation({
        guest_name: values.guest_name,
        phone_number: values.phone_number,
        payment_method: values.payment_method,
        servant_name: values.servant_name,
        seat_ids: selectedSeatIds,
      })
      setSuccessInfo({ seatNumbers: selectedSeatNumbers })
      setSelectedSeatIds([])
    } catch (err) {
      console.error('Failed to create reservation:', err)
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong while reserving your seats. Please try again.'
      setSubmitError(
        message.includes('not available')
          ? 'One or more selected seats were just taken by someone else. Please pick different seats.'
          : message
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (successInfo) {
    return (
      <div id="booking-success" className="max-w-md mx-auto text-center bg-white rounded-2xl shadow-xl p-8 space-y-4 mt-10">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600 text-2xl mx-auto">
          <i className="fas fa-check" aria-hidden="true"></i>
        </span>
        <h2 className="text-xl font-bold text-gray-900">Seats Reserved!</h2>
        <p className="text-gray-600">
          Seat(s) <strong>{successInfo.seatNumbers.join(', ')}</strong> are now on hold for you
          (status: <em>Pending</em>).
        </p>
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
          Payment must be completed within 1 hour to confirm your reservation.
        </p>
        <button
          type="button"
          onClick={() => setSuccessInfo(null)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          Book More Seats
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-gray-500 hover:text-gray-700 text-sm"
        >
          Back to Welcome Page
        </button>
      </div>
    )
  }

  return (
    <div id="booking-page" className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
        >
          <i className="fas fa-arrow-left" aria-hidden="true"></i> Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Select Your Seats</h2>
      </div>

      {connectionError && (
        <p className="text-center text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {connectionError}
        </p>
      )}

      {loading ? (
        <p className="text-center text-gray-500 py-10">Loading seat map…</p>
      ) : (
        <>
          <SeatLegend />
          <div className="bg-white rounded-2xl shadow-md p-4">
            <SeatGrid
              seats={seats}
              selectedSeatIds={selectedSeatIds}
              onToggleSeat={handleToggleSeat}
              submitting={submitting}
            />
          </div>

          <BookingForm
            selectedSeatNumbers={selectedSeatNumbers}
            submitting={submitting}
            errorMessage={submitError}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { FirebaseError } from 'firebase/app'
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
 * Guest booking flow with an optimized realtime listener. The physical layout
 * is generated locally; Firestore sends only unavailable seat documents.
 * The reservation transaction still re-reads selected seats before committing.
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
        setConnectionError(null)
        setLoading(false)
      },
      (error) => {
        console.error('Failed to load seats:', error)
        setConnectionError(
          error instanceof FirebaseError && error.code === 'resource-exhausted'
            ? 'The seat map has reached its temporary usage limit. Please try again later.'
            : 'Could not load the seat map. Please check your connection and try again.'
        )
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  // A realtime update can make a selected seat unavailable before submit.
  useEffect(() => {
    setSelectedSeatIds((previous) =>
      previous.filter((id) => seats.find((seat) => seat.id === id)?.status === 'Available')
    )
  }, [seats])

  const selectedSeatNumbers = useMemo(
    () =>
      selectedSeatIds
        .map((id) => seats.find((seat) => seat.id === id)?.seat_number)
        .filter((seatNumber): seatNumber is string => Boolean(seatNumber)),
    [selectedSeatIds, seats]
  )

  const handleToggleSeat = (seat: Seat) => {
    if (!seat.id || seat.status !== 'Available') return
    setSubmitError(null)

    setSelectedSeatIds((previous) => {
      if (previous.includes(seat.id!)) {
        return previous.filter((id) => id !== seat.id)
      }

      if (previous.length >= MAX_SEATS_PER_BOOKING) {
        setSubmitError(`You can only select up to ${MAX_SEATS_PER_BOOKING} seats.`)
        return previous
      }

      return [...previous, seat.id!]
    })
  }

  const handleSubmit = async (values: BookingFormValues) => {
    setSubmitting(true)
    setSubmitError(null)

    try {
      await createReservation({
        guest_name: values.guest_name,
        phone_number: values.phone_number,
        payment_method: values.payment_method,
        servant_name: values.servant_name,
        seat_ids: selectedSeatIds,
      })

      setSuccessInfo({ seatNumbers: selectedSeatNumbers })
      setSelectedSeatIds([])
    } catch (error) {
      console.error('Failed to create reservation:', error)

      if (error instanceof FirebaseError) {
        if (error.code === 'resource-exhausted') {
          setSubmitError(
            'The reservation system has reached its temporary usage limit. Please try again later.'
          )
        } else if (error.code === 'auth/quota-exceeded') {
          setSubmitError(
            'Too many new guest sessions were created from this network. Please wait and try again without incognito mode.'
          )
        } else if (error.code === 'permission-denied') {
          setSubmitError('Your session cannot complete this reservation. Please refresh and try again.')
        } else {
          setSubmitError('Could not complete the reservation. Please refresh and try again.')
        }
      } else {
        const message =
          error instanceof Error
            ? error.message
            : 'Something went wrong while reserving your seats. Please try again.'

        setSubmitError(
          message.includes('not available') || message.includes('just taken')
            ? 'One or more selected seats were just taken by someone else. Please pick different seats.'
            : message
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (successInfo) {
    return (
      <div id="booking-success" className="max-w-md mx-auto text-center bg-white rounded-2xl shadow-navy-lg ring-1 ring-navy-100 p-8 space-y-4 mt-10 mb-10 animate-[fadeIn_0.3s_ease-out]">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 text-2xl mx-auto ring-4 ring-green-50">
          <i className="fas fa-check" aria-hidden="true"></i>
        </span>
        <h2 className="font-display text-2xl font-bold text-navy-900">Seats Reserved!</h2>
        <p className="text-gray-600">
          Seat(s) <strong className="text-navy-800">{successInfo.seatNumbers.join(', ')}</strong> are now on hold for you
          (status: <em>Pending</em>).
        </p>
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2.5">
          <i className="fas fa-triangle-exclamation mr-1.5" aria-hidden="true"></i>
          Payment must be completed within 1 hour to confirm your reservation.
        </p>
        <button
          type="button"
          onClick={() => setSuccessInfo(null)}
          className="w-full bg-navy-800 hover:bg-navy-700 text-white font-semibold py-2.5 rounded-lg transition-colors duration-200"
        >
          Book More Seats
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-gray-500 hover:text-navy-700 text-sm transition-colors duration-200"
        >
          Back to Welcome Page
        </button>
      </div>
    )
  }

  return (
    <div id="booking-page" className="w-full max-w-[1500px] mx-auto px-4 py-6 sm:py-8 space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-500 hover:text-navy-700 text-sm flex items-center gap-1.5 transition-colors duration-200"
        >
          <i className="fas fa-arrow-left" aria-hidden="true"></i> Back
        </button>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-navy-900">Select Your Seats</h2>
      </div>

      {connectionError && (
        <p className="text-center text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {connectionError}
        </p>
      )}

      {loading ? (
        <p className="text-center text-gray-500 py-10">
          <i className="fas fa-circle-notch fa-spin mr-2" aria-hidden="true"></i>
          Loading seat map…
        </p>
      ) : seats.length > 0 ? (
        <>
          <div className="bg-white rounded-2xl shadow-md ring-1 ring-gray-100 p-3">
            <SeatLegend />
          </div>
          <div className="bg-white rounded-2xl shadow-md ring-1 ring-gray-100 p-4 sm:p-6">
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
      ) : null}
    </div>
  )
}

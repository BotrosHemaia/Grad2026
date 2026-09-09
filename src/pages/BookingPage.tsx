import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { FirebaseError } from 'firebase/app'
import type { Seat } from '../types/models'
import { subscribeToSeats } from '../services/seatService'
import { createReservation } from '../services/reservationService'
import { sendTelegramReservationAlert } from '../services/telegramNotificationService'
import SeatGrid from '../components/SeatGrid'
import SeatLegend from '../components/SeatLegend'
import BookingForm, { type BookingFormValues } from '../components/BookingForm'
import { EVENT_CONFIG, MAX_SEATS_PER_BOOKING, TICKET_PRICE_EGP } from '../config/eventConfig'
import '../booking-flow.css'

interface BookingPageProps { onBack: () => void }
type Step = 'seats' | 'details' | 'confirmation'
interface ConfirmationInfo { seatNumbers: string[]; ticketNames: string[]; totalAmount: number }

function Progress({ step }: { step: Step }) {
  const active = step === 'seats' ? 1 : step === 'details' ? 2 : 3
  return <ol className="flow-progress" aria-label="Reservation progress">
    {['Select seats', 'Your details', 'Confirmation'].map((label, index) => <li key={label} className={active >= index + 1 ? 'active' : ''}><span>{index + 1}</span><strong>{label}</strong></li>)}
  </ol>
}

function SummaryItem({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return <div className="selection-detail"><i className={icon} aria-hidden="true" /><div><span>{label}</span><strong>{children}</strong></div></div>
}

export default function BookingPage({ onBack }: BookingPageProps) {
  const [seats, setSeats] = useState<Seat[]>([])
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
  const [step, setStep] = useState<Step>('seats')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmationInfo | null>(null)

  useEffect(() => subscribeToSeats(
    (data) => { setSeats(data); setConnectionError(null); setLoading(false) },
    (error) => {
      console.error('Failed to load seats:', error)
      setConnectionError(error instanceof FirebaseError && error.code === 'resource-exhausted' ? 'The seat map has reached its temporary usage limit. Please try again later.' : 'Could not load the seat map. Please check your connection and try again.')
      setLoading(false)
    }
  ), [])

  useEffect(() => {
    setSelectedSeatIds((previous) => previous.filter((id) => seats.find((seat) => seat.id === id)?.status === 'Available'))
  }, [seats])

  const selectedSeatNumbers = useMemo(() => selectedSeatIds.map((id) => seats.find((seat) => seat.id === id)?.seat_number).filter((number): number is string => Boolean(number)), [selectedSeatIds, seats])
  const totalAmount = selectedSeatIds.length * TICKET_PRICE_EGP

  const handleToggleSeat = (seat: Seat) => {
    if (!seat.id || seat.status !== 'Available') return
    setSubmitError(null)
    setSelectedSeatIds((previous) => {
      if (previous.includes(seat.id!)) return previous.filter((id) => id !== seat.id)
      if (previous.length >= MAX_SEATS_PER_BOOKING) {
        setSubmitError(`You can only select up to ${MAX_SEATS_PER_BOOKING} seats.`)
        return previous
      }
      return [...previous, seat.id!]
    })
  }

  const continueToDetails = () => {
    if (!selectedSeatIds.length) return setSubmitError('Select at least one seat to continue.')
    setSubmitError(null)
    setStep('details')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (values: BookingFormValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const reservationId = await createReservation({ guest_name: values.ticket_names[0], ticket_names: values.ticket_names, phone_number: values.phone_number, payment_method: values.payment_method, servant_name: values.servant_name, seat_ids: selectedSeatIds })
      try {
        await sendTelegramReservationAlert(reservationId)
      } catch (notificationError) {
        // The reservation is already safely stored. Do not ask the guest to
        // submit again just because the organizer alert could not be delivered.
        console.warn('Reservation saved, but Telegram alert failed:', notificationError)
      }
      setConfirmation({ seatNumbers: selectedSeatNumbers, ticketNames: values.ticket_names, totalAmount })
      setStep('confirmation')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      console.error('Failed to create reservation:', error)
      if (error instanceof FirebaseError) {
        if (error.code === 'resource-exhausted') setSubmitError('The reservation system has reached its temporary usage limit. Please try again later.')
        else if (error.code === 'permission-denied') setSubmitError('Your session cannot complete this reservation. Please refresh and try again.')
        else setSubmitError('Could not complete the reservation. Please refresh and try again.')
      } else {
        const message = error instanceof Error ? error.message : 'Something went wrong while reserving your seats.'
        setSubmitError(message.includes('taken') || message.includes('not available') ? 'One or more selected seats were just taken. Please choose different seats.' : message)
      }
    } finally { setSubmitting(false) }
  }

  const bookMore = () => {
    setConfirmation(null)
    setSelectedSeatIds([])
    setSubmitError(null)
    setStep('seats')
  }

  return <div id="booking-page" className="booking-shell">
    <div className="booking-frame">
      <header className="booking-nav">
        <button type="button" onClick={onBack} className="booking-logo"><i className="fas fa-graduation-cap" aria-hidden="true" /> Class of 2026</button>
        <span>A brighter tomorrow together</span>
      </header>

      <div className="booking-topline">
        <div><button type="button" className="flow-back" onClick={step === 'seats' ? onBack : () => setStep('seats')}>← Back</button><h1>{step === 'seats' ? 'Select your seats' : step === 'details' ? 'Your details' : 'Reservation received'}</h1>{step === 'seats' && <p>Choose your seats, then add your details.</p>}</div>
        <Progress step={step} />
      </div>

      {connectionError && <p className="flow-error" role="alert">{connectionError}</p>}

      {step === 'seats' && <div className="seat-selection-layout">
        <section className="seat-map-card" aria-label="Theatre seat map">
          {loading ? <p className="flow-loading"><i className="fas fa-circle-notch fa-spin" /> Loading seat map…</p> : seats.length > 0 ? <><SeatGrid seats={seats} selectedSeatIds={selectedSeatIds} onToggleSeat={handleToggleSeat} submitting={submitting} /><SeatLegend /></> : null}
        </section>
        <aside className="selection-card">
          <p className="flow-kicker">Your selection</p>
          <h2>{selectedSeatIds.length ? `${selectedSeatIds.length} seat${selectedSeatIds.length === 1 ? '' : 's'} selected` : 'Choose your seats'}</h2>
          <div className="summary-seat-list">{selectedSeatNumbers.length ? selectedSeatNumbers.map((seat) => <span key={seat}>{seat}</span>) : <p>No seats selected yet</p>}</div>
          <div className="selection-details">
            <SummaryItem icon="far fa-calendar" label="Date">{EVENT_CONFIG.date}</SummaryItem>
            <SummaryItem icon="far fa-clock" label="Time">{EVENT_CONFIG.time}</SummaryItem>
            <SummaryItem icon="fas fa-location-dot" label="Location"><span lang="ar" dir="rtl">{EVENT_CONFIG.venue}</span></SummaryItem>
            <SummaryItem icon="fas fa-receipt" label="Total">{totalAmount} EGP</SummaryItem>
          </div>
          {submitError && <p className="selection-error" role="alert">{submitError}</p>}
          <button type="button" className="flow-primary" onClick={continueToDetails} disabled={!selectedSeatIds.length}>Continue <span aria-hidden="true">→</span></button>
          <small>You can review your details before confirming.</small>
        </aside>
      </div>}

      {step === 'details' && <BookingForm selectedSeatNumbers={selectedSeatNumbers} submitting={submitting} errorMessage={submitError} onBack={() => setStep('seats')} onSubmit={handleSubmit} />}

      {step === 'confirmation' && confirmation && <section className="confirmation-card">
        <span className="confirmation-check"><i className="fas fa-check" aria-hidden="true" /></span>
        <p className="flow-kicker">Reservation pending</p>
        <h2>Your seats are held for 1 hour</h2>
        <div className="confirmation-grid">
          <div><span>Number of tickets</span><strong>{confirmation.seatNumbers.length}</strong></div>
          <div><span>Seats</span><strong>{confirmation.seatNumbers.join(', ')}</strong></div>
          <div className="confirmation-wide"><span>Name{confirmation.ticketNames.length === 1 ? '' : 's'}</span><strong>{confirmation.ticketNames.join(', ')}</strong></div>
          <div className="confirmation-wide"><span>Total amount</span><strong>{confirmation.totalAmount} EGP</strong></div>
        </div>
        <p className="payment-reminder"><i className="fas fa-clock" aria-hidden="true" /> Payment must be completed within 1 hour to confirm reservation. Unpaid seats will be released back to Available.</p>
        <button type="button" className="flow-primary" onClick={bookMore}>Book more seats</button>
        <button type="button" className="flow-back confirmation-home" onClick={onBack}>Back to welcome page</button>
      </section>}
    </div>
  </div>
}

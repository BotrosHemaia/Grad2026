import { useState, type FormEvent } from 'react'
import type { PaymentMethod } from '../types/models'
import {
  SERVANT_NAMES,
  MAX_SEATS_PER_BOOKING,
  TICKET_PRICE_EGP,
} from '../config/eventConfig'

export interface BookingFormValues {
  guest_name: string
  phone_number: string
  payment_method: PaymentMethod
  servant_name: string
}

interface BookingFormProps {
  selectedSeatNumbers: string[]
  submitting: boolean
  errorMessage: string | null
  onSubmit: (values: BookingFormValues) => void | Promise<void>
}

const PHONE_PATTERN = /^[0-9+\-\s]{7,20}$/

const inputClasses =
  'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-400 disabled:bg-gray-100 ' +
  'transition-colors duration-150'

/**
 * Booking form shown below the seat grid. Displays the currently selected
 * seat numbers and collects guest details required to create a
 * reservation. Validates required fields client-side before delegating
 * the actual (transactional) Firestore write to the parent's onSubmit.
 */
export default function BookingForm({
  selectedSeatNumbers,
  submitting,
  errorMessage,
  onSubmit,
}: BookingFormProps) {
  const [guestName, setGuestName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash')
  const [servantName, setServantName] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const hasSeats = selectedSeatNumbers.length > 0
  const totalAmount = selectedSeatNumbers.length * TICKET_PRICE_EGP

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (selectedSeatNumbers.length === 0) {
      setValidationError('Please select at least one seat on the map above.')
      return
    }
    if (selectedSeatNumbers.length > MAX_SEATS_PER_BOOKING) {
      setValidationError(`You can only reserve up to ${MAX_SEATS_PER_BOOKING} seats.`)
      return
    }
    if (!guestName.trim()) {
      setValidationError('Full name is required.')
      return
    }
    if (!PHONE_PATTERN.test(phoneNumber.trim())) {
      setValidationError('Please enter a valid phone number.')
      return
    }
    if (!servantName) {
      setValidationError('Please select a servant name.')
      return
    }

    await onSubmit({
      guest_name: guestName.trim(),
      phone_number: phoneNumber.trim(),
      payment_method: paymentMethod,
      servant_name: servantName,
    })
  }

  return (
    <form
      id="booking-form"
      onSubmit={handleSubmit}
      className="max-w-md mx-auto bg-white rounded-2xl shadow-navy-lg ring-1 ring-gray-100 p-6 sm:p-7 space-y-5"
    >
      <div className="text-center">
        <h3 className="font-display text-lg font-bold text-navy-900">Reservation Details</h3>
        <p className="text-xs text-gray-400 mt-0.5">Fill in your information to confirm your seats</p>
      </div>

      <div
        id="selected-seats-summary"
        className="rounded-xl bg-navy-900 p-4 relative overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500"></div>
        <p className="text-xs font-medium text-navy-100/70 uppercase tracking-wider">
          Selected seats ({selectedSeatNumbers.length}/{MAX_SEATS_PER_BOOKING})
        </p>
        <p className="text-xl font-bold text-gold-400 mt-1 font-display">
          {hasSeats ? selectedSeatNumbers.join(', ') : 'None selected yet'}
        </p>
      </div>

      <div>
        <label htmlFor="guest-name-input" className="block text-sm font-medium text-navy-800 mb-1.5">
          Full Name
        </label>
        <input
          id="guest-name-input"
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="e.g. Jane Doe"
          disabled={submitting}
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="phone-number-input" className="block text-sm font-medium text-navy-800 mb-1.5">
          Phone Number
        </label>
        <input
          id="phone-number-input"
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="e.g. 01012345678"
          disabled={submitting}
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="payment-method-select" className="block text-sm font-medium text-navy-800 mb-1.5">
          Payment Method
        </label>
        <select
          id="payment-method-select"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          disabled={submitting}
          className={inputClasses}
        >
          <option value="Cash">Cash</option>
          <option value="InstaPay">InstaPay</option>
        </select>
      </div>

      <div>
        <label htmlFor="servant-name-select" className="block text-sm font-medium text-navy-800 mb-1.5">
          Servant Name
        </label>
        <select
          id="servant-name-select"
          value={servantName}
          onChange={(e) => setServantName(e.target.value)}
          disabled={submitting}
          className={inputClasses}
        >
          <option value="" disabled>
            Select the staff member helping you…
          </option>
          {SERVANT_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div
        id="order-total"
        className="flex items-center justify-between rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 text-navy-900"
        aria-live="polite"
      >
        <span className="text-sm font-semibold">Total Amount</span>
        <strong className="text-lg font-bold text-navy-900">
          Total: {totalAmount} EGP
        </strong>
      </div>

      <p id="payment-disclaimer" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
        <i className="fas fa-triangle-exclamation mr-1.5" aria-hidden="true"></i>
        Payment must be completed within 1 hour to confirm reservation. Unpaid seats will be
        released back to Available.
      </p>

      {(validationError || errorMessage) && (
        <p id="booking-form-error" className="text-sm text-red-700 bg-red-100 rounded-lg p-2.5">
          <i className="fas fa-circle-exclamation mr-1.5" aria-hidden="true"></i>
          {validationError || errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !hasSeats}
        className="w-full rounded-lg bg-gold-500 hover:bg-gold-400 active:scale-[0.99] disabled:bg-gray-300 disabled:cursor-not-allowed text-navy-900 font-bold py-3 transition-all duration-150 shadow-gold-glow disabled:shadow-none"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <i className="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Reserving…
          </span>
        ) : (
          `Reserve ${selectedSeatNumbers.length || ''} Seat${selectedSeatNumbers.length === 1 ? '' : 's'}`
        )}
      </button>
    </form>
  )
}

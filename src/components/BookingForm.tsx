import { useState, type FormEvent } from 'react'
import type { PaymentMethod } from '../types/models'
import { SERVANT_NAMES, MAX_SEATS_PER_BOOKING } from '../config/eventConfig'

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
      className="max-w-md mx-auto bg-white rounded-xl shadow-md p-6 space-y-4"
    >
      <div id="selected-seats-summary" className="rounded-lg bg-blue-50 border border-blue-200 p-3">
        <p className="text-sm font-medium text-blue-900">
          Selected seats ({selectedSeatNumbers.length}/{MAX_SEATS_PER_BOOKING}):
        </p>
        <p className="text-lg font-bold text-blue-700 mt-1">
          {hasSeats ? selectedSeatNumbers.join(', ') : 'None selected yet'}
        </p>
      </div>

      <div>
        <label htmlFor="guest-name-input" className="block text-sm font-medium text-gray-700 mb-1">
          Full Name
        </label>
        <input
          id="guest-name-input"
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="e.g. Jane Doe"
          disabled={submitting}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>

      <div>
        <label htmlFor="phone-number-input" className="block text-sm font-medium text-gray-700 mb-1">
          Phone Number
        </label>
        <input
          id="phone-number-input"
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="e.g. 01012345678"
          disabled={submitting}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>

      <div>
        <label htmlFor="payment-method-select" className="block text-sm font-medium text-gray-700 mb-1">
          Payment Method
        </label>
        <select
          id="payment-method-select"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          disabled={submitting}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option value="Cash">Cash</option>
          <option value="InstaPay">InstaPay</option>
        </select>
      </div>

      <div>
        <label htmlFor="servant-name-select" className="block text-sm font-medium text-gray-700 mb-1">
          Servant Name
        </label>
        <select
          id="servant-name-select"
          value={servantName}
          onChange={(e) => setServantName(e.target.value)}
          disabled={submitting}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
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

      <p id="payment-disclaimer" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
        <i className="fas fa-triangle-exclamation mr-1" aria-hidden="true"></i>
        Payment must be completed within 1 hour to confirm reservation. Unpaid seats will be
        released back to Available.
      </p>

      {(validationError || errorMessage) && (
        <p id="booking-form-error" className="text-sm text-red-700 bg-red-100 rounded-md p-2">
          {validationError || errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !hasSeats}
        className="w-full rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 transition-colors"
      >
        {submitting ? 'Reserving…' : `Reserve ${selectedSeatNumbers.length || ''} Seat${selectedSeatNumbers.length === 1 ? '' : 's'}`}
      </button>
    </form>
  )
}

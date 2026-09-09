import { useState, type FormEvent } from 'react'
import type { PaymentMethod } from '../types/models'
import { SERVANT_NAMES, TICKET_PRICE_EGP } from '../config/eventConfig'

export interface BookingFormValues {
  ticket_names: string[]
  phone_number: string
  payment_method: PaymentMethod
  servant_name: string
}

interface BookingFormProps {
  selectedSeatNumbers: string[]
  submitting: boolean
  errorMessage: string | null
  onBack: () => void
  onSubmit: (values: BookingFormValues) => void | Promise<void>
}

const PHONE_PATTERN = /^01[0125][0-9]{8}$/

export default function BookingForm({ selectedSeatNumbers, submitting, errorMessage, onBack, onSubmit }: BookingFormProps) {
  const [ticketNames, setTicketNames] = useState(() => selectedSeatNumbers.map(() => ''))
  const [phoneNumber, setPhoneNumber] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash')
  const [servantName, setServantName] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const totalAmount = selectedSeatNumbers.length * TICKET_PRICE_EGP

  const updateTicketName = (index: number, value: string) => {
    setTicketNames((previous) => previous.map((name, itemIndex) => itemIndex === index ? value : name))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setValidationError(null)
    const names = ticketNames.map((name) => name.trim())
    if (names.some((name) => !name)) return setValidationError('Enter a person name for every ticket.')
    if (names.some((name) => name.length > 100)) return setValidationError('Ticket-holder names must be 100 characters or fewer.')
    if (!PHONE_PATTERN.test(phoneNumber.trim())) return setValidationError('Enter an 11-digit mobile number starting with 010, 011, 012, or 015.')
    if (!servantName) return setValidationError('Please select a servant name.')
    await onSubmit({ ticket_names: names, phone_number: phoneNumber.trim(), payment_method: paymentMethod, servant_name: servantName })
  }

  return (
    <div className="details-layout">
      <form id="booking-form" className="details-card" onSubmit={handleSubmit}>
        <div className="details-heading">
          <button type="button" className="flow-back" onClick={onBack}>← Back to seats</button>
          <p className="flow-kicker">Ticket details</p>
          <h2>Your details</h2>
          <p>Add a name for each ticket, then tell us how to contact you.</p>
        </div>

        <fieldset className="ticket-names">
          <legend>Names on tickets</legend>
          <div className="ticket-name-grid">
            {selectedSeatNumbers.map((seat, index) => (
              <label key={seat} className="flow-field">
                <span>Ticket {index + 1} · Seat {seat}</span>
                <input type="text" value={ticketNames[index]} onChange={(event) => updateTicketName(index, event.target.value)} placeholder="Person's full name" autoComplete={index === 0 ? 'name' : 'off'} disabled={submitting} maxLength={100} />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="details-fields-grid">
          <label className="flow-field">
            <span>Phone number</span>
            <input id="phone-number-input" type="tel" inputMode="numeric" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="01012345678" autoComplete="tel" disabled={submitting} pattern="01[0125][0-9]{8}" maxLength={11} />
            <small>11 digits starting with 010, 011, 012, or 015</small>
          </label>
          <label className="flow-field">
            <span>Payment method</span>
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} disabled={submitting}><option value="Cash">Cash</option><option value="InstaPay">InstaPay</option></select>
          </label>
          <label className="flow-field details-field-wide">
            <span>Servant name</span>
            <select value={servantName} onChange={(event) => setServantName(event.target.value)} disabled={submitting}><option value="" disabled>Select the staff member helping you</option>{SERVANT_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}</select>
          </label>
        </div>

        {(validationError || errorMessage) && <p className="flow-error" role="alert">{validationError || errorMessage}</p>}
        <button type="submit" className="flow-primary" disabled={submitting}>{submitting ? 'Reserving…' : 'Confirm reservation'} <span aria-hidden="true">→</span></button>
      </form>

      <aside className="details-summary" aria-label="Order summary">
        <p className="flow-kicker">Order summary</p>
        <h2>{selectedSeatNumbers.length} ticket{selectedSeatNumbers.length === 1 ? '' : 's'}</h2>
        <div className="summary-seat-list">{selectedSeatNumbers.map((seat) => <span key={seat}>{seat}</span>)}</div>
        <div className="summary-price-row"><span>{selectedSeatNumbers.length} × {TICKET_PRICE_EGP} EGP</span><strong>{totalAmount} EGP</strong></div>
        <div className="summary-total"><span>Total amount</span><strong>{totalAmount} EGP</strong></div>
      </aside>
    </div>
  )
}

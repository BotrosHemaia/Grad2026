const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { logger } = require('firebase-functions')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

initializeApp()

const db = getFirestore()
const TICKET_PRICE_EGP = 100
const MAX_SEATS_PER_BOOKING = 4
const ALLOWED_PAYMENT_METHODS = new Set(['Cash', 'InstaPay'])
const ALLOWED_SERVANT_NAMES = new Set(['Mina Atta', 'Mina Adel', 'Marina', 'Aml'])
const PHONE_PATTERN = /^01[0125][0-9]{8}$/

function requiredTrimmedString(value, fieldName, maxLength) {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${fieldName} is required.`)
  }
  const result = value.trim()
  if (!result || result.length > maxLength) {
    throw new HttpsError(
      'invalid-argument',
      `${fieldName} must contain between 1 and ${maxLength} characters.`
    )
  }
  return result
}

exports.createReservation = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 30,
    memory: '256MiB',
    maxInstances: 20,
  },
  async (request) => {
    const data = request.data ?? {}
    const guestName = requiredTrimmedString(data.guestName, 'Guest name', 100)
    const ticketNames = data.ticketNames
    const phoneNumber = requiredTrimmedString(data.phoneNumber, 'Phone number', 20)
    const servantName = requiredTrimmedString(data.servantName, 'Servant name', 100)
    const paymentMethod = data.paymentMethod
    const seatIds = data.seatIds

    if (!Array.isArray(ticketNames) || !ticketNames.every((name) => typeof name === 'string')) {
      throw new HttpsError('invalid-argument', 'Enter one ticket-holder name for every seat.')
    }

    if (!PHONE_PATTERN.test(phoneNumber)) {
      throw new HttpsError('invalid-argument', 'Enter a valid phone number.')
    }
    if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
      throw new HttpsError('invalid-argument', 'Invalid payment method.')
    }
    if (!ALLOWED_SERVANT_NAMES.has(servantName)) {
      throw new HttpsError('invalid-argument', 'Invalid servant name.')
    }
    if (!Array.isArray(seatIds) || seatIds.length < 1 || seatIds.length > MAX_SEATS_PER_BOOKING) {
      throw new HttpsError(
        'invalid-argument',
        `Select between 1 and ${MAX_SEATS_PER_BOOKING} seats.`
      )
    }
    if (!seatIds.every((seatId) => typeof seatId === 'string' && seatId.length > 0)) {
      throw new HttpsError('invalid-argument', 'Every seat ID must be a non-empty string.')
    }
    if (new Set(seatIds).size !== seatIds.length) {
      throw new HttpsError('invalid-argument', 'Duplicate seat IDs are not allowed.')
    }
    if (ticketNames.length !== seatIds.length) {
      throw new HttpsError('invalid-argument', 'Enter one ticket-holder name for every seat.')
    }
    const normalizedTicketNames = ticketNames.map((name, index) =>
      requiredTrimmedString(name, `Ticket ${index + 1} name`, 100)
    )

    const reservationRef = db.collection('reservations').doc()
    const seatRefs = seatIds.map((seatId) => db.collection('seats').doc(seatId))
    const totalAmount = seatIds.length * TICKET_PRICE_EGP

    try {
      await db.runTransaction(async (transaction) => {
        // Firestore requires transaction reads before writes. getAll reads
        // every selected seat as one transaction snapshot.
        const seatSnapshots = await transaction.getAll(...seatRefs)

        const unavailable = seatSnapshots.some(
          (snapshot) => !snapshot.exists || snapshot.get('status') !== 'Available'
        )
        if (unavailable) {
          throw new HttpsError(
            'failed-precondition',
            'One or more selected seats are no longer available.',
            { reason: 'seat-unavailable' }
          )
        }

        transaction.create(reservationRef, {
          guest_name: guestName,
          ticket_names: normalizedTicketNames,
          phone_number: phoneNumber,
          payment_method: paymentMethod,
          servant_name: servantName,
          seat_ids: seatIds,
          status: 'Pending',
          ticket_price: TICKET_PRICE_EGP,
          total_price: totalAmount,
          created_at: FieldValue.serverTimestamp(),
        })

        seatRefs.forEach((seatRef) => {
          transaction.update(seatRef, {
            status: 'Pending',
            reservation_id: reservationRef.id,
          })
        })
      })
    } catch (error) {
      if (error instanceof HttpsError) throw error
      logger.error('createReservation transaction failed', error)
      throw new HttpsError('internal', 'The reservation could not be completed. Please try again.')
    }

    return {
      reservationId: reservationRef.id,
      status: 'Pending',
      totalAmount,
      currency: 'EGP',
    }
  }
)

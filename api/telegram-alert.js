import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

function getAdminApp() {
  if (getApps().length) return getApps()[0]

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin environment variables are missing.')
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function buildMessage(reservationId, reservation) {
  const ticketNames = Array.isArray(reservation.ticket_names)
    ? reservation.ticket_names.join(', ')
    : reservation.guest_name
  const seats = Array.isArray(reservation.seat_ids)
    ? reservation.seat_ids.join(', ')
    : '—'

  return [
    '🔔 <b>New seat reservation</b>',
    '',
    `<b>Reservation:</b> <code>${escapeHtml(reservationId.slice(0, 8).toUpperCase())}</code>`,
    `<b>Name:</b> ${escapeHtml(ticketNames)}`,
    `<b>Phone:</b> <code>${escapeHtml(reservation.phone_number)}</code>`,
    `<b>Seats:</b> ${escapeHtml(seats)}`,
    `<b>Tickets:</b> ${escapeHtml(reservation.seat_ids?.length ?? 0)}`,
    `<b>Payment:</b> ${escapeHtml(reservation.payment_method)}`,
    `<b>Servant:</b> ${escapeHtml(reservation.servant_name)}`,
    `<b>Total:</b> ${escapeHtml(reservation.total_price ?? 0)} EGP`,
    '',
    '⏳ Payment is due within 1 hour.',
  ].join('\n')
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
  const reservationId = request.body?.reservationId

  if (!token || typeof reservationId !== 'string' || !reservationId.trim()) {
    return response.status(400).json({ error: 'Missing authentication or reservation ID.' })
  }

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN
  const telegramChatId = process.env.TELEGRAM_CHAT_ID
  if (!telegramToken || !telegramChatId) {
    console.error('Telegram environment variables are missing.')
    return response.status(500).json({ error: 'Notification service is not configured.' })
  }

  let notificationRef
  try {
    const adminApp = getAdminApp()
    const decodedToken = await getAuth(adminApp).verifyIdToken(token)
    const firestore = getFirestore(adminApp)
    const reservationRef = firestore.collection('reservations').doc(reservationId)
    notificationRef = firestore.collection('telegram_notifications').doc(reservationId)

    const reservationSnapshot = await reservationRef.get()
    if (!reservationSnapshot.exists) {
      return response.status(404).json({ error: 'Reservation not found.' })
    }

    const reservation = reservationSnapshot.data()
    if (reservation.userId !== decodedToken.uid) {
      return response.status(403).json({ error: 'You cannot notify for this reservation.' })
    }

    const shouldSend = await firestore.runTransaction(async (transaction) => {
      const existing = await transaction.get(notificationRef)
      if (existing.exists) return false
      transaction.create(notificationRef, {
        reservation_id: reservationId,
        status: 'sending',
        created_at: FieldValue.serverTimestamp(),
      })
      return true
    })

    if (!shouldSend) return response.status(200).json({ sent: false, duplicate: true })

    const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: buildMessage(reservationId, reservation),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    if (!telegramResponse.ok) {
      const telegramError = await telegramResponse.text()
      throw new Error(`Telegram returned ${telegramResponse.status}: ${telegramError}`)
    }

    await notificationRef.update({ status: 'sent', sent_at: FieldValue.serverTimestamp() })
    return response.status(200).json({ sent: true })
  } catch (error) {
    console.error('Telegram notification failed:', error)
    if (notificationRef) {
      await notificationRef.delete().catch((cleanupError) => {
        console.error('Notification retry cleanup failed:', cleanupError)
      })
    }
    const status = error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error'
      ? 401
      : 500
    return response.status(status).json({ error: 'Could not send the notification.' })
  }
}

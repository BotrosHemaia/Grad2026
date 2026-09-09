import { auth } from '../firebase/config'

/**
 * Ask the server-side Vercel Function to notify the organizer.
 * The Firebase ID token proves that the caller owns the reservation; Telegram
 * credentials never enter the browser bundle.
 */
export async function sendTelegramReservationAlert(reservationId: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('No authenticated booking session was found.')

  const idToken = await user.getIdToken()
  const response = await fetch('/api/telegram-alert', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reservationId }),
  })

  if (!response.ok) {
    throw new Error(`Telegram notification failed with status ${response.status}.`)
  }
}

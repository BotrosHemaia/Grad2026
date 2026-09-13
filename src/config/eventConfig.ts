/**
 * Static event configuration for the Welcome Page.
 * Edit these values for your actual graduation party event.
 */
export const EVENT_CONFIG = {
  title: 'CALLED',
  date: 'الأحد، 4 أكتوبر 2026',
  time: '5:00 م',
  venue: 'مسرح الملاك طوسون - شبرا',
  description: 'CALLED — أنت مدعو … لأنك له.',
}

/**
 * Names of servants/ushers available in the booking form dropdown.
 * Edit this list to match your event staff.
 */
export const SERVANT_NAMES: string[] = [
  'Mina Atta',
  'Mina Adel',
  'Marina',
  'Aml',
]

/** Maximum number of seats a single guest may select/reserve at once. */
export const MAX_SEATS_PER_BOOKING = 4

/** Current ticket price per seat, in Egyptian pounds. */
export const TICKET_PRICE_EGP = 100

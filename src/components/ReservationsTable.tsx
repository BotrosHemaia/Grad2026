import type { Reservation, Seat } from '../types/models'
import { getSeatNumbers } from '../utils/reservationStatus'

interface ReservationsTableProps {
  /** Reservations to display — caller filters to 'Pending' or 'Confirmed'. */
  reservations: Reservation[]
  seatsById: Map<string, Seat>
  /** Reservation IDs currently being approved/cancelled (disables their row's buttons). */
  processingIds: Set<string>
  /** Approve/Cancel handlers — omit both (or set readOnly) to hide the Actions column. */
  onApprove?: (reservation: Reservation) => void
  onCancel?: (reservation: Reservation) => void
  /** When true, renders guest/seat/payment details only — no Approve/Cancel actions. */
  readOnly?: boolean
  /** Message shown when the reservation list is empty. */
  emptyMessage?: string
  /** id applied to the empty-state <p> so callers can target it in tests. */
  emptyMessageId?: string
}

function formatCreatedAt(createdAt: unknown): string {
  // Firestore Timestamp has a toDate() method; fall back gracefully otherwise
  // (e.g. right after creation, before the server timestamp has resolved).
  const ts = createdAt as { toDate?: () => Date } | null | undefined
  if (ts && typeof ts.toDate === 'function') {
    return ts.toDate().toLocaleString()
  }
  return '—'
}

/**
 * Data table of all Pending reservations for the Admin Dashboard.
 * Each row shows the guest's details, booked seats, payment method, and
 * servant name, plus Approve / Cancel actions.
 */
export default function ReservationsTable({
  reservations,
  seatsById,
  processingIds,
  onApprove,
  onCancel,
  readOnly = false,
  emptyMessage = 'No pending reservations right now.',
  emptyMessageId = 'no-pending-reservations',
}: ReservationsTableProps) {
  const showActions = !readOnly && Boolean(onApprove || onCancel)

  if (reservations.length === 0) {
    return (
      <p id={emptyMessageId} className="text-center text-gray-500 py-8">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table id="reservations-table" className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Guest</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Phone</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Seats</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Payment</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Servant</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Requested</th>
            {showActions && (
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {reservations.map((reservation) => {
            const isProcessing = processingIds.has(reservation.id!)
            const seatNumbers = getSeatNumbers(reservation, seatsById)
            return (
              <tr key={reservation.id} id={`reservation-row-${reservation.id}`}>
                <td className="px-3 py-2 font-medium text-gray-900">{reservation.guest_name}</td>
                <td className="px-3 py-2 text-gray-600">{reservation.phone_number}</td>
                <td className="px-3 py-2 text-gray-600">{seatNumbers.join(', ')}</td>
                <td className="px-3 py-2 text-gray-600">{reservation.payment_method}</td>
                <td className="px-3 py-2 text-gray-600">{reservation.servant_name}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                  {formatCreatedAt(reservation.created_at)}
                </td>
                {showActions && (
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {onApprove && (
                        <button
                          type="button"
                          id={`approve-btn-${reservation.id}`}
                          onClick={() => onApprove(reservation)}
                          disabled={isProcessing}
                          className="rounded-md bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
                        >
                          {isProcessing ? '…' : 'Approve'}
                        </button>
                      )}
                      {onCancel && (
                        <button
                          type="button"
                          id={`cancel-btn-${reservation.id}`}
                          onClick={() => onCancel(reservation)}
                          disabled={isProcessing}
                          className="rounded-md bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
                        >
                          {isProcessing ? '…' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

import { EVENT_CONFIG } from '../config/eventConfig'

interface WelcomePageProps {
  onBookNow: () => void
}

/**
 * Landing page shown to every guest: event details + a single
 * call-to-action that moves them into the seat-selection flow.
 */
export default function WelcomePage({ onBookNow }: WelcomePageProps) {
  return (
    <div
      id="welcome-page"
      className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4"
    >
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
        <div className="flex justify-center">
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 text-2xl">
            <i className="fas fa-graduation-cap" aria-hidden="true"></i>
          </span>
        </div>

        <div>
          <h1 id="event-title" className="text-2xl font-bold text-gray-900">
            {EVENT_CONFIG.title}
          </h1>
          <p className="text-gray-500 mt-2">{EVENT_CONFIG.description}</p>
        </div>

        <dl id="event-details" className="text-left grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm bg-gray-50 rounded-lg p-4">
          <dt className="text-gray-500 font-medium flex items-center gap-2">
            <i className="fas fa-calendar-day w-4" aria-hidden="true"></i> Date
          </dt>
          <dd className="text-gray-800">{EVENT_CONFIG.date}</dd>

          <dt className="text-gray-500 font-medium flex items-center gap-2">
            <i className="fas fa-clock w-4" aria-hidden="true"></i> Time
          </dt>
          <dd className="text-gray-800">{EVENT_CONFIG.time}</dd>

          <dt className="text-gray-500 font-medium flex items-center gap-2">
            <i className="fas fa-location-dot w-4" aria-hidden="true"></i> Venue
          </dt>
          <dd className="text-gray-800">{EVENT_CONFIG.venue}</dd>
        </dl>

        <button
          id="book-now-button"
          type="button"
          onClick={onBookNow}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-lg transition-colors"
        >
          Book Now
        </button>
      </div>
    </div>
  )
}

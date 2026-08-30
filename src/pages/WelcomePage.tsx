import { EVENT_CONFIG } from '../config/eventConfig'

interface WelcomePageProps {
  onBookNow: () => void
}

/**
 * Landing page shown to every guest: a premium "University Graduation"
 * hero section with event details + a single call-to-action that moves
 * them into the seat-selection flow.
 */
export default function WelcomePage({ onBookNow }: WelcomePageProps) {
  return (
    <div id="welcome-page" className="relative overflow-hidden">
      {/* Hero section — Navy Blue backdrop with a subtle gold accent glow */}
      <section
        id="hero-section"
        className="relative bg-navy-900 text-white px-4 pt-14 pb-24 sm:pt-20 sm:pb-32"
      >
        {/* Decorative background flourishes */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-gold-500/10 blur-3xl"></div>
          <div className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-navy-500/30 blur-3xl"></div>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"></div>
        </div>

        <div className="relative max-w-3xl mx-auto text-center space-y-7">
          <div className="flex justify-center">
            <span className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold-500/15 text-gold-400 text-3xl ring-1 ring-gold-400/40 shadow-gold-glow">
              <i className="fas fa-graduation-cap" aria-hidden="true"></i>
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-gold-400 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em]">
              You're Cordially Invited
            </p>
            <h1
              id="event-title"
              className="font-display text-3xl sm:text-5xl font-bold leading-tight text-white"
            >
              {EVENT_CONFIG.title}
            </h1>
            <p className="text-navy-100/90 max-w-xl mx-auto leading-relaxed text-sm sm:text-base">
              {EVENT_CONFIG.description}
            </p>
          </div>

          {/* Event details row */}
          <dl
            id="event-details"
            className="flex flex-col sm:flex-row items-stretch justify-center gap-3 sm:gap-4 max-w-2xl mx-auto pt-2"
          >
            <div className="flex-1 flex items-center justify-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3.5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gold-500/15 text-gold-400 shrink-0">
                <i className="fas fa-calendar-day" aria-hidden="true"></i>
              </span>
              <div className="text-left">
                <dt className="text-[11px] uppercase tracking-wider text-navy-100/60 font-medium">Date &amp; Time</dt>
                <dd className="text-sm font-semibold text-white">{EVENT_CONFIG.date}</dd>
                <dd className="text-xs text-navy-100/80">{EVENT_CONFIG.time}</dd>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3.5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gold-500/15 text-gold-400 shrink-0">
                <i className="fas fa-location-dot" aria-hidden="true"></i>
              </span>
              <div className="text-left">
                <dt className="text-[11px] uppercase tracking-wider text-navy-100/60 font-medium">Venue</dt>
                <dd className="text-sm font-semibold text-white">{EVENT_CONFIG.venue}</dd>
              </div>
            </div>
          </dl>

          <div className="pt-4">
            <button
              id="book-now-button"
              type="button"
              onClick={onBookNow}
              className="inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 active:scale-[0.98] text-navy-900 font-bold py-3.5 px-10 rounded-full text-base sm:text-lg shadow-gold-glow transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
            >
              Book Now
              <i className="fas fa-arrow-right-from-bracket rotate-180" aria-hidden="true"></i>
            </button>
            <p className="text-navy-100/60 text-xs mt-3">Seats are limited — reserve yours today.</p>
          </div>
        </div>
      </section>

      {/* Soft transition curve from the navy hero into the light page body */}
      <div className="h-10 sm:h-14 bg-gradient-to-b from-navy-900 to-gray-50" aria-hidden="true"></div>
    </div>
  )
}

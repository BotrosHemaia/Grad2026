import { useState } from 'react'
import WelcomePage from './pages/WelcomePage'
import BookingPage from './pages/BookingPage'

type View = 'welcome' | 'booking'

/**
 * Root component for the Guest View of the Graduation Party Seat
 * Reservation System.
 *
 * Simple two-screen flow (no router needed):
 *   WelcomePage --(Book Now)--> BookingPage --(Back)--> WelcomePage
 */
function App() {
  const [view, setView] = useState<View>('welcome')

  return (
    <div id="app-root" className="min-h-screen bg-gray-50 flex flex-col">
      <header id="app-header" className="bg-navy-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-center gap-2.5">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gold-500/20 text-gold-400 text-sm ring-1 ring-gold-500/40">
            <i className="fas fa-graduation-cap" aria-hidden="true"></i>
          </span>
          <h1 className="font-display text-base sm:text-lg font-semibold tracking-wide">
            Class of 2026 <span className="text-gold-400">&middot;</span> Seat Reservation
          </h1>
        </div>
      </header>

      <main id="app-main" className="flex-1">
        {view === 'welcome' && <WelcomePage onBookNow={() => setView('booking')} />}
        {view === 'booking' && <BookingPage onBack={() => setView('welcome')} />}
      </main>

      <footer id="app-footer" className="text-center text-xs text-gray-400 py-6 border-t border-gray-200 bg-white">
        <p>Secured by Firebase &middot; Graduation Party 2026</p>
        <a href="/admin" className="hover:text-navy-600 underline underline-offset-2 transition-colors">
          Admin Login
        </a>
      </footer>
    </div>
  )
}

export default App

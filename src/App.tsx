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
    <div id="app-root" className="min-h-screen bg-gray-50">
      <header id="app-header" className="bg-white shadow-sm py-4 text-center">
        <h1 className="text-lg font-bold text-gray-800">🎓 Graduation Party — Seat Reservation</h1>
      </header>

      <main id="app-main">
        {view === 'welcome' && <WelcomePage onBookNow={() => setView('booking')} />}
        {view === 'booking' && <BookingPage onBack={() => setView('welcome')} />}
      </main>

      <footer id="app-footer" className="text-center text-xs text-gray-400 py-6">
        <p>Backend: Firebase Firestore</p>
        <a href="/admin" className="hover:text-gray-600 underline">
          Admin Login
        </a>
      </footer>
    </div>
  )
}

export default App

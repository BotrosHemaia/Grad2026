import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import WelcomePage from './pages/WelcomePage'
import BookingPage from './pages/BookingPage'
import { auth } from './firebase/config'
import './golden-evening.css'

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
  const [guestAuthError, setGuestAuthError] = useState<string | null>(null)

  useEffect(() => {
    let signingIn = false
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user || signingIn) return
      signingIn = true
      try {
        await signInAnonymously(auth)
        setGuestAuthError(null)
      } catch (error) {
        console.error('Anonymous sign-in failed:', error)
        setGuestAuthError('Booking is temporarily unavailable. Please refresh and try again.')
      } finally {
        signingIn = false
      }
    })
    return unsubscribe
  }, [])

  return (
    <div id="app-root" className={`golden-app min-h-screen bg-gray-50 flex flex-col ${view === 'welcome' ? 'golden-home' : ''}`}>
      {view === 'welcome' && <header id="app-header" className="golden-header">
        <div className="golden-header-inner">
          <button type="button" className="golden-brand" onClick={() => setView('welcome')} aria-label="CALLED - CLASS OF 2026 home">
            <i className="fas fa-graduation-cap" aria-hidden="true" />
            <span>CALLED - CLASS OF 2026</span>
          </button>
          <nav className="golden-nav" aria-label="Event navigation">
            <a href="#event-details">Event details</a>
            <button type="button" className="golden-button golden-button-small" onClick={() => setView('booking')}>Book Now <span aria-hidden="true">→</span></button>
          </nav>
        </div>
      </header>}

      <main id="app-main" className="flex-1">
        {guestAuthError && (
          <p className="mx-auto mt-4 max-w-xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {guestAuthError}
          </p>
        )}
        {view === 'welcome' && <WelcomePage onBookNow={() => setView('booking')} />}
        {view === 'booking' && <BookingPage onBack={() => setView('welcome')} />}
      </main>

      <footer id="app-footer" className="text-center text-xs text-gray-400 py-6 border-t border-gray-200 bg-white">
        <p lang="ar" dir="rtl">اجتماع الملاك غبريال للشباب الجامعي</p>
        <a href="/admin" className="hover:text-navy-600 underline underline-offset-2 transition-colors">
          Admin Login
        </a>
      </footer>
    </div>
  )
}

export default App

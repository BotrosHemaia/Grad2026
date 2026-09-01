import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import WelcomePage from './pages/WelcomePage'
import BookingPage from './pages/BookingPage'
import { auth } from './firebase/config'

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
        {guestAuthError && (
          <p className="mx-auto mt-4 max-w-xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {guestAuthError}
          </p>
        )}
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

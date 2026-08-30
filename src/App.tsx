import SeatMapPage from './pages/SeatMapPage'
import ReservationsPage from './pages/ReservationsPage'

/**
 * Root layout for the Graduation Party Seat Reservation System.
 *
 * This is a structural skeleton only — no styling / final UI yet.
 * Semantic sections are wired to their respective pages so the
 * Firebase data layer can be exercised end-to-end.
 */
function App() {
  return (
    <div id="app-root">
      <header id="app-header">
        <h1>Graduation Party — Seat Reservation System</h1>
      </header>

      <main id="app-main">
        <section id="seat-map-section" aria-label="Seat Map">
          <SeatMapPage />
        </section>

        <section id="reservations-section" aria-label="Reservations">
          <ReservationsPage />
        </section>
      </main>

      <footer id="app-footer">
        <p>Backend: Firebase Firestore</p>
      </footer>
    </div>
  )
}

export default App

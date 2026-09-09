import { EVENT_CONFIG } from '../config/eventConfig'
interface WelcomePageProps { onBookNow: () => void }
export default function WelcomePage({ onBookNow }: WelcomePageProps) {
 return <div id="welcome-page" className="golden-welcome">
  <section id="hero-section" className="golden-hero" aria-labelledby="event-title">
   <img className="golden-hero-image" src="/images/graduation-hero.png" alt="" fetchPriority="high" />
   <div className="golden-hero-copy">
    <p className="golden-eyebrow">You're cordially invited</p>
    <h1 id="event-title">{EVENT_CONFIG.title}</h1>
    <p className="golden-intro">An evening to remember. A class to celebrate.</p>
    <button id="book-now-button" type="button" onClick={onBookNow} className="golden-button">Reserve your seat <span aria-hidden="true">→</span></button>
   </div>
  </section>
  <section className="golden-details-panel" aria-label="Event details">
   <dl id="event-details" className="golden-details">
    <div className="golden-detail"><i className="far fa-calendar" aria-hidden="true" /><div><dt>Date</dt><dd>{EVENT_CONFIG.date}</dd></div></div>
    <div className="golden-detail"><i className="far fa-clock" aria-hidden="true" /><div><dt>Time</dt><dd>{EVENT_CONFIG.time}</dd></div></div>
    <div className="golden-detail"><i className="fas fa-location-dot" aria-hidden="true" /><div><dt>Venue</dt><dd lang="ar" dir="rtl">{EVENT_CONFIG.venue}</dd></div></div>
   </dl>
   <p className="golden-keepsake">One class. A lifetime of memories.</p>
  </section>
 </div>
}

import { useState, type FormEvent } from 'react'
import { adminSignIn, describeAuthError } from '../services/authService'

/**
 * Simple admin login gate, backed by Firebase Authentication
 * (Email/Password). Create admin accounts in the Firebase Console under
 * Authentication > Users — there is no public sign-up flow here.
 */
export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await adminSignIn(email.trim(), password)
      // On success, the app's onAuthStateChanged listener (in AdminApp)
      // will detect the signed-in user and swap to the dashboard.
    } catch (err) {
      setError(describeAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div id="admin-login-page" className="min-h-screen flex items-center justify-center bg-navy-900 px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-gold-500/10 blur-3xl"></div>
        <div className="absolute bottom-0 -right-24 w-96 h-96 rounded-full bg-navy-500/30 blur-3xl"></div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative max-w-sm w-full bg-white rounded-2xl shadow-navy-lg p-8 space-y-4"
      >
        <div className="text-center space-y-1">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-navy-900 text-gold-400 text-2xl mx-auto ring-1 ring-gold-400/40">
            <i className="fas fa-lock" aria-hidden="true"></i>
          </span>
          <h1 className="font-display text-xl font-bold text-navy-900 mt-2">Admin Login</h1>
          <p className="text-sm text-gray-500">Sign in to manage seats and reservations.</p>
        </div>

        <div>
          <label htmlFor="admin-email-input" className="block text-sm font-medium text-navy-800 mb-1.5">
            Email
          </label>
          <input
            id="admin-email-input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            required
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-400 disabled:bg-gray-100 transition-colors duration-150"
          />
        </div>

        <div>
          <label htmlFor="admin-password-input" className="block text-sm font-medium text-navy-800 mb-1.5">
            Password
          </label>
          <input
            id="admin-password-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-400 disabled:bg-gray-100 transition-colors duration-150"
          />
        </div>

        {error && (
          <p id="admin-login-error" className="text-sm text-red-700 bg-red-100 rounded-lg p-2.5">
            <i className="fas fa-circle-exclamation mr-1.5" aria-hidden="true"></i>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-navy-900 hover:bg-navy-800 disabled:bg-gray-300 text-white font-semibold py-2.5 transition-colors duration-150"
        >
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

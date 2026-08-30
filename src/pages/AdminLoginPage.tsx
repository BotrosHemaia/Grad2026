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
    <div id="admin-login-page" className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-8 space-y-4"
      >
        <div className="text-center space-y-1">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 text-blue-600 text-2xl mx-auto">
            <i className="fas fa-lock" aria-hidden="true"></i>
          </span>
          <h1 className="text-xl font-bold text-gray-900 mt-2">Admin Login</h1>
          <p className="text-sm text-gray-500">Sign in to manage seats and reservations.</p>
        </div>

        <div>
          <label htmlFor="admin-email-input" className="block text-sm font-medium text-gray-700 mb-1">
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        <div>
          <label htmlFor="admin-password-input" className="block text-sm font-medium text-gray-700 mb-1">
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        {error && (
          <p id="admin-login-error" className="text-sm text-red-700 bg-red-100 rounded-md p-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-2.5 transition-colors"
        >
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

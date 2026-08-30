import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { subscribeToAuthState } from './services/authService'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminDashboardPage from './pages/AdminDashboardPage'

/**
 * Auth gate for the Admin Dashboard (mounted at the /admin route — see
 * main.tsx). Shows a loading state while Firebase resolves the current
 * auth session, then renders the login form or the dashboard depending on
 * whether an admin is signed in.
 */
export default function AdminApp() {
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((u) => {
      setUser(u)
      setAuthChecked(true)
    })
    return () => unsubscribe()
  }, [])

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Checking admin session…</p>
      </div>
    )
  }

  return user ? <AdminDashboardPage /> : <AdminLoginPage />
}

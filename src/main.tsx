import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AdminApp from './AdminApp'

/**
 * Minimal path-based routing: no router library needed for just two
 * top-level entry points. Anything under /admin renders the (auth-gated)
 * Admin Dashboard; everything else renders the Guest View.
 */
const isAdminRoute = window.location.pathname.startsWith('/admin')

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{isAdminRoute ? <AdminApp /> : <App />}</React.StrictMode>
)

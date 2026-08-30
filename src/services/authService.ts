/**
 * Admin authentication service backed by Firebase Authentication
 * (Email/Password provider).
 *
 * This gates the Admin Dashboard behind a real login instead of a
 * hardcoded client-side password, while staying simple: any account
 * created for admins in the Firebase Console (Authentication > Users)
 * can sign in here. There are no roles/permissions beyond
 * "is signed in" — see firestore.rules for how this is enforced
 * server-side (writes to seats/reservations require `request.auth != null`).
 */
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth'
import { auth } from '../firebase/config'

/** Sign an admin in with email + password. Throws on invalid credentials. */
export async function adminSignIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

/** Sign the current admin out. */
export async function adminSignOut(): Promise<void> {
  await signOut(auth)
}

/**
 * Subscribe to auth state changes (login/logout). Returns an unsubscribe
 * function — call it on component unmount / cleanup.
 */
export function subscribeToAuthState(
  callback: (user: User | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, callback)
}

/** Human-readable message for common Firebase Auth error codes. */
export function describeAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password.'
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.'
    default:
      return 'Failed to sign in. Please try again.'
  }
}

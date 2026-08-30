/**
 * Firebase app initialization.
 *
 * All configuration values are read from Vite environment variables so that
 * no secrets are hardcoded in source. Create a `.env.local` file at the
 * project root (never committed — see .gitignore) based on `.env.example`.
 *
 * Vite only exposes variables prefixed with `VITE_` to client code.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

function assertConfigPresent() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[firebase] Missing environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env.local and fill in your Firebase project credentials.'
    )
  }
}

assertConfigPresent()

export const app: FirebaseApp = initializeApp(firebaseConfig)
export const db: Firestore = getFirestore(app)

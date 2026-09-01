#!/usr/bin/env node

/**
 * Assign the Firebase Authentication custom claim { admin: true }.
 *
 * Authentication uses Google Application Default Credentials. Point
 * GOOGLE_APPLICATION_CREDENTIALS at a Firebase service-account JSON file
 * before running this script. Never commit that JSON file to the project.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function readEmailArgument() {
  const args = process.argv.slice(2)
  const emailFlagIndex = args.indexOf('--email')
  const email = emailFlagIndex >= 0 ? args[emailFlagIndex + 1] : args[0]

  if (!email || !email.includes('@')) {
    console.error('Usage: node scripts/setAdminClaim.mjs --email admin@example.com')
    process.exit(1)
  }

  return email.trim().toLowerCase()
}

async function main() {
  const email = readEmailArgument()

  initializeApp({ credential: applicationDefault() })
  const auth = getAuth()
  const user = await auth.getUserByEmail(email)

  // Merge instead of replacing unrelated custom claims already on the user.
  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims ?? {}),
    admin: true,
  })

  const updatedUser = await auth.getUser(user.uid)
  if (updatedUser.customClaims?.admin !== true) {
    throw new Error('The Admin SDK did not persist the admin claim.')
  }

  console.log(`Admin claim assigned successfully to ${updatedUser.email} (${updatedUser.uid}).`)
  console.log('Sign out and sign back in so the client receives a fresh Firebase ID token.')
}

main().catch((error) => {
  console.error('Failed to assign the admin claim:')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

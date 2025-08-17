'use server';

/**
 * @deprecated Use `firebase-admin-lazy.ts` instead for on-demand initialization.
 * This file eagerly initializes Firebase Admin which can cause issues if env vars
 * are not available at startup. Keep for reference or backward compatibility.
 */

import { cert, getApp, getApps, initializeApp, AppOptions, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;

try {
  // Attempt to get an existing Firebase Admin app instance
  adminApp = getApp();
} catch (error) {
  // No existing app found, so initialize a new one using service account
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountString) {
    throw new Error(
      'The FIREBASE_SERVICE_ACCOUNT environment variable is not set. ' +
      'Add it to your .env file and restart the server.'
    );
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    const options: AppOptions = {
      credential: cert(serviceAccount),
    };
    adminApp = initializeApp(options);
  } catch (parseError) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT. Ensure it is valid JSON.', parseError);
    throw new Error('The FIREBASE_SERVICE_ACCOUNT environment variable is not a valid JSON object.');
  }
}

const db = getFirestore(adminApp);
const auth = getAuth(adminApp);

export { adminApp, db, auth };

'use server';

import { cert, getApp, initializeApp, AppOptions, App } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;

// This approach is more secure and robust, especially for Vercel/production environments.
// It prevents the service account file from being bundled with the client-side code.
try {
  // Try to get the existing app instance first.
  adminApp = getApp();
} catch (error) {
  // If no app exists, initialize a new one.
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountString) {
    throw new Error('The FIREBASE_SERVICE_ACCOUNT environment variable is not set. Please add it to your .env file and restart the development server.');
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    const options: AppOptions = {
      credential: cert(serviceAccount),
    };
    adminApp = initializeApp(options);
  } catch (parseError) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT. Ensure it's a valid JSON string.", parseError);
    throw new Error("The FIREBASE_SERVICE_ACCOUNT environment variable is not a valid JSON object.");
  }
}

const db = getFirestore(adminApp);
const auth = getAuth(adminApp);

export { adminApp, db, auth, FieldValue, Timestamp };

    
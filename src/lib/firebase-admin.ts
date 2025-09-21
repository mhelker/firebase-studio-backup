// src/lib/firebase-admin.ts
import { cert, getApp, getApps, initializeApp, AppOptions, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;

try {
  // Use existing app if initialized
  adminApp = getApp();
} catch (error) {
  // Initialize a new app using service account
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountString) {
    throw new Error(
      'The FIREBASE_SERVICE_ACCOUNT environment variable is not set. Add it to your .env file and restart the server.'
    );
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    const options: AppOptions = { credential: cert(serviceAccount) };
    adminApp = initializeApp(options);
  } catch (parseError) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT. Ensure it is valid JSON.', parseError);
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not valid JSON.');
  }
}

// Firestore and Auth instances
const db = getFirestore(adminApp);
const auth = getAuth(adminApp);

export { adminApp, db, auth }; // ✅ export db and auth properly
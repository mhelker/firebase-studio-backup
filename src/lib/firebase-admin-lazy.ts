

import { cert, getApp, initializeApp, AppOptions, App } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;

try {
  // Try to get existing Firebase Admin app instance
  adminApp = getApp();
} catch (error) {
  // Initialize new app with service account from environment variable
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

export { adminApp, db, auth, FieldValue, Timestamp };    
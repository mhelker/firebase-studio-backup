// src/lib/firebase-admin-lazy.ts
import { initializeApp, getApps, getApp, cert, FirebaseApp } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

// Private variable to hold the initialized app instance
let _adminAppInstance: FirebaseApp | undefined;

/**
 * Returns the Firebase Admin App instance, initializing it if it hasn't been already.
 * Ensures the app is only initialized once globally.
 */
export function getFirebaseAdminApp(): FirebaseApp {
  if (!_adminAppInstance) {
    // Check if an app is already initialized by Firebase Admin SDK (e.g., from a previous hot reload or invocation)
    if (getApps().length === 0) {
      // Ensure environment variables are defined
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Missing Firebase Admin environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY.');
      }

      _adminAppInstance = initializeApp({
        credential: cert({
          projectId: projectId,
          clientEmail: clientEmail,
          // Vercel sometimes escapes newlines, replace them
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      // If an app already exists, get it (e.g., in a development server context)
      _adminAppInstance = getApp();
    }
  }
  return _adminAppInstance;
}

// Private variable for Firestore instance
let _dbInstance: Firestore | undefined;

/**
 * Returns the Firebase Admin Firestore instance, ensuring the Admin App is initialized first.
 */
export function getFirebaseAdminFirestore(): Firestore {
  if (!_dbInstance) {
    const app = getFirebaseAdminApp(); // Ensure the app is initialized
    _dbInstance = getFirestore(app);
  }
  return _dbInstance;
}

// Private variable for Auth instance
let _authInstance: Auth | undefined;

/**
 * Returns the Firebase Admin Auth instance, ensuring the Admin App is initialized first.
 */
export function getFirebaseAdminAuth(): Auth {
  if (!_authInstance) {
    const app = getFirebaseAdminApp(); // Ensure the app is initialized
    _authInstance = getAuth(app);
  }
  return _authInstance;
}

// Re-export FieldValue and Timestamp for convenience if you use them directly from admin SDK in other files
export { FieldValue, Timestamp };
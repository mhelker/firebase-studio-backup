// src/lib/firebase-admin-lazy.ts

import { cert, getApp, initializeApp, AppOptions, App } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

let adminApp: App;

// Initialize Firebase Admin App
try {
  adminApp = getApp();
} catch (error) {
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountString) {
    throw new Error(
      "The FIREBASE_SERVICE_ACCOUNT environment variable is not set."
    );
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountString);
  } catch (parseError) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT.", parseError);
    throw new Error(
      "The FIREBASE_SERVICE_ACCOUNT environment variable is not valid JSON."
    );
  }

  const options: AppOptions = {
    credential: cert(serviceAccount),
  };

  adminApp = initializeApp(options);
}

// Firestore instance
const db: Firestore = getFirestore(adminApp);

// Auth instance
const auth: Auth = getAuth(adminApp);

// Export functions for API routes
export const getFirebaseAdminFirestore = (): Firestore => db;
export const getFirebaseAdminAuth = (): Auth => auth;

// Also export some helpers if needed
export { adminApp, FieldValue, Timestamp };
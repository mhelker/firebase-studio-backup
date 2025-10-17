// src/lib/firebase-admin-lazy.ts
import { cert, getApp, initializeApp, AppOptions, App } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

let adminApp: App;

try {
  adminApp = getApp();
} catch (error) {
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountString) {
      console.error("FIREBASE_SERVICE_ACCOUNT not set. Firebase Admin SDK might not initialize.");
      throw new Error("FIREBASE_SERVICE_ACCOUNT not set.");
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountString);
  } catch (parseError) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON:", parseError);
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON.");
  }

  const options: AppOptions = { credential: cert(serviceAccount) };
  adminApp = initializeApp(options);
}

// Initialize Firestore and Auth instances here
const adminDb = getFirestore(adminApp); // Rename to adminDb for clarity when importing
const adminAuth = getAuth(adminApp);   // Rename to adminAuth for clarity when importing

// Export all necessary components directly
export { adminApp, adminDb, adminAuth, FieldValue, Timestamp };
export function getFirebaseAdminFirestore() {
  return adminDb;
}
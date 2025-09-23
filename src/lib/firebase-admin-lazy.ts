// src/lib/firebase-admin-lazy.ts
import { cert, getApp, initializeApp, AppOptions, App } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

let adminApp: App;

try {
  adminApp = getApp();
} catch (error) {
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountString) throw new Error("FIREBASE_SERVICE_ACCOUNT not set.");

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountString);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON.");
  }

  const options: AppOptions = { credential: cert(serviceAccount) };
  adminApp = initializeApp(options);
}

// Export functions instead of direct instances
export function getFirebaseAdminFirestore(): Firestore {
  return getFirestore(adminApp);
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(adminApp);
}

export { FieldValue, Timestamp };
import { cert, getApp, initializeApp, AppOptions, App } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;
let db: FirebaseFirestore.Firestore;
let auth: adminAuth.Auth;

try {
  adminApp = getApp();
} catch (error) {
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountString) {
    throw new Error('The FIREBASE_SERVICE_ACCOUNT environment variable is not set.');
  }
  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    const options: AppOptions = {
      credential: cert(serviceAccount),
    };
    adminApp = initializeApp(options);
  } catch (parseError) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT.', parseError);
    throw new Error('The FIREBASE_SERVICE_ACCOUNT environment variable is not valid JSON.');
  }
}

db = getFirestore(adminApp);
auth = getAuth(adminApp);

export { adminApp, db, auth, FieldValue, Timestamp };
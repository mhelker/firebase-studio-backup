
import { cert, getApp, getApps, AppOptions, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ✅ Import service account from lib folder
import serviceAccount from '../../firebaseServiceAccount.json';

let adminApp;

if (!getApps().length) {
  const options: AppOptions = {
    credential: cert(serviceAccount as any),
  };
  adminApp = initializeApp(options);
} else {
  adminApp = getApp();
}

const db = getFirestore(adminApp);
const auth = getAuth(adminApp);

export { adminApp, db, auth };

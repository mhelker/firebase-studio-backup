// IMPORTANT: Loads environment variables before Firebase SDK initialization
import 'dotenv/config';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, runTransaction, enableIndexedDbPersistence, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Conditionally determine the storage bucket based on the environment
const storageBucket =
  process.env.NODE_ENV === 'production'
    ? process.env.NEXT_PUBLIC_STORAGE_BUCKET
    : 'talenthop.firebasestorage.app';

// Firebase config sourced from environment variables
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
  storageBucket: storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_APP_ID,
};

// Initialize Firebase app (singleton pattern)
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);

// Enable Firestore offline persistence (multi-tab)
const enablePersistence = async () => {
  if (typeof window !== 'undefined' && db) {
    try {
      await enableIndexedDbPersistence(db, { synchronizeTabs: true });
    } catch (error: any) {
      if (error.code === 'failed-precondition') {
        console.warn('Firestore persistence failed: only one tab can enable persistence at a time.');
      } else if (error.code === 'unimplemented') {
        console.warn('Firestore persistence is not supported by this browser.');
      } else {
        console.error('Error enabling Firestore persistence:', error);
      }
    }
  }
};
enablePersistence();

const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

export { app, db, auth, storage, runTransaction, isFirebaseConfigured };
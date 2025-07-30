
// IMPORTANT: This line ensures environment variables are loaded before Firebase is initialized.
import 'dotenv/config';

// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, runTransaction, enableIndexedDbPersistence, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";

// =================================================================================
// IMPORTANT: YOUR FIREBASE KEYS ARE NOW SOURCED FROM YOUR .env FILE
// =================================================================================
// This configuration exclusively uses environment variables for security.
// Ensure your .env file has the following keys from your Firebase project console:
//
// NEXT_PUBLIC_API_KEY=your_api_key
// NEXT_PUBLIC_AUTH_DOMAIN=your_auth_domain
// NEXT_PUBLIC_PROJECT_ID=your_project_id
// NEXT_PUBLIC_STORAGE_BUCKET=your_storage_bucket
// NEXT_PUBLIC_MESSAGING_SENDER_ID=your_messaging_sender_id
// NEXT_PUBLIC_APP_ID=your_app_id
//
// If you make changes to your .env file, you MUST restart the development server.
// =================================================================================

export const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_APP_ID
  };

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);

// Asynchronously enable Firestore offline persistence
const enablePersistence = async () => {
    if (typeof window !== 'undefined' && db) {
        try {
            // Enable multi-tab persistence to allow offline access across multiple tabs.
            await enableIndexedDbPersistence(db, { synchronizeTabs: true });
        } catch (error: any) {
            if (error.code === 'failed-precondition') {
                console.warn("Firestore persistence failed: can only be enabled in one tab at a time.");
            } else if (error.code === 'unimplemented') {
                console.warn("Firestore persistence is not supported in this browser.");
            } else {
                console.error("An error occurred while enabling Firestore persistence:", error);
            }
        }
    }
};
enablePersistence();


// This flag helps components know if they should attempt Firebase operations.
const isFirebaseConfigured = !!firebaseConfig.apiKey;

export { app, db, auth, storage, runTransaction, isFirebaseConfigured };

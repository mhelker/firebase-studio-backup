// migrate-userId-to-customerId.ts
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Make sure you have your service account JSON string in FIREBASE_SERVICE_ACCOUNT
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountString) throw new Error("FIREBASE_SERVICE_ACCOUNT not set.");
const serviceAccount = JSON.parse(serviceAccountString);

// Initialize Firebase Admin
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function migrateBookings() {
  const snapshot = await db.collection("bookings").get();
  console.log(`Found ${snapshot.size} bookings`);

  let migratedCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    // Only migrate if:
    // 1️⃣ userId exists
    // 2️⃣ customerId does NOT exist yet
    // 3️⃣ userId !== performerId (so we don't touch performers)
    if (
      data.userId &&
      !data.customerId &&
      data.userId !== data.performerId
    ) {
      await db.collection("bookings").doc(docSnap.id).update({
        customerId: data.userId,
        userId: FieldValue.delete(), // remove old field
      });
      migratedCount++;
      console.log(`Migrated booking ${docSnap.id}`);
    }
  }

  console.log(`Migration complete. Total bookings updated: ${migratedCount}`);
}

migrateBookings()
  .then(() => console.log("All done!"))
  .catch((err) => console.error("Migration error:", err));
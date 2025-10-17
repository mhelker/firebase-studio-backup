// src/app/api/submit-feedback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { collection, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from '@/lib/firebase'; // Assuming this is your client-side Firebase Firestore instance
// Import the specific functions from your admin lazy file
import { adminDb, adminAuth } from '@/lib/firebase-admin-lazy';
// Removed: import { auth } from 'firebase-admin'; // No longer needed here
// Removed: import { getAuth } from 'firebase/auth'; // This is client-side auth, not for server token verification

const SubmitFeedbackInputSchema = z.object({
  feedback: z.string().min(10).max(1000).describe('The user feedback text.'),
});

// A helper to verify the user's token from the request
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
    const authorization = req.headers.get("Authorization");
    if (authorization?.startsWith("Bearer ")) {
        const idToken = authorization.split("Bearer ")[1];
        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken); // ✅ use adminAuth directly
            return decodedToken.uid;
        } catch (error) {
            console.error("Error verifying auth token:", error);
            return null;
        }
    }
    return null;
}

export async function POST(req: NextRequest) {
  try {
    // Authentication Check
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { feedback } = SubmitFeedbackInputSchema.parse(body);

    const feedbackData = {
      feedback: feedback,
      submittedAt: serverTimestamp(),
      submittedBy: userId,
      status: 'new',
    };

    await addDoc(collection(db, "feedback"), feedbackData); // Using client-side db
    
    return NextResponse.json({ message: "Feedback submitted successfully." });

  } catch (error: any) {
    console.error("Error in submit-feedback API route:", error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: "Invalid input.", errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message || "An internal server error occurred." }, { status: 500 });
  }
}
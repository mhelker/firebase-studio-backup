// src/app/api/submit-suggestion/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { collection, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from '@/lib/firebase'; // Assuming this is your client-side Firebase Firestore instance
// Import the specific functions from your admin lazy file
import { getFirebaseAdminAuth } from '@/lib/firebase-admin-lazy';
// Removed: import { auth } from 'firebase-admin'; // No longer needed here

const SubmitSuggestionInputSchema = z.object({
  suggestion: z.string().describe('The user suggestion text.'),
});

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
    const authorization = req.headers.get("Authorization");
    if (authorization?.startsWith("Bearer ")) {
        const idToken = authorization.split("Bearer ")[1];
        try {
            const adminAuth = getFirebaseAdminAuth(); // Get the Admin Auth instance
            // FIX: Typo 'verifyIdIdToken' corrected to 'verifyIdToken'
            const decodedToken = await adminAuth.verifyIdToken(idToken); // Use it to verify the token
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
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { suggestion } = SubmitSuggestionInputSchema.parse(body);

    const suggestionData = {
      suggestion: suggestion,
      comment: '',
      status: 'new',
      createdAt: serverTimestamp(),
      commentedAt: null,
      suggestedBy: userId,
    };
    await addDoc(collection(db, "suggestions"), suggestionData); // Using client-side db
    
    return NextResponse.json({ message: "Suggestion submitted successfully." });

  } catch (error: any) {
    console.error("Error in submit-suggestion API route:", error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: "Invalid input.", errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message || "An internal server error occurred." }, { status: 500 });
  }
}
// src/app/api/submit-suggestion/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { collection, serverTimestamp, addDoc } from "firebase/firestore"; 
import { db } from '@/lib/firebase';
import { getFirebaseAdminApp } from '@/lib/firebase-admin-lazy';
import { auth } from 'firebase-admin';

const SubmitSuggestionInputSchema = z.object({
  suggestion: z.string().describe('The user suggestion text.'),
});

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
    const authorization = req.headers.get("Authorization");
    if (authorization?.startsWith("Bearer ")) {
        const idToken = authorization.split("Bearer ")[1];
        try {
            const adminApp = getFirebaseAdminApp();
            const decodedToken = await auth(adminApp).verifyIdIdToken(idToken);
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
    await addDoc(collection(db, "suggestions"), suggestionData);
    
    return NextResponse.json({ message: "Suggestion submitted successfully." });

  } catch (error: any) {
    console.error("Error in submit-suggestion API route:", error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: "Invalid input.", errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message || "An internal server error occurred." }, { status: 500 });
  }
}
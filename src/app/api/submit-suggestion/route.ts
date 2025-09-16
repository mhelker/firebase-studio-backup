// src/app/api/submit-suggestion/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore, FieldValue } from '@/lib/firebase-admin-lazy';

const SubmitSuggestionInputSchema = z.object({
  suggestion: z.string().describe('The user suggestion text.'),
});

// Verifies the Firebase ID token from Authorization header
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authorization = req.headers.get("Authorization");
  if (authorization?.startsWith("Bearer ")) {
    const idToken = authorization.split("Bearer ")[1];
    try {
      const adminAuth = getFirebaseAdminAuth();
      const decodedToken = await adminAuth.verifyIdToken(idToken);
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

    const db = getFirebaseAdminFirestore(); // Admin Firestore instance
    await db.collection("suggestions").add({
      suggestion,
      comment: '',
      status: 'new',
      createdAt: FieldValue.serverTimestamp(),
      commentedAt: null,
      suggestedBy: userId,
    });

    return NextResponse.json({ message: "Suggestion submitted successfully." });

  } catch (error: any) {
    console.error("Error in submit-suggestion API route:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid input.", errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message || "An internal server error occurred." }, { status: 500 });
  }
}
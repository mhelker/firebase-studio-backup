// src/app/api/comment-on-suggestion/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from '@/lib/firebase'; // Assuming this is your client-side Firebase Firestore instance
import { isAdmin } from '@/lib/admin-config';
// Import the specific functions from your admin lazy file
import { getFirebaseAdminAuth } from '@/lib/firebase-admin-lazy';
// Removed: import { auth } from 'firebase-admin'; // No longer needed here

const CommentOnSuggestionInputSchema = z.object({
    suggestionId: z.string().describe("The ID of the suggestion document to comment on."),
    comment: z.string().describe("The comment text."),
});

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
    const authorization = req.headers.get("Authorization");
    if (authorization?.startsWith("Bearer ")) {
        const idToken = authorization.split("Bearer ")[1];
        try {
            const adminAuth = getFirebaseAdminAuth(); // Get the Admin Auth instance
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
    if (!userId || !isAdmin(userId)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { suggestionId, comment } = CommentOnSuggestionInputSchema.parse(body);

    const suggestionDocRef = doc(db, "suggestions", suggestionId); // Using client-side db
    await updateDoc(suggestionDocRef, {
        comment: comment,
        status: 'commented',
        commentedAt: serverTimestamp(),
    });

    return NextResponse.json({ message: "Comment added successfully." });

  } catch (error: any) {
    console.error("Error in comment-on-suggestion API route:", error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: "Invalid input.", errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message || "An internal server error occurred." }, { status: 500 });
  }
}
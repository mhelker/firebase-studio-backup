// src/app/api/comment-on-suggestion/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFirebaseAdminFirestore, getFirebaseAdminAuth } from "@/lib/firebase-admin-lazy";

// Input validation
const CommentOnSuggestionInputSchema = z.object({
  suggestionId: z.string(),
  comment: z.string(),
});

// Optional: admin check
import { isAdmin } from "@/lib/admin-config";

// Get user ID from request
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authorization = req.headers.get("Authorization");
  if (authorization?.startsWith("Bearer ")) {
    const idToken = authorization.split("Bearer ")[1];
    try {
      const auth = getFirebaseAdminAuth();
      const decodedToken = await auth.verifyIdToken(idToken);
      return decodedToken.uid;
    } catch (error) {
      console.error("Error verifying auth token:", error);
      return null;
    }
  }
  return null;
}

// POST handler
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId || !isAdmin(userId)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { suggestionId, comment } = CommentOnSuggestionInputSchema.parse(body);

    const db = getFirebaseAdminFirestore(); // Admin Firestore

    // 🔹 Correct Admin SDK document reference
    const suggestionDocRef = db.doc(`suggestions/${suggestionId}`);

    await suggestionDocRef.update({
      comment,
      status: "commented",
      commentedAt: new Date(), // Use JS Date with Admin SDK
    });

    return NextResponse.json({ message: "Comment added successfully." });
  } catch (error: any) {
    console.error("Error in comment-on-suggestion API route:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid input.", errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: error.message || "Internal server error." }, { status: 500 });
  }
}
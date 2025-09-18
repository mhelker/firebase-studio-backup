import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin-lazy";
import { z } from "zod";

// --- Input validation schema ---
const commentSchema = z.object({
  suggestionId: z.string().min(1),
  comment: z.string().min(10),
});

export async function POST(req: NextRequest) {
  try {
    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminFirestore();

    // --- 1. Get ID token from Authorization header ---
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Missing or invalid Authorization header." }, { status: 403 });
    }

    const idToken = authHeader.split("Bearer ")[1];

    // --- 2. Verify token ---
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (err) {
      console.error("Error verifying ID token:", err);
      return NextResponse.json({ message: "Invalid or expired token." }, { status: 403 });
    }
    const uid = decodedToken.uid;

    // --- 3. Validate request body ---
    const body = await req.json();
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid request body.", errors: parsed.error.errors }, { status: 400 });
    }
    const { suggestionId, comment } = parsed.data;

    // --- 4. Update the suggestion document ---
    const suggestionRef = db.collection("suggestions").doc(suggestionId);

    await suggestionRef.update({
      comment,
      commentedAt: new Date(),
      status: "commented",
      commentedBy: uid,
    });

    return NextResponse.json({ message: "Comment submitted successfully!" });
  } catch (error) {
    console.error("Error in comment-on-suggestion API:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}
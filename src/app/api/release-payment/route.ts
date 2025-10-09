// src/app/api/release-payment/route.ts
import { NextRequest, NextResponse } from "next/server";
import { releasePayment } from "@/lib/payments";

export async function POST(req: NextRequest) {
  const { bookingId } = await req.json();
  if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

  try {
    const transfer = await releasePayment(bookingId);
    return NextResponse.json({ success: true, transfer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
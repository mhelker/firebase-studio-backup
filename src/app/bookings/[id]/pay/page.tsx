"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ReviewAndTipForm } from "@/components/review-and-tip-form";
import type { Booking } from "@/types";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function BookingPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const bookingRef = doc(db, "bookings", params.id as string);
        const bookingSnap = await getDoc(bookingRef);
        if (bookingSnap.exists()) {
          const bookingData = bookingSnap.data() as Booking;
          console.log("Fetched booking data:", bookingData);

          if (!bookingData.performerId) {
            setError("Booking is missing performerId. Please check Firestore.");
          } else {
            setBooking(bookingData);
          }
        } else {
          setError("Booking not found.");
        }
      } catch (err) {
        console.error("Error fetching booking:", err);
        setError("Failed to load booking data.");
      }
    };

    fetchBooking();
  }, [params.id]);

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Leave a Review & Tip</h1>

      {error && (
        <div className="text-red-600 border border-red-400 p-4 rounded mb-4">
          {error}
        </div>
      )}

      {!booking && !error ? (
        <p>Loading booking details...</p>
      ) : booking && booking.performerId ? (
        <Elements stripe={stripePromise}>
          <ReviewAndTipForm
            performerId={booking.performerId}
            bookingId={params.id as string}
            onReviewSubmitted={() => router.push(`/dashboard`)}
          />
        </Elements>
      ) : null}
    </main>
  );
}
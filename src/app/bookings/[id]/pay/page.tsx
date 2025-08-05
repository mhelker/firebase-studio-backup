
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ReviewAndTipForm } from "@/components/review-and-tip-form";
import type { Booking } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

export default function BookingPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBooking = async () => {
      setIsLoading(true);
      try {
        const bookingRef = doc(db, "bookings", params.id as string);
        const bookingSnap = await getDoc(bookingRef);
        if (bookingSnap.exists()) {
          const bookingData = bookingSnap.data() as Booking;
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
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) {
      fetchBooking();
    }
  }, [params.id]);

  if (isLoading) {
    return <p>Loading booking details...</p>;
  }

  if (error) {
    return (
      <div className="text-red-600 border border-red-400 p-4 rounded mb-4">
        {error}
      </div>
    );
  }

  if (booking?.customerReviewSubmitted) {
    return (
        <main className="max-w-2xl mx-auto p-6 text-center">
             <Card>
                <CardHeader>
                    <div className="mx-auto bg-green-100 rounded-full h-16 w-16 flex items-center justify-center">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <CardTitle className="mt-4">Review Already Submitted</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground mb-6">
                        Thank you! You have already submitted a review for this performance.
                    </p>
                    <Button asChild>
                        <Link href="/bookings">Return to My Bookings</Link>
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
  }


  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Leave a Review & Tip</h1>
      
      {booking && booking.performerId ? (
          <ReviewAndTipForm
            performerId={booking.performerId}
            bookingId={params.id as string}
            onReviewSubmitted={() => router.push(`/dashboard`)}
          />
      ) : (
        <p>Booking details could not be loaded.</p>
      )}
    </main>
  );
}

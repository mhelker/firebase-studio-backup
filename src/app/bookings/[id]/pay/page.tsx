
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Booking } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, Loader2, AlertTriangle, CreditCard } from "lucide-react";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

// Initialize Stripe outside of the component to avoid re-creating it on every render.
// Ensure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set in your .env file.
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function CheckoutForm({ booking, onPaymentSuccess }: { booking: Booking, onPaymentSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) {
      toast({ title: "Payment system not ready.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (error) {
        throw new Error(error.message || "An unexpected payment error occurred.");
      }

      // If payment is successful, update booking status to 'confirmed'
      const bookingRef = doc(db, "bookings", booking.id);
      await updateDoc(bookingRef, {
        status: "confirmed",
      });

      toast({
        title: "Payment Successful!",
        description: "Your booking is confirmed. The performer has been notified.",
      });
      onPaymentSuccess();

    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <Button disabled={!stripe || isProcessing} className="w-full mt-6">
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Pay $${booking.pricePerHour.toFixed(2)}`
        )}
      </Button>
    </form>
  );
}


export default function BookingPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!stripePromise) {
      setError("Stripe is not configured. Please add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your .env file and restart the server.");
      setIsLoading(false);
    }

    const fetchBookingAndIntent = async () => {
      if (!params.id || !user || !stripePromise) return;
      setIsLoading(true);

      try {
        const bookingRef = doc(db, "bookings", params.id as string);
        const bookingSnap = await getDoc(bookingRef);

        if (!bookingSnap.exists()) throw new Error("Booking not found.");
        
        const bookingData = { id: bookingSnap.id, ...bookingSnap.data() } as Booking;
        
        if (bookingData.userId !== user.uid) {
            throw new Error("You are not authorized to pay for this booking.");
        }
        
        if (bookingData.status !== 'awaiting_payment') {
            setError(`This booking cannot be paid for. Its status is: ${bookingData.status}.`);
            setBooking(bookingData);
            setIsLoading(false);
            return;
        }
        
        setBooking(bookingData);

        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: bookingData.pricePerHour, bookingId: bookingData.id }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create payment intent.');
        }

        setClientSecret(result.clientSecret);

      } catch (err: any) {
        console.error("Error fetching booking or creating intent:", err);
        setError(err.message || "Failed to load booking data.");
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id && !authLoading && user) {
      fetchBookingAndIntent();
    }
     if (!authLoading && !user) {
        setError("You must be logged in to complete this payment.");
        setIsLoading(false);
    }
  }, [params.id, authLoading, user]);


  if (isLoading) {
    return (
        <main className="max-w-md mx-auto p-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground mt-4">Loading secure payment form...</p>
        </main>
    );
  }

  if (error) {
    return (
       <main className="max-w-md mx-auto p-6">
            <Card className="border-destructive">
                <CardHeader>
                    <div className="mx-auto bg-destructive/10 rounded-full h-16 w-16 flex items-center justify-center">
                        <AlertTriangle className="h-10 w-10 text-destructive" />
                    </div>
                    <CardTitle className="mt-4 text-center">Payment Error</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-center text-muted-foreground mb-6">
                        {error}
                    </p>
                    <Button asChild className="w-full">
                        <Link href="/bookings">Return to My Bookings</Link>
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
  }

  if (booking?.status === 'confirmed') {
     return (
        <main className="max-w-md mx-auto p-6 text-center">
             <Card>
                <CardHeader>
                    <div className="mx-auto bg-green-100 rounded-full h-16 w-16 flex items-center justify-center">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <CardTitle className="mt-4">Booking Already Paid</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground mb-6">
                        Thank you! This booking has already been paid and is confirmed.
                    </p>
                    <Button asChild>
                        <Link href="/bookings">Return to My Bookings</Link>
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
  }
  
  if (!booking || !clientSecret || !stripePromise) {
      return (
        <main className="max-w-md mx-auto p-6 text-center">
            <p>Could not initialize payment details. Please try again.</p>
        </main>
      );
  }

  return (
    <main className="max-w-md mx-auto p-6">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="w-6 h-6 text-primary"/> Secure Payment</CardTitle>
                <CardDescription>
                    Confirm your payment for the booking with <span className="font-semibold">{booking.performerName}</span> on <span className="font-semibold">{new Date(booking.date.toDate()).toLocaleDateString()}.</span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="text-center p-4 bg-secondary/30 rounded-lg mb-6">
                    <p className="text-sm text-muted-foreground">Total Amount Due</p>
                    <p className="text-4xl font-bold text-primary">${booking.pricePerHour.toFixed(2)}</p>
                 </div>
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <CheckoutForm booking={booking} onPaymentSuccess={() => router.push('/bookings')} />
                </Elements>
            </CardContent>
        </Card>
    </main>
  );
}

    
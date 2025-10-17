"use client";

import { useEffect, useState, useCallback } from "react";
import { notFound, useRouter, useParams } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import type { Booking } from "@/types";
import { Loader2, AlertTriangle, Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
// --- FIX 1: Corrected import path for loadStripe ---
import { loadStripe } from "@stripe/stripe-js";
// --- END FIX 1 ---
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function CheckoutForm({
  booking,
  onPaymentSuccess,
}: {
  booking: Booking;
  onPaymentSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    console.log("Attempting to confirm payment...");
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/bookings/${booking.id}/payment-status`,
      },
    });
    console.log("stripe.confirmPayment returned:");
    console.log("Error:", error);
    console.log("PaymentIntent:", paymentIntent);

    if (error) {
      console.error("Payment confirmation error:", error);
      setErrorMessage(error.message || "An unexpected error occurred.");
      setIsProcessing(false);
      return;
    }

    console.log("PaymentIntent status:", paymentIntent?.status);

    if (paymentIntent && paymentIntent.status === "succeeded") {
      try {
        const bookingRef = doc(db, "bookings", booking.id);
        await updateDoc(bookingRef, { status: "confirmed", stripePaymentIntentId: paymentIntent.id });
        onPaymentSuccess(paymentIntent.client_secret!); // Pass the client_secret
      } catch (dbError) {
        console.error("Error updating booking status after Stripe success:", dbError);
        setErrorMessage(
          "Payment succeeded but updating booking failed. Please contact support."
        );
      }
    } else if (paymentIntent && paymentIntent.status !== "succeeded") {
        // If not succeeded immediately (e.g., processing, requires_action),
        // we'll rely on the return_url page or webhook to update the status.
        // The user will be redirected to payment-status page, where the final status is checked.
        onPaymentSuccess(paymentIntent.client_secret!); // Pass the client_secret
    }
    // No extra curly brace here. The `if/else if` block correctly closes itself.


    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement id="payment-element" />
      {errorMessage && (
        <Alert variant="destructive" className="flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <Button disabled={isProcessing || !stripe || !elements} className="w-full" type="submit">
        {isProcessing ? (
          <Loader2 className="animate-spin mr-2" />
        ) : (
          <Lock className="mr-2 h-4 w-4" />
        )}
        Pay ${booking.pricePerHour.toFixed(2)}
      </Button>
    </form>
  );
}

export default function PayForBookingPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const router = useRouter();
  // Add a state to track if clientSecret has been fetched successfully
  const [clientSecretFetched, setClientSecretFetched] = useState(false);


  const getBookingDetails = useCallback(
    async (uid: string) => {
      // Prevent re-fetching if clientSecret is already fetched for this booking
      if (clientSecretFetched && clientSecret) {
        setIsLoading(false);
        return;
      }
      
      console.log("--- getBookingDetails called --- for user:", uid, "Booking ID:", params.id);

      const bookingId = params.id;
      if (!bookingId) {
        setError("Booking ID not found in the URL.");
        setIsLoading(false);
        return;
      }

      try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef); // <--- CHANGE TO THIS

        if (!bookingSnap.exists()) {
          notFound(); // Next.js built-in notFound()
          return;
        }

        const bookingData = {
          id: bookingSnap.id,
          ...bookingSnap.data(),
        } as Booking;

        if (bookingData.customerId !== uid) {
          setError("You do not have permission to view this page.");
          setIsLoading(false); // Stop loading here as well
          return;
        }

        if (bookingData.status !== "awaiting_payment") {
          setError(
            `This booking cannot be paid for. Its status is: ${bookingData.status}.`
          );
          setIsLoading(false); // Stop loading here as well
          return;
        }

        setBooking(bookingData);

        const idToken = await user?.getIdToken();

        if (!idToken) {
          throw new Error("Authentication token missing. Please log in again.");
        }

        console.log("--- Fetching /api/create-payment-intent --- for booking:", bookingData.id);
        const res = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            amount: bookingData.pricePerHour,
            bookingId: bookingData.id,
          }),
        });

        if (!res.ok) {
          const { error: serverError } = await res.json();
          if (serverError && serverError.includes("Stripe is not configured")) {
            setIsDemoMode(true);
            setError(serverError);
          } else {
            throw new Error(serverError || "Failed to create payment intent.");
          }
        } else {
          const { clientSecret: newClientSecret } = await res.json();
          setClientSecret(newClientSecret);
          setClientSecretFetched(true); // Mark clientSecret as fetched successfully
        }
      } catch (err: any) {
        console.error("Error processing booking payment page:", err);
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    },
    [params.id, user, clientSecretFetched, clientSecret] // Add clientSecretFetched and clientSecret to dependencies
  );

  useEffect(() => {
    console.log("--- useEffect in PayForBookingPage running --- User:", user?.uid, "AuthLoading:", authLoading, "ClientSecretFetched:", clientSecretFetched);
    if (!authLoading && user && !clientSecretFetched) { // Only fetch if not already fetched
      setIsLoading(true); // Ensure loading state is true when fetching starts
      getBookingDetails(user.uid);
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [user, authLoading, getBookingDetails, clientSecretFetched]); // Add clientSecretFetched here too

  // Find this block:
  // const onPaymentSuccess = () => {
  //   router.push(`/bookings/${params.id}/payment-status`);
  // };

  // And replace it with this:
  const onPaymentSuccess = (clientSecretFromResult: string) => {
    // Use router.replace to navigate, including the clientSecret as a query parameter
    router.replace(`/bookings/${params.id}/payment-status?payment_intent_client_secret=${clientSecretFromResult}`);
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading payment details...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Login Required</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">You must be logged in to pay for a booking.</p>
          <Button asChild className="mt-4">
            <Link href="/login">Go to Login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error || !booking) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle /> Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{error || "Could not load booking details."}</p>
          <Button asChild className="mt-4">
            <Link href="/bookings">Back to My Bookings</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle>Confirm Your Booking</CardTitle>
        <CardDescription>
          Complete your payment for the performance with {booking.performerName}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isDemoMode ? (
          <Alert variant="destructive" className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Stripe Demo Mode</AlertTitle>
            <AlertDescription>
              {error} Real payments are disabled. To enable payments, add your Stripe secret key to the `.env` file and restart the development server.
            </AlertDescription>
          </Alert>
        ) : (
          clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm booking={booking} onPaymentSuccess={onPaymentSuccess} />
            </Elements>
          )
        )}
      </CardContent>
    </Card>
  );
}
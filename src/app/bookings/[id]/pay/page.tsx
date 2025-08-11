'use client';

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
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from "@stripe/react-stripe-js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function CheckoutForm({
  booking,
  onPaymentSuccess
}: {
  booking: Booking;
  onPaymentSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required"
    });

    if (error) {
      setErrorMessage(error.message || "An unexpected error occurred.");
      setIsProcessing(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      try {
        const bookingRef = doc(db, "bookings", booking.id);
        await updateDoc(bookingRef, { status: "confirmed" });
        onPaymentSuccess();
      } catch (dbError) {
        console.error("Error updating booking status:", dbError);
        setErrorMessage(
          "Payment was successful, but we couldn't update your booking. Please contact support."
        );
      }
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement id="payment-element" />
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <Button
        disabled={isProcessing || !stripe || !elements}
        className="w-full"
        type="submit"
      >
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

  const getBookingDetails = useCallback(
    async (uid: string) => {
      const bookingId = params.id;
      if (!bookingId) {
        setError("Booking ID not found in the URL.");
        setIsLoading(false);
        return;
      }

      try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (!bookingSnap.exists()) {
          notFound();
        }

        const bookingData = {
          id: bookingSnap.id,
          ...bookingSnap.data()
        } as Booking;

        if (bookingData.userId !== uid) {
          setError("You do not have permission to view this page.");
          return;
        }

        if (bookingData.status !== "awaiting_payment") {
          setError(
            `This booking cannot be paid for. Its status is: ${bookingData.status}.`
          );
          return;
        }

        setBooking(bookingData);

        const res = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: bookingData.pricePerHour,
            bookingId: bookingData.id
          })
        });

        if (!res.ok) {
          const { error: serverError } = await res.json();
          if (serverError && serverError.includes("not configured")) {
            setIsDemoMode(true);
            setError(serverError);
          } else {
            throw new Error(
              serverError || "Failed to create payment intent."
            );
          }
        } else {
          const { clientSecret: newClientSecret } = await res.json();
          setClientSecret(newClientSecret);
        }
      } catch (err: any) {
        console.error("Error processing booking payment page:", err);
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    },
    [params.id]
  );

  useEffect(() => {
    if (!authLoading && user) {
      setIsLoading(true);
      getBookingDetails(user.uid);
    }
    if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [user, authLoading, getBookingDetails]);

  const onPaymentSuccess = () => {
    router.push("/bookings");
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">
          Loading payment details...
        </p>
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
          <p className="text-muted-foreground">
            You must be logged in to pay for a booking.
          </p>
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
          <p className="text-muted-foreground">
            {error || "Could not load booking details."}
          </p>
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
          Complete your payment for the performance with{" "}
          {booking.performerName}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isDemoMode ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Stripe Demo Mode</AlertTitle>
            <AlertDescription>
              {error} Real payments are disabled. To enable payments, add your
              Stripe secret key to the `.env` file and restart the development
              server.
            </AlertDescription>
          </Alert>
        ) : (
          clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm
                booking={booking}
                onPaymentSuccess={onPaymentSuccess}
              />
            </Elements>
          )
        )}
      </CardContent>
    </Card>
  );
}
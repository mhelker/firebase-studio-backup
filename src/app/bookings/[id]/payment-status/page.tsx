// src/app/bookings/[id]/payment-status/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function PaymentStatusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>(); // booking ID
  const [status, setStatus] = useState<'loading' | 'succeeded' | 'failed'>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const clientSecret = searchParams.get('payment_intent_client_secret');
    if (!clientSecret) {
      setStatus('failed');
      setMessage('Payment confirmation failed: Missing client secret.');
      return;
    }

    async function retrievePaymentIntent() {
      try {
        const stripe = await stripePromise;
        if (!stripe) throw new Error("Stripe.js failed to load.");

        const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);

        if (paymentIntent) {
          switch (paymentIntent.status) {
            case 'succeeded':
              setStatus('succeeded');
              setMessage('Payment successful! Your booking is confirmed.');
              // At this point, your backend webhook should have updated Firebase
              // but you could add a fallback client-side update here if needed.
              break;
            case 'processing':
              setStatus('loading');
              setMessage('Payment is processing. We will notify you when it\'s complete.');
              break;
            case 'requires_payment_method':
            case 'requires_action':
            case 'requires_confirmation':
              setStatus('failed');
              setMessage('Payment failed or requires further action. Please try again.');
              break;
            case 'canceled':
              setStatus('failed');
              setMessage('Payment was cancelled.');
              break;
            default:
              setStatus('failed');
              setMessage('An unexpected payment status was encountered.');
              break;
          }
        } else {
          setStatus('failed');
          setMessage('Could not retrieve payment details.');
        }
      } catch (error: any) {
        console.error("Error retrieving PaymentIntent:", error);
        setStatus('failed');
        setMessage(`Error: ${error.message || 'An unexpected error occurred.'}`);
      }
    }

    retrievePaymentIntent();
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Confirming payment...</p>
      </div>
    );
  }

  return (
    <Card className="max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status === 'succeeded' ? (
            <CheckCircle className="h-6 w-6 text-green-500" />
          ) : (
            <XCircle className="h-6 w-6 text-red-500" />
          )}
          {status === 'succeeded' ? 'Payment Confirmed!' : 'Payment Failed'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{message}</p>
        <Button asChild className="mt-4">
            {/* The href now points directly to your main bookings dashboard */}
            <Link href="/bookings">View My Bookings</Link>
          </Button>
        {status === 'failed' && (
          <Button asChild variant="outline" className="mt-4 ml-2">
            <Link href={`/bookings/${params.id}/pay`}>Try Payment Again</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
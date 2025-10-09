// src/components/review-and-tip-form.tsx

"use client";

import { getAuth } from "firebase/auth";
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import { useState, useEffect } from "react"; // ✅ Add useEffect here
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Loader2, Info, AlertTriangle, Gift, DollarSign } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Input } from "./ui/input";
import { doc, getDoc, updateDoc } from "firebase/firestore"; // ✅ ADDED getDoc
import { db } from "@/lib/firebase"; // Client-side Firestore for read/update after payment

const reviewSchema = z.object({
  rating: z.number().min(1, "Please select a rating.").max(5),
  comment: z
    .string()
    .min(10, "Comment must be at least 10 characters.")
    .max(500, "Comment must be less than 500 characters."),
  tipAmount: z.coerce.number().min(0).optional(),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
  performerId: string;
  performerName: string;
  bookingId: string;
  onReviewSubmitted: () => void;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function InnerReviewForm({
  onReviewSubmitted,
  isTippingReady,
  onProceedToPayment,
  isProceeding,
  bookingId,
  performerId, // The ID of the performer being reviewed
  performerStripeAccountId, // ✅ Pass this from the parent
}: {
  onReviewSubmitted: () => void;
  isTippingReady: boolean;
  onProceedToPayment: () => void;
  isProceeding: boolean;
  bookingId: string;
  performerId: string;
  performerStripeAccountId: string | undefined; // ✅ Define type
}) {
  const { user } = useAuth(); // 'user' here is the customer
  const { toast } = useToast();
  const form = useFormContext<ReviewFormValues>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stripe = useStripe();
  const elements = useElements();

  const tipAmount = form.watch("tipAmount") || 0;
  const shouldProceedToPayment = tipAmount > 0 && !isTippingReady;

  const handleFullSubmit = async (data: ReviewFormValues) => {
    if (!user) {
      toast({ title: "Not Authenticated", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    let finalTipPaymentIntentId: string | null = null; // To store the confirmed PI ID

    // If a tip amount is provided AND a performer Stripe account exists,
    // we must first finalize the Stripe payment on the frontend.
    if (data.tipAmount && data.tipAmount > 0 && performerStripeAccountId) {
      if (!stripe || !elements) {
        toast({ title: "Stripe Error", description: "Stripe.js has not loaded.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const { error: paymentError, paymentIntent } = await stripe.confirmPayment({
        elements, // The PaymentElement will handle collecting and attaching the payment method
        confirmParams: {
          return_url: `${window.location.origin}/bookings/${bookingId}/review`, // URL to redirect to after payment (if necessary)
        },
        redirect: 'if_required', // Handle redirects if needed by payment method
      });

      if (paymentError) {
        toast({
          title: "Payment Error",
          description: paymentError.message || "Failed to confirm tip payment.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // If paymentIntent is present and succeeded, store its ID
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        finalTipPaymentIntentId = paymentIntent.id;
      } else {
        // This case might mean it's processing or needs further action,
        // but for now, we'll assume succeeded or error.
        // For production, you might want to handle 'requires_action' states.
        toast({
            title: "Payment Processing",
            description: "Tip payment is still processing or requires further action. Please check your Stripe dashboard or contact support.",
            variant: "default"
        });
        // We might want to stop here or proceed without the tip depending on desired UX
        setIsSubmitting(false);
        return;
      }
    } else if (data.tipAmount && data.tipAmount > 0 && !performerStripeAccountId) {
        // Frontend already shows a warning if performerStripeAccountId is missing.
        // We'll proceed with review submission, but without tip payment.
        toast({
            title: "Tipping Skipped",
            description: "Tip amount was provided, but performer's Stripe account is not linked. Tip will not be processed.",
            variant: "default"
        });
    }


    try {
      const response = await fetch("/api/submit-review-and-tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          performerId,
          rating: data.rating,
          comment: data.comment,
          customerId: user.uid,
          tipAmount: data.tipAmount || 0,
          performerStripeAccountId: performerStripeAccountId,
          // ✅ NEW: If the tip was paid on the frontend, send its ID
          // Otherwise, send null, and the backend will not try to confirm
          tipPaymentIntentId: finalTipPaymentIntentId, // Send the confirmed PI ID
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.description || result.message || "Failed to submit review.");

    

      toast({ title: result.title || "Review submitted", description: result.description });
      onReviewSubmitted();
    } catch (error: any) {
      toast({
        title: "Submission Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleFullSubmit)} className="space-y-6">
      <FormField
        control={form.control}
        name="rating"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Your Rating</FormLabel>
            <FormControl>
              <StarRating rating={field.value} interactive onRate={field.onChange} size={28} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="comment"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Your Comment</FormLabel>
            <FormControl>
              <Textarea placeholder="Tell us about your experience..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="tipAmount"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Gift className="w-4 h-4" /> Add a Tip? (Optional)
            </FormLabel>
            <FormControl>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0.00"
                  className="pl-8"
                  min="0"
                  step="0.01"
                  {...field}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {isTippingReady && (
        <div className="space-y-4">
          <FormLabel>Payment Details</FormLabel>
          <div className="mt-2 p-4 border rounded-md bg-background">
            <PaymentElement />
          </div>
        </div>
      )}

      {/* ✅ Add a warning if tipping is desired but performer's Stripe account is missing */}
      {tipAmount > 0 && !performerStripeAccountId && (
        <Alert variant="warning" className="flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Tipping Unavailable</AlertTitle>
          <AlertDescription>
            This performer has not yet connected their Stripe account to receive tips. Your review will be submitted, but the tip will not be processed.
          </AlertDescription>
        </Alert>
      )}


      <Button
        type={shouldProceedToPayment && performerStripeAccountId ? "button" : "submit"} // Only "button" if tipping and account exists
        onClick={shouldProceedToPayment && performerStripeAccountId ? onProceedToPayment : undefined}
        disabled={isProceeding || isSubmitting || (isTippingReady && (!stripe || !elements)) || (tipAmount > 0 && !performerStripeAccountId && !shouldProceedToPayment)}
        className="w-full"
      >
        {isProceeding ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Proceeding...
          </>
        ) : isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
          </>
        ) : (shouldProceedToPayment && performerStripeAccountId) ? ( // Only show "Proceed" if account exists
          "Proceed to Payment"
        ) : (
          "Submit Review"
        )}
      </Button>
    </form>
  );
}

export function ReviewForm({
  performerId,
  performerName,
  bookingId,
  onReviewSubmitted,
}: ReviewFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isLoadingSecret, setIsLoadingSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [performerStripeAccountId, setPerformerStripeAccountId] = useState<string | undefined>(undefined); // ✅ NEW State

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, comment: "", tipAmount: 0 },
  });

  const isTippingReady = !!clientSecret && !isDemoMode;

  // ✅ NEW: Fetch performer's Stripe account ID
  useEffect(() => {
    const fetchPerformerStripeAccount = async () => {
      if (!performerId) {
        console.error("Performer ID is missing, cannot fetch Stripe Account for tip.");
        return;
      }
      try {
        const performerRef = doc(db, "performers", performerId);
        const performerSnap = await getDoc(performerRef);
        if (performerSnap.exists()) {
          const data = performerSnap.data();
          if (data.stripeAccountId) {
            setPerformerStripeAccountId(data.stripeAccountId as string);
          } else {
            console.warn(`Performer ${performerId} does not have a stripeAccountId for tipping.`);
          }
        } else {
          console.error(`Performer document for ID ${performerId} not found.`);
        }
      } catch (err) {
        console.error("Error fetching performer Stripe account for tipping:", err);
        setError("Failed to load performer details for tipping.");
      }
    };
    fetchPerformerStripeAccount();
  }, [performerId]); // Re-fetch if performerId changes


  const handleProceedToPayment = async () => {
    const tipAmount = Number(form.getValues("tipAmount") || 0);
    if (isNaN(tipAmount) || tipAmount < 0.5) {
      if (tipAmount > 0) setError("Tip amount must be at least $0.50.");
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to tip.");
      return;
    }
    // ✅ Check if performerStripeAccountId is available before proceeding
    if (!performerStripeAccountId) {
      setError("Cannot proceed with tip payment: Performer's Stripe account is not linked.");
      return;
    }

    setIsLoadingSecret(true);
    setError(null);
    try {
      const token = await user.getIdToken();

      // For creating the tip payment intent, we need to send the destination
      const response = await fetch("/api/create-tip-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tipAmount,
          bookingId,
          performerStripeAccountId: performerStripeAccountId, // ✅ PASS PERFORMER STRIPE ACCOUNT ID HERE
        }),
      });

      const intent = await response.json();
      if (!response.ok) {
        // Check for specific Stripe configuration error
        if (intent.error && intent.error.includes("Stripe is not configured")) {
            setIsDemoMode(true);
        }
        throw new Error(intent.error || "Failed to create tip intent.");
      }

      if (intent.clientSecret) {
        setIsDemoMode(false);
        setClientSecret(intent.clientSecret);
      } else {
        setError("Could not initialize the payment form.");
      }
    } catch (err: any) {
      console.error("Error creating payment intent:", err);
      setError("An unexpected error occurred while setting up the payment form.");
    } finally {
      setIsLoadingSecret(false);
    }
  };

  const elementOptions = clientSecret ? { clientSecret } : {};

  return (
    <FormProvider {...form}>
      <div className="space-y-4 mb-6">
        {isDemoMode && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Stripe Demo Mode</AlertTitle>
            <AlertDescription>Tipping is disabled. Ensure your Stripe secret key is configured and performer has a connected account.</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Payment Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <Elements stripe={stripePromise} options={elementOptions} key={clientSecret || "no-tip"}>
        <InnerReviewForm
          onReviewSubmitted={onReviewSubmitted}
          isTippingReady={isTippingReady}
          onProceedToPayment={handleProceedToPayment}
          isProceeding={isLoadingSecret}
          bookingId={bookingId}
          performerId={performerId}
          performerStripeAccountId={performerStripeAccountId} // ✅ Pass to InnerReviewForm
        />
      </Elements>

      <Alert className="mt-6">
        <Info className="h-4 w-4" />
        <AlertTitle>How Reviews Work</AlertTitle>
        <AlertDescription>
          Your review is hidden until {performerName} also reviews you, or after 14 days.
        </AlertDescription>
      </Alert>
    </FormProvider>
  );
}
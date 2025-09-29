"use client";

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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Loader2, Info, AlertTriangle, Gift, DollarSign } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Input } from "./ui/input";

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
  performerId,
}: {
  onReviewSubmitted: () => void;
  isTippingReady: boolean;
  onProceedToPayment: () => void;
  isProceeding: boolean;
  bookingId: string;
  performerId: string;
}) {
  const { user } = useAuth();
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

    // If tipping is enabled, finalize the Stripe payment first
    if (isTippingReady) {
      if (!stripe || !elements) {
        toast({ title: "Payment form not ready", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      const { error: paymentError } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (paymentError) {
        toast({
          title: "Payment Error",
          description: paymentError.message || "An error occurred.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
    }

    // Submit review + tip to your API
    try {
      const response = await fetch("/api/submit-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          performerId,
          rating: data.rating,
          comment: data.comment,
          customerId: user.uid,
          tipAmount: data.tipAmount || 0,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to submit review.");

      toast({ title: result.title || "Review submitted", description: result.description });
      onReviewSubmitted();
    } catch (error: any) {
      toast({
        title: "Submission Error",
        description: error.message || "An error occurred.",
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

      <Button
        type={shouldProceedToPayment ? "button" : "submit"}
        onClick={shouldProceedToPayment ? onProceedToPayment : undefined}
        disabled={isProceeding || isSubmitting || (isTippingReady && (!stripe || !elements))}
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
        ) : shouldProceedToPayment ? (
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

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, comment: "", tipAmount: 0 },
  });

  const isTippingReady = !!clientSecret && !isDemoMode;

  const handleProceedToPayment = async () => {
    const tipAmount = Number(form.getValues("tipAmount") || 0);
    if (isNaN(tipAmount) || tipAmount < 0.5) {
      if (tipAmount > 0) setError("Tip amount must be at least $0.50.");
      return;
    }

    setIsLoadingSecret(true);
    setError(null);
    try {
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: tipAmount, bookingId: `${bookingId}-tip` }),
      });
      const intent = await response.json();
      if (!response.ok) throw new Error(intent.error || "Failed to create tip intent.");
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
            <AlertDescription>Tipping is disabled.</AlertDescription>
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
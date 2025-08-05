
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Loader2, DollarSign, Info, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { createTipIntent } from "@/ai/flows/create-tip-intent";
import { submitReviewAndTip } from "@/ai/flows/submit-review";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

const reviewAndTipSchema = z.object({
  rating: z.number().min(1, "Please select a rating.").max(5),
  comment: z
    .string()
    .min(10, "Comment must be at least 10 characters.")
    .max(500, "Comment must be less than 500 characters."),
  tipAmount: z.coerce.number().min(0, "Tip must be a non-negative number.").optional(),
});

type ReviewAndTipFormValues = z.infer<typeof reviewAndTipSchema>;

interface ReviewAndTipFormProps {
  performerId: string;
  bookingId: string;
  onReviewSubmitted: () => void;
}

function InnerReviewForm({
  onReviewSubmitted,
  bookingId,
  performerId,
  isDemoMode
}: ReviewAndTipFormProps & { isDemoMode: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const stripe = useStripe();
  const elements = useElements();

  const form = useForm<ReviewAndTipFormValues>({
    resolver: zodResolver(reviewAndTipSchema),
    defaultValues: { rating: 0, comment: "", tipAmount: 0 },
  });

  const tipAmount = form.watch("tipAmount") || 0;

  const handleFullSubmit = async (data: ReviewAndTipFormValues) => {
    if (!user) {
      toast({ title: "Not Authenticated", variant: "destructive" });
      return;
    }
    if (!performerId) {
      toast({ title: "Error", description: "Performer ID is missing.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      if (tipAmount > 0 && !isDemoMode) {
        if (!stripe || !elements) {
          throw new Error("Payment form not initialized.");
        }
        const { error: paymentError } = await stripe.confirmPayment({
          elements,
          redirect: "if_required",
        });
        if (paymentError) {
          throw new Error(paymentError.message || "An unexpected payment error occurred.");
        }
      }

      const result = await submitReviewAndTip({
        bookingId,
        performerId,
        rating: data.rating,
        comment: data.comment,
        tipAmount,
        userId: user.uid,
      });

      toast({ title: result.title, description: result.description });
      onReviewSubmitted();
    } catch (error: any) {
      toast({
        title: "Submission Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isButtonDisabled = isProcessing || (tipAmount > 0 && !isDemoMode && (!stripe || !elements));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFullSubmit)} className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>How Reviews Work</AlertTitle>
          <AlertDescription>
            Your review is hidden until the performer also reviews you, or after 14 days.
          </AlertDescription>
        </Alert>

        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Rating</FormLabel>
              <FormControl>
                <div className="flex">
                  <StarRating rating={field.value} interactive onRate={field.onChange} size={28} />
                </div>
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
                <Textarea
                  placeholder="Tell us about your experience..."
                  {...field}
                  disabled={isProcessing}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        <div>
          <h3 className="text-lg font-medium">Leave a Tip (Optional)</h3>
          <p className="text-sm text-muted-foreground">Add a tip if you enjoyed the performance.</p>
        </div>

        <FormField
          control={form.control}
          name="tipAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tip Amount ($)</FormLabel>
              <FormControl>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="pl-8"
                    step="1.00"
                    min="0"
                    {...field}
                    value={field.value || ''}
                    onChange={(e) => {
                      const value = e.target.valueAsNumber;
                      field.onChange(isNaN(value) ? 0 : value);
                    }}
                    disabled={isProcessing}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {tipAmount > 0 && (
          isDemoMode ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Stripe Demo Mode</AlertTitle>
              <AlertDescription>
                Stripe keys are not configured. Real payments are disabled. Add your `STRIPE_SECRET_KEY` to the `.env` file and restart the server to enable tipping.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="p-4 border rounded-md">
              <h4 className="font-semibold mb-2">Secure Tip Payment</h4>
              <PaymentElement id="payment-element" />
            </div>
          )
        )}

        <Button type="submit" className="w-full" disabled={isButtonDisabled}>
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
            </>
          ) : tipAmount > 0 ? (
            `Submit Review & ${isDemoMode ? 'Simulate' : 'Pay'} $${tipAmount.toFixed(2)} Tip`
          ) : (
            'Submit Review'
          )}
        </Button>
      </form>
    </Form>
  );
}

export function ReviewAndTipForm(props: ReviewAndTipFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // We only create an intent if the user wants to tip.
    // For now, we create a placeholder intent to initialize Stripe Elements.
    // A better approach might be to create the intent only when tipAmount > 0.
    setIsLoading(true);
    createTipIntent({ bookingId: props.bookingId, tipAmount: 1 })
      .then((intent) => {
          if (intent.isDemoMode) {
              setIsDemoMode(true);
          } else {
              setClientSecret(intent.clientSecret);
          }
      })
      .catch((error) => {
        console.error("Could not create tip intent:", error);
        toast({
          title: "Payment Error",
          description: "Could not initialize the payment form. " + error.message,
          variant: "destructive",
        });
      })
      .finally(() => {
          setIsLoading(false);
      });
  }, [props.bookingId, toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Initializing form...</p>
      </div>
    );
  }
  
  if (isDemoMode) {
      return <InnerReviewForm {...props} isDemoMode={true} />;
  }

  if (!clientSecret) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-destructive">Could not initialize payment form. Client secret is missing.</p>
        </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }} key={clientSecret}>
      <InnerReviewForm {...props} isDemoMode={false} />
    </Elements>
  );
}

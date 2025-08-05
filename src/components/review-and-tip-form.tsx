
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
  isDemoMode,
  clientSecret: initialClientSecret,
}: ReviewAndTipFormProps & { isDemoMode: boolean, clientSecret: string | null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState(initialClientSecret);
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);

  const form = useForm<ReviewAndTipFormValues>({
    resolver: zodResolver(reviewAndTipSchema),
    defaultValues: { rating: 0, comment: "", tipAmount: 0 },
  });

  const tipAmount = form.watch("tipAmount") || 0;

  useEffect(() => {
    // If the tip amount changes to be > 0 and we don't have a client secret yet,
    // or if the tip amount becomes 0, we might need to create/clear the intent.
    // This logic handles creating a new Payment Intent if the user decides to add a tip later.
    const tipValue = form.getValues('tipAmount');
    if (tipValue && tipValue > 0 && !clientSecret && !isDemoMode) {
        setIsCreatingIntent(true);
        createTipIntent({ bookingId, tipAmount: tipValue })
            .then(intent => {
                if (intent.clientSecret) {
                    setClientSecret(intent.clientSecret);
                } else if (intent.isDemoMode) {
                    // This case should be handled by the parent, but as a fallback
                    console.warn("Stripe is in demo mode, cannot create real intent.");
                }
            })
            .catch(error => {
                console.error("Could not create tip intent:", error);
                toast({ title: "Payment Error", description: "Could not initialize the payment form.", variant: "destructive" });
            })
            .finally(() => setIsCreatingIntent(false));
    }
  }, [tipAmount, clientSecret, isDemoMode, bookingId, form, toast]);


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
        if (!stripe || !elements || !clientSecret) {
          throw new Error("Payment form not ready. Please wait and try again.");
        }
        // We need to fetch the latest intent based on the final amount
         const finalIntent = await createTipIntent({ bookingId, tipAmount });
         if (!finalIntent.clientSecret) throw new Error("Could not create final payment intent.");

        const { error: paymentError } = await stripe.confirmPayment({
          elements,
          clientSecret: finalIntent.clientSecret,
          redirect: "if_required",
        });

        if (paymentError) {
          throw new Error(paymentError.message || "An unexpected payment error occurred.");
        }
      }

      // Submit the review and tip amount (even if 0) to the backend
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

  const isButtonDisabled = isProcessing || isCreatingIntent || (tipAmount > 0 && !isDemoMode && (!stripe || !elements));

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
          ) : clientSecret ? (
            <div className="p-4 border rounded-md">
              <h4 className="font-semibold mb-2">Secure Tip Payment</h4>
              <Elements stripe={stripePromise} options={{ clientSecret }} key={clientSecret}>
                <PaymentElement id="payment-element" />
              </Elements>
            </div>
          ) : (
             <div className="flex items-center justify-center p-4">
                <Loader2 className="animate-spin mr-2" /> Loading payment form...
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
  const [isLoading, setIsLoading] = useState(false); // Only load if a tip is entered

  // This component now only handles passing initial state.
  // The InnerReviewForm handles the logic of creating intents.

  useEffect(() => {
    // Check for demo mode status on mount, in case Stripe isn't configured at all.
    createTipIntent({ bookingId: props.bookingId, tipAmount: 0.01 }) // use a minimum amount to check status
      .then(intent => {
          if (intent.isDemoMode) {
              setIsDemoMode(true);
          }
      })
      .catch(e => console.error("Could not check Stripe status:", e));
  }, [props.bookingId]);
  

  return (
    <InnerReviewForm {...props} isDemoMode={isDemoMode} clientSecret={clientSecret} />
  );
}

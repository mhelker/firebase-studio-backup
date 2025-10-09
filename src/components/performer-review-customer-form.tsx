"use client";

import React, { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";

// ✅ Add these two lines right here
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// --- Zod schema including tipAmount ---
const reviewSchema = z.object({
  rating: z.number().min(1, "Please select a rating.").max(5),
  comment: z
    .string()
    .min(10, "Comment must be at least 10 characters.")
    .max(500, "Comment must be less than 500 characters."),
  tipAmount: z.number().min(0, "Tip cannot be negative").optional(),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

interface Props {
  bookingId: string;
  // customerId: string; // This form is for performer reviewing customer, so customerId is implicit
  performerId: string; // The ID of the performer who is submitting this review
  customerIdBeingReviewed: string; // The ID of the customer being reviewed
  // performerStripeAccountId: string; // Not relevant for performer reviewing customer
  onReviewSubmitted: () => void;
}

export function PerformerReviewCustomerForm({ // <-- RENAMED COMPONENT
  bookingId,
  performerId, // This is the ID of the performer who is reviewing
  customerIdBeingReviewed, // This is the ID of the customer being reviewed
  onReviewSubmitted,
}: Props) {
  const { user } = useAuth(); // 'user' here is the performer
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, comment: "" /* No tip for performer reviewing customer */ },
  });

  const handleFullSubmit = async (data: ReviewFormValues) => {
    if (!user) { // user is the performer submitting the review
      toast({ title: "Not Authenticated", variant: "destructive" });
      return;
    }
    if (!bookingId || !customerIdBeingReviewed || user.uid !== performerId) { // Ensure performer is submitting their own review
      toast({
        title: "Submission Error",
        description: "Missing IDs or unauthorized to submit this review.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // --- (Optional: If you have a backend API for this review, call it here) ---
      // const response = await fetch("/api/performer-submit-customer-review", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     bookingId,
      //     performerId: user.uid, // The ID of the performer who is reviewing
      //     customerId: customerIdBeingReviewed, // The ID of the customer being reviewed
      //     rating: data.rating,
      //     comment: data.comment,
      //   }),
      // });
      // const result = await response.json();
      // if (!response.ok) throw new Error(result.message || "Failed to submit review.");
      // --- (End Optional API call) ---

      // ✅ CORRECT Firestore update for PERFOMER REVIEWING CUSTOMER
      const bookingRef = doc(db, "bookings", bookingId);
      await updateDoc(bookingRef, {
        performerReviewedCustomer: true, // New flag: Performer has reviewed the Customer
        customerRatingByPerformer: data.rating, // New field: The rating the performer gave the customer
        customerCommentByPerformer: data.comment, // New field: The comment the performer gave the customer
        // performerCompleted: true, // Optional: if you track performer completion separately
      });

      // After updating, check if BOTH reviews are in to set publicReviewsCreated
      const bookingDoc = await getDoc(bookingRef); // <--- CORRECTED LINE
      const bookingData = bookingDoc.data();

      // Only set publicReviewsCreated if both specific review flags are true
      if (bookingData?.performerReviewedCustomer && bookingData?.customerReviewedPerformer) {
        await updateDoc(bookingRef, { publicReviewsCreated: true });
        // Trigger Cloud Function to create public review documents, update avg ratings, etc.
        // Or your /api/submit-review-and-tip might handle this already
      }


      toast({ title: "Review Submitted", description: "Thank you for your review of the customer!" });
      onReviewSubmitted();
    } catch (error: any) {
      console.error("Error submitting performer's review of customer:", error);
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFullSubmit)} className="space-y-6">
        {/* Rating for customer */}
        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Rating of the Customer</FormLabel> {/* <-- Corrected Label */}
              <FormControl>
                <div className="flex">
                  <StarRating
                    rating={field.value}
                    interactive
                    onRate={field.onChange}
                    size={28}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Comment for customer */}
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Comment about the Customer</FormLabel> {/* <-- Corrected Label */}
              <FormControl>
                <Textarea
                  placeholder="How was your experience with this customer?"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit */}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Review
        </Button>
      </form>
    </Form>
  );
}
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
// --- CHANGE 1: REMOVED THE BROKEN SERVER ACTION IMPORT ---
// import { submitPerformerReview } from "@/ai/flows/submit-review";

const reviewSchema = z.object({
  rating: z.number().min(1, "Please select a rating.").max(5),
  comment: z
    .string()
    .min(10, "Comment must be at least 10 characters.")
    .max(500, "Comment must be less than 500 characters."),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

interface Props {
  bookingId: string;
  customerId: string;
  onReviewSubmitted: () => void;
}

export function CustomerReviewForm({
  bookingId,
  customerId,
  onReviewSubmitted,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, comment: "" },
  });

  const handleFullSubmit = async (data: ReviewFormValues) => {
    if (!user) {
      toast({ title: "Not Authenticated", variant: "destructive" });
      return;
    }
    if (!bookingId || !customerId) {
      toast({
        title: "Submission Error",
        description: "Missing Booking or Customer ID. Cannot submit review.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    // --- CHANGE 2: REPLACED THE SERVER ACTION WITH A FETCH CALL TO THE NEW API ROUTE ---
    try {
      const response = await fetch('/api/submit-performer-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          customerId,
          rating: data.rating,
          comment: data.comment,
          userId: user.uid, // This is the performer's ID
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to submit performer review.');
      }
      
      toast({ title: result.title, description: result.description });
      onReviewSubmitted();
    } catch (error: any) {
      console.error("Error submitting performer review:", error);
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
        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Rating of the Customer</FormLabel>
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
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Comment</FormLabel>
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
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Review
        </Button>
      </form>
    </Form>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { submitFeedback } from "@/ai/flows/submit-feedback";

const feedbackFormSchema = z.object({
  feedback: z.string().min(10, {
    message: "Feedback must be at least 10 characters.",
  }).max(1000, {
    message: "Feedback must not be longer than 1000 characters.",
  }),
});

type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;

export function FeedbackForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      feedback: "",
    },
  });

  async function onSubmit(data: FeedbackFormValues) {
    if (!user) {
      toast({
        title: "Login Required",
        description: "You must be logged in to submit feedback.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await submitFeedback({ feedback: data.feedback });
      toast({
        title: "Feedback Sent!",
        description: "Thank you for your suggestion. We appreciate it!",
      });
      form.reset();
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Submission Error",
        description: error.message || "Could not send your feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="feedback"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  placeholder="Tell us your idea..."
                  className="resize-none bg-background"
                  {...field}
                  disabled={!user || isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={!user || isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {user ? 'Send Feedback' : 'Login to Send Feedback'}
        </Button>
      </form>
    </Form>
  );
}

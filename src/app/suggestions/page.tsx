'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Loader2, Lightbulb, Send, CheckCircle, MessageSquare } from 'lucide-react';
import type { SuggestionItem } from '@/types';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import Link from 'next/link';

// --- Form Schemas ---
const suggestionFormSchema = z.object({
  suggestion: z.string().min(10, { message: "Your suggestion must be at least 10 characters." })
                    .max(500, { message: "Your suggestion must be less than 500 characters." }),
});
type SuggestionFormValues = z.infer<typeof suggestionFormSchema>;

const commentFormSchema = z.object({
  comment: z.string().min(10, "Your comment must be at least 10 characters."),
});
type CommentFormValues = z.infer<typeof commentFormSchema>;

// --- Comment Form Component ---
function CommentForm({ suggestionId, onCommented }: { suggestionId: string; onCommented: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<CommentFormValues>({ resolver: zodResolver(commentFormSchema) });

  async function onSubmit(data: CommentFormValues) {
    setIsSubmitting(true);
    try {
      if (!user) throw new Error("Authentication is required.");
      const token = await user.getIdToken();

      const response = await fetch('/api/comment-on-suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ suggestionId, comment: data.comment }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to submit comment.");

      toast({ title: "Comment Submitted!", description: "Thank you for contributing." });
      onCommented();
    } catch (error: any) {
      console.error("Error submitting comment:", error);
      toast({ title: "Error", description: error.message || "Could not submit your comment.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Comment</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder="Add your thoughts or response..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Comment
        </Button>
      </form>
    </Form>
  );
}

// --- Suggestions Page ---
export default function SuggestionsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestionItems, setSuggestionItems] = useState<SuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openCommentDialog, setOpenCommentDialog] = useState<string | null>(null);

  const form = useForm<SuggestionFormValues>({
    resolver: zodResolver(suggestionFormSchema),
    defaultValues: { suggestion: "" },
  });

  const canComment = !!user; // any logged-in user can comment

  // Fetch suggestions
  useEffect(() => {
    const q = query(collection(db, "suggestions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const items: SuggestionItem[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as SuggestionItem);
      });
      setSuggestionItems(items);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching suggestions:", error);
      toast({ title: "Error", description: "Could not load suggestions.", variant: "destructive" });
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);

  // Submit suggestion
  async function onSubmit(data: SuggestionFormValues) {
    if (!user) {
      toast({ title: "Not Authenticated", description: "You must be logged in to make a suggestion.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/submit-suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ suggestion: data.suggestion }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to submit suggestion.");

      toast({ title: "Suggestion Submitted!", description: "It has been added to the public board below." });
      form.reset();
    } catch (error: any) {
      console.error("Error submitting suggestion:", error);
      toast({ title: "Error", description: error.message || "Could not submit your suggestion.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const commentedSuggestions = suggestionItems.filter(item => item.status === 'commented');
  const newSuggestions = suggestionItems.filter(item => item.status === 'new');

  const SubmitButtonContent = () => {
    if (!user) return <>Login to Make a Suggestion</>;
    if (isSubmitting) return <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>;
    return <><Send className="mr-2 h-4 w-4" /> Submit Suggestion</>;
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-12">
      <div className="text-center">
        <Lightbulb className="w-16 h-16 mx-auto text-accent mb-4" />
        <h1 className="text-4xl font-headline font-bold text-primary">Community Suggestions</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Have an idea for the platform? Share it with the community!
        </p>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Make a Suggestion</CardTitle>
          <CardDescription>
            Post your ideas for new features or improvements. Logged-in users can comment on suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="suggestion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Suggestion</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder={user ? "What's your great idea?" : "Please login to make a suggestion."}
                        {...field}
                        disabled={!user || isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {user ? (
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  <SubmitButtonContent />
                </Button>
              ) : (
                <Button asChild className="w-full" variant="secondary">
                  <Link href="/login">
                    <SubmitButtonContent />
                  </Link>
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-2xl font-headline font-semibold mb-6">Suggestion Board</h2>
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full space-y-4">
            {newSuggestions.map(item => (
              <Card key={item.id} className="bg-accent/10 border-accent">
                <CardHeader className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{item.suggestion}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Suggested on {format(item.createdAt.toDate(), "PPP")}
                      </p>
                   </div>
                    {canComment && (
                      <Dialog
                        open={openCommentDialog === item.id}
                        onOpenChange={(open) => setOpenCommentDialog(open ? item.id : null)}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="ml-4">
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Add Comment
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Comment</DialogTitle>
                            <DialogDescription>
                              Contribute your thoughts to this suggestion.
                            </DialogDescription>
                          </DialogHeader>
                          <CommentForm
                            suggestionId={item.id}
                            onCommented={() => setOpenCommentDialog(null)}
                          />
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardHeader>
              </Card>
            ))}

            {commentedSuggestions.map(item => (
              <Card key={item.id} className="bg-muted/20">
                <CardHeader className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{item.suggestion}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Suggested on {format(item.createdAt.toDate(), "PPP")}
                      </p>
                      {item.comment && (
                        <p className="mt-2 text-sm text-foreground">
                          💬 {item.comment}
                        </p>
                      )}
                    </div>
                    {canComment && (
                      <Dialog
                        open={openCommentDialog === item.id}
                        onOpenChange={(open) => setOpenCommentDialog(open ? item.id : null)}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="ml-4">
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Add Comment
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Comment</DialogTitle>
                            <DialogDescription>
                              Share another thought about this suggestion.
                            </DialogDescription>
                          </DialogHeader>
                          <CommentForm
                            suggestionId={item.id}
                            onCommented={() => setOpenCommentDialog(null)}
                          />
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardHeader>
              </Card>
            ))}

            {suggestionItems.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No suggestions yet. Be the first to share an idea!
              </p>
            )}
          </Accordion>
        )}
      </section>
    </div>
  );
}

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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recommendPerformers, type RecommendPerformersOutput } from "@/ai/flows/recommend-performers";
import type { AiRecommendedPerformer } from "@/types";
import { PerformerCard } from "@/components/performer-card";
import React, { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const recommendationFormSchema = z.object({
  eventDescription: z.string().min(10, "Event description must be at least 10 characters."),
  desiredMood: z.string().min(3, "Desired mood must be at least 3 characters."),
  budget: z.coerce.number().positive("Budget must be a positive number."),
  talentType: z.string().min(3, "Talent type must be at least 3 characters."),
});

type RecommendationFormValues = z.infer<typeof recommendationFormSchema>;

const talentTypeOptions = ["Any", "Music", "Magic", "Comedy", "DJ", "Live Band", "Speaker", "Artist", "Painter", "Guitarist"];
const moodOptions = ["Any", "Upbeat", "Relaxed", "Formal", "Energetic", "Sentimental", "Funny", "Mysterious"];


export function RecommendationForm() {
  const [recommendations, setRecommendations] = useState<AiRecommendedPerformer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<RecommendationFormValues>({
    resolver: zodResolver(recommendationFormSchema),
    defaultValues: {
      eventDescription: "",
      desiredMood: "Any",
      budget: 100,
      talentType: "Any",
    },
  });

  async function onSubmit(data: RecommendationFormValues) {
    setIsLoading(true);
    setError(null);
    setRecommendations([]);
    try {
      // The result from the AI now includes the real performer ID and a recommendation reason
      const result: RecommendPerformersOutput = await recommendPerformers(data);
      
      const mappedResults: AiRecommendedPerformer[] = result.map((p) => ({
        ...p,
        imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(p.name)}`,
        dataAiHint: p.talentTypes && p.talentTypes.length > 0 ? p.talentTypes.map(t => t.toLowerCase()).join(' ') : 'performer',
        rating: Math.random() * 2 + 3, // Keep a mock rating for display if needed
      }));
      setRecommendations(mappedResults);
    } catch (e) {
      console.error("Error fetching recommendations:", e);
      setError("Failed to fetch recommendations. The AI tool might have encountered an issue.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center"><Sparkles className="w-6 h-6 mr-2 text-accent" /> AI Performer Recommendations</CardTitle>
            <CardDescription>Tell us about your event, and our AI will search our platform for the perfect performers!</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                control={form.control}
                name="eventDescription"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Event Description</FormLabel>
                    <FormControl>
                        <Textarea placeholder="e.g., A surprise birthday party for my friend who loves rock music." {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <div className="grid md:grid-cols-3 gap-6">
                    <FormField
                    control={form.control}
                    name="desiredMood"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Desired Mood</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a mood" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {moodOptions.map(mood => <SelectItem key={mood} value={mood}>{mood}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Budget ($)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g., 500" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="talentType"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Primary Talent Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a primary talent type" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {talentTypeOptions.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <Button type="submit" disabled={isLoading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                )}
                Get Recommendations
                </Button>
            </form>
            </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="text-center py-6">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Searching our platform for the best talents...</p>
        </div>
      )}

      {error && (
        <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4">
                <p className="text-destructive-foreground text-center">{error}</p>
            </CardContent>
        </Card>
      )}

      {recommendations.length > 0 && !isLoading && (
        <section>
          <h2 className="text-2xl font-headline font-semibold mb-6">Our AI Recommends:</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map((performer) => (
              <PerformerCard key={performer.id} performer={performer} isAiRecommendation={true} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && !error && recommendations.length === 0 && form.formState.isSubmitted && (
         <Card>
            <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">Our AI couldn't find a perfect match. Try broadening your search criteria!</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

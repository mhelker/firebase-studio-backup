
"use client";

import type { Review } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StarRating } from '@/components/star-rating';
import { User } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';

interface ReviewCardProps {
  review: Review;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const [displayDate, setDisplayDate] = useState<string>('');

  useEffect(() => {
    // This code runs only on the client, after hydration, to prevent a mismatch.
    let formattedDate = 'Date unavailable';
    if (review.date) {
      try {
        // Create a new Date object from the ISO string
        formattedDate = format(new Date(review.date as string), 'PPP');
      } catch (e) {
        console.error("Error formatting review date:", e);
      }
    }
    setDisplayDate(formattedDate);
  }, [review.date]);

  return (
    <Card className="shadow">
      <CardHeader className="flex flex-row items-start gap-4 p-4">
        <Avatar>
          <AvatarImage src={review.userImageUrl} alt={review.userName || 'Reviewer photo'} data-ai-hint="person portrait" />
          <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h4 className="font-semibold font-headline text-md">{review.userName}</h4>
          {displayDate ? (
            <p className="text-xs text-muted-foreground">{displayDate}</p>
          ) : (
            // Render a placeholder on the server and during initial client render
            <div className="h-4 w-24 mt-1 rounded-md bg-muted/80 animate-pulse" />
          )}
        </div>
        <StarRating rating={review.rating} size={16} />
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-foreground/90">{review.comment}</p>
      </CardContent>
    </Card>
  );
}

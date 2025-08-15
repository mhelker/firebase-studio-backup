'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/star-rating';
import { ReviewCard } from '@/components/review-card';
import { BookingForm } from '@/components/booking-form';
import { CalendarDays, DollarSign, MapPin, Users, Mail, Clock4, Award, Briefcase, PlayCircle, Loader2, Volume2 } from 'lucide-react';
import type { Review, Performer } from '@/types';
// --- FIX: Import useState and useEffect ---
import { useState, useEffect } from 'react';

import { generateTtsAction } from '@/actions/ttsActions';

interface PerformerDetailClientProps {
  performer: Performer;
  reviews: Review[];
}

export function PerformerDetailClient({ performer, reviews }: PerformerDetailClientProps) {
  const [ttsAudio, setTtsAudio] = useState<string | null>(null);
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);

  // --- FIX: Add state to control when the booking form is rendered ---
  const [isClient, setIsClient] = useState(false);

  // This effect runs only once, after the component has mounted in the browser.
  useEffect(() => {
    setIsClient(true);
  }, []);
  // --- END OF FIX ---


  const handleListen = async () => {
    if (!performer?.longDescription) {
      setTtsError("No description available to read.");
      return;
    }
    setIsGeneratingTts(true);
    setTtsError(null);
    setTtsAudio(null);
    try {
      const result = await generateTtsAction(performer.longDescription);
      setTtsAudio(result.audioDataUri);
    } catch (err) {
      console.error("Error generating TTS audio:", err);
      setTtsError("Could not generate audio at this time. Please try again later.");
    } finally {
      setIsGeneratingTts(false);
    }
  };

  const dataAiHintForImage = performer.dataAiHint || (performer.talentTypes && performer.talentTypes.length > 0 ? (performer.talentTypes || []).map(t => t.toLowerCase()).join(' ') : 'performer profile');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Performer Details Card (No changes here) */}
      <Card className="overflow-hidden shadow-xl">
        {/* ... all the card content ... */}
      </Card>

      {/* Booking Form Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <CalendarDays className="w-6 h-6 mr-2 text-primary" /> Book {performer.name}
          </CardTitle>
          <CardDescription>Fill out the form below to request a booking.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* --- FIX: Conditionally render the BookingForm --- */}
          {/* On the server, isClient is false, so this doesn't render. */}
          {/* In the browser, isClient becomes true, and the form appears. */}
          {/* This ensures useAuth() is only ever called in the browser. */}
          {isClient ? (
            <BookingForm performerId={performer.id} performerName={performer.name || 'this performer'} pricePerHour={performer.pricePerHour || 0} />
          ) : (
            // You can show a simple loader or nothing while waiting for the client to mount
            <div className="flex items-center justify-center p-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {/* --- END OF FIX --- */}
        </CardContent>
      </Card>

      {/* Reviews Card (No changes here) */}
      <Card className="shadow-lg">
        {/* ... all the card content ... */}
      </Card>
    </div>
  );
}
'use client';

import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/star-rating';
import { ReviewCard } from '@/components/review-card';
import { BookingForm } from '@/components/booking-form';
import { CalendarDays, DollarSign, MapPin, Users, Mail, Clock4, Award, Briefcase, PlayCircle, Loader2, Volume2 } from 'lucide-react';
import type { Review, Performer } from '@/types';
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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

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
      {/* --- THIS IS THE MISSING SECTION, NOW RESTORED --- */}
      <Card className="overflow-hidden shadow-xl">
        <div className="relative h-64 md:h-96 w-full">
          <Image
            src={performer.imageUrl || "https://placehold.co/600x400.png"}
            alt={performer.name || 'Performer profile photo'}
            fill
            style={{objectFit: "cover"}}
            className="bg-muted"
            data-ai-hint={dataAiHintForImage}
          />
        </div>
        <CardHeader className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="text-3xl md:text-4xl font-headline text-primary">{performer.name}</CardTitle>
            <div className="flex flex-wrap gap-2">
              {(performer.talentTypes || []).map(type => (
                <Badge key={type} variant="secondary" className="text-md px-3 py-1 bg-primary/10 text-primary">{type}</Badge>
              ))}
            </div>
          </div>
          <div className="mt-2">
            <StarRating rating={performer.rating || 0} size={24} />
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h3 className="text-xl font-headline text-primary">About {performer.name}</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleListen}
                disabled={isGeneratingTts || !performer.longDescription}
              >
                {isGeneratingTts ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Volume2 className="w-4 h-4 mr-2" />
                )}
                Listen
              </Button>
            </div>
            <p className="text-lg text-foreground/80">{performer.longDescription || performer.description}</p>
            {ttsError && <p className="text-sm text-destructive mt-2">{ttsError}</p>}
            {ttsAudio && (
              <div className="mt-4">
                <audio controls autoPlay src={ttsAudio}>
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t">
            <div>
              <h3 className="font-semibold text-md mb-2 flex items-center"><Briefcase className="w-5 h-5 mr-2 text-primary" /> Talent Categories</h3>
              <ul className="list-disc list-inside text-sm text-foreground/70 space-y-1">
                {(performer.talentTypes || []).map(type => <li key={type}>{type}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-md mb-2 flex items-center"><Award className="w-5 h-5 mr-2 text-primary" /> Specialties</h3>
              <ul className="list-disc list-inside text-sm text-foreground/70 space-y-1">
                {(performer.specialties && performer.specialties.length > 0) ? (performer.specialties || []).map(spec => <li key={spec}>{spec}</li>) : <li>General Performances</li>}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-md mb-2 flex items-center"><Clock4 className="w-5 h-5 mr-2 text-primary" /> Availability</h3>
              <ul className="list-disc list-inside text-sm text-foreground/70 space-y-1">
                {(performer.availability && performer.availability.length > 0) ? performer.availability.map(avail => <li key={avail}>{avail}</li>) : <li>Not specified</li>}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-md mb-2 flex items-center"><MapPin className="w-5 h-5 mr-2 text-primary" /> Locations Served</h3>
              <ul className="list-disc list-inside text-sm text-foreground/70 space-y-1">
                {(performer.locationsServed && performer.locationsServed.length > 0) ? (performer.locationsServed || []).map(loc => <li key={loc}>{loc}</li>) : <li>Various locations</li>}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-md mb-2 flex items-center"><DollarSign className="w-5 h-5 mr-2 text-primary" /> Price</h3>
              <p className="text-lg font-semibold">${performer.pricePerHour || 0}<span className="text-sm font-normal text-muted-foreground">/hour</span></p>
            </div>
          </div>
          <div className="pt-6 border-t">
            <h3 className="text-xl font-headline font-semibold mb-4 flex items-center text-primary">
              <PlayCircle className="w-6 h-6 mr-2" /> Featured Performance
            </h3>
            {performer.youtubeVideoId ? (
              <div className="aspect-video w-full max-w-xl mx-auto rounded-lg overflow-hidden shadow-md">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${performer.youtubeVideoId}`}
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            ) : (
              <>
                <div className="relative aspect-video w-full max-w-xl mx-auto rounded-lg overflow-hidden group bg-muted cursor-pointer shadow-md">
                  <Image
                    src={performer.featuredPerformanceUrl || "https://placehold.co/1280x720.png"}
                    alt={`${performer.name || 'The performer'}'s featured performance`}
                    fill
                    style={{objectFit: "cover"}}
                    data-ai-hint="live music stage"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                    <PlayCircle className="w-16 h-16 text-white/70 group-hover:text-white transition-transform group-hover:scale-110" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  This performer has not added a featured video yet.
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      {/* --- END OF RESTORED SECTION --- */}

      {/* Booking Form Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <CalendarDays className="w-6 h-6 mr-2 text-primary" /> Book {performer.name}
          </CardTitle>
          <CardDescription>Fill out the form below to request a booking.</CardDescription>
        </CardHeader>
        <CardContent>
          {isClient ? (
            <BookingForm performerId={performer.id} performerName={performer.name || 'this performer'} pricePerHour={performer.pricePerHour || 0} />
          ) : (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviews Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Users className="w-6 h-6 mr-2 text-primary" /> Reviews ({reviews.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          ) : (
            <p className="text-muted-foreground">No reviews yet for {performer.name}.</p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
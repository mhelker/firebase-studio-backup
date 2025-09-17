'use client';

import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/star-rating';
import { ReviewCard } from '@/components/review-card';
import { BookingForm } from '@/components/booking-form';
import { CalendarDays, DollarSign, MapPin, Users, Mail, Clock4, Award, Briefcase, PlayCircle, Loader2, Volume2, AlertTriangle } from 'lucide-react';
import type { Review, Performer } from '@/types';
import { useState, useEffect } from 'react';
import { generateTtsAction } from '@/actions/ttsActions';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import PerformerDetailLoading from '@/app/performers/[id]/loading';

// Helper to convert Firestore Timestamps to strings
function serializeTimestamp(timestamp: any): string {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  return new Date().toISOString(); // Fallback
}

// Helper to safely convert a field to an array
function ensureArray(value: any): string[] {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value === 'string' && value.length > 0) {
        return value.split(',').map(s => s.trim());
    }
    return [];
}


interface PerformerDetailClientProps {
  performerId: string;
}

export function PerformerDetailClient({ performerId }: PerformerDetailClientProps) {
  const [performer, setPerformer] = useState<Performer | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ttsAudio, setTtsAudio] = useState<string | null>(null);
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);

  useEffect(() => {
    const getPerformerData = async (id: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const performerDocRef = doc(db, "performers", id);
        const performerSnap = await getDoc(performerDocRef);

        if (!performerSnap.exists()) {
          throw new Error("Performer not found.");
        }

        const performerData = performerSnap.data()!;
        const serializedPerformer: Performer = {
            id: performerSnap.id,
            name: performerData.name || 'Unnamed Performer',
            talentTypes: ensureArray(performerData.talentTypes),
            description: performerData.description || '',
            longDescription: performerData.longDescription || '',
            pricePerHour: performerData.pricePerHour || 0,
            availability: ensureArray(performerData.availability),
            locationsServed: ensureArray(performerData.locationsServed),
            imageUrl: performerData.imageUrl || '',
            dataAiHint: performerData.dataAiHint || '',
            rating: performerData.rating || 0,
            reviewCount: performerData.reviewCount || 0,
            contactEmail: performerData.contactEmail || '',
            specialties: ensureArray(performerData.specialties),
            youtubeVideoId: performerData.youtubeVideoId || '',
            isFeatured: performerData.isFeatured || false,
            createdAt: serializeTimestamp(performerData.createdAt),
        };
        setPerformer(serializedPerformer);

        // --- THIS IS THE FIX ---
        // Query the sub-collection within the performer's document, not the root collection.
        const reviewsRef = collection(db, 'performers', id, 'reviews');
        const reviewsQuery = query(
          reviewsRef,
          orderBy("date", "desc"),
          limit(20)
        );
        
        const reviewsSnapshot = await getDocs(reviewsQuery);
        const serializedReviews: Review[] = reviewsSnapshot.docs.map(doc => {
          const reviewData = doc.data();
          return {
            id: doc.id,
            bookingId: reviewData.bookingId || '',
            performerId: reviewData.performerId || '',
            userId: reviewData.userId || '', // Correctly map userId from Firestore
            userName: reviewData.userName || 'Anonymous',
            userImageUrl: reviewData.userImageUrl || '',
            rating: reviewData.rating || 0,
            comment: reviewData.comment || '',
            date: serializeTimestamp(reviewData.date),
          };
        });
        setReviews(serializedReviews);
      } catch (err: any) {
        console.error("Error fetching performer data on client:", err);
        setError(err.message || "Failed to load performer details.");
      } finally {
        setIsLoading(false);
      }
    };

    getPerformerData(performerId);
  }, [performerId]);


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

  if (isLoading) {
    return <PerformerDetailLoading />;
  }

  if (error) {
    return (
      <Card className="max-w-lg mx-auto border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle /> Error Loading Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!performer) {
    return null; // Or a not found component
  }

  const dataAiHintForImage = performer.dataAiHint || (performer.talentTypes && performer.talentTypes.length > 0 ? (performer.talentTypes || []).map(t => t.toLowerCase()).join(' ') : 'performer profile');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
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
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <CalendarDays className="w-6 h-6 mr-2 text-primary" /> Book {performer.name}
          </CardTitle>
          <CardDescription>Fill out the form below to request a booking.</CardDescription>
        </CardHeader>
        <CardContent>
          <BookingForm performerId={performer.id} performerName={performer.name || 'this performer'} pricePerHour={performer.pricePerHour || 0} />
        </CardContent>
      </Card>

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
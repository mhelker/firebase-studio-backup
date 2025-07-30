
"use client";

import Image from 'next/image';
import Link from 'next/link';
import type { Performer, AiRecommendedPerformer } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/star-rating';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DollarSign, Briefcase, Info, Sparkles } from 'lucide-react';

interface PerformerCardProps {
  performer: Performer | AiRecommendedPerformer;
  isAiRecommendation?: boolean;
}

export function PerformerCard({ performer, isAiRecommendation = false }: PerformerCardProps) {
  const { name, talentTypes, description } = performer;
  const price = 'pricePerHour' in performer ? performer.pricePerHour : performer.price;
  const rating = 'rating' in performer && performer.rating !== undefined ? performer.rating : 0;
  const imageUrl = performer.imageUrl || `https://placehold.co/300x200.png?text=${encodeURIComponent(name || 'Performer')}`;
  const displayTalentTypes = talentTypes?.join(', ') || 'Versatile Talent';
  const dataAiHint = performer.dataAiHint || (talentTypes && talentTypes.length > 0 ? talentTypes.map(t => t.toLowerCase()).join(' ') : 'performer');
  
  // If the performer object has an ID (which it should for both real and AI-recommended real performers), link to their page.
  const linkHref = 'id' in performer && performer.id ? `/performers/${performer.id}` : '#';

  const availability = 'availability' in performer ? performer.availability : 'N/A'; // For AiRecommendedPerformer
  const recommendationReason = 'recommendationReason' in performer ? performer.recommendationReason : null;

  const cardContent = (
    <div className="p-4 flex-grow flex flex-col">
      <CardTitle className="text-xl font-headline mb-2">{name || 'Unnamed Performer'}</CardTitle>
      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
        <Briefcase className="w-4 h-4 text-primary" />
        <span className="line-clamp-1">{displayTalentTypes}</span>
      </div>
      <p className="text-sm text-foreground/80 mb-3 line-clamp-3 flex-grow">{description || 'No description provided.'}</p>
      
      {isAiRecommendation && recommendationReason && (
        <div className="my-3 p-3 bg-secondary/30 rounded-md border border-primary/20">
          <h4 className="font-semibold text-xs mb-1 flex items-center text-primary"><Sparkles className="w-3 h-3 mr-1.5" /> AI Recommendation</h4>
          <p className="text-xs text-primary/80 italic">"{recommendationReason}"</p>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2 text-sm mt-auto">
         <DollarSign className="w-4 h-4 text-primary" />
         <span>${price || 0}{'pricePerHour' in performer ? '/hr' : ''}</span>
      </div>
      {rating > 0 && !isAiRecommendation && <StarRating rating={rating} size={16} />}
    </div>
  );

  return (
    <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 h-full">
      <CardHeader className="p-0 relative">
        <Image
        src={imageUrl}
        alt={name || 'Performer photo'}
        width={400}
        height={250}
        className="object-cover w-full h-48"
        data-ai-hint={dataAiHint}
        />
        {isAiRecommendation && (
           <Badge variant="secondary" className="absolute top-2 right-2 bg-accent/90 text-accent-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI Pick
           </Badge>
        )}
      </CardHeader>
      <CardContent className="p-0 flex-grow flex flex-col">
          {cardContent}
      </CardContent>
      <CardFooter className="p-4 border-t">
          <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={linkHref === '#'}>
            <Link href={linkHref}>View Profile</Link>
          </Button>
      </CardFooter>
    </Card>
  );
}

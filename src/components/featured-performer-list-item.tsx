
import Link from 'next/link';
import type { Performer } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function FeaturedPerformerListItem({ performer }: { performer: Performer }) {
  const { id, name, talentTypes, description, imageUrl } = performer;
  const displayTalentTypes = talentTypes?.join(', ') || 'Versatile Talent';
  
  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-4 flex items-center gap-6">
        <Avatar className="h-20 w-20">
            <AvatarImage src={imageUrl || `https://placehold.co/100x100.png`} alt={name ? `${name}'s profile photo` : 'Performer profile photo'} />
            <AvatarFallback>{name?.charAt(0).toUpperCase() || 'P'}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Link href={`/performers/${id}`} className="hover:underline">
            <h3 className="text-xl font-headline font-semibold text-primary">{name || 'Unnamed Performer'}</h3>
          </Link>
          <p className="text-sm text-muted-foreground mb-2">{displayTalentTypes}</p>
          <p className="text-sm text-foreground/80 line-clamp-2">{description || 'No description provided.'}</p>
        </div>
        <Button asChild variant="ghost" size="icon" className="ml-auto flex-shrink-0">
          <Link href={`/performers/${id}`}>
            <ArrowRight className="h-5 w-5" />
            <span className="sr-only">View {name}'s Profile</span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

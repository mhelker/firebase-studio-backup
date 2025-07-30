
"use client";

import Image from 'next/image';
import type { Customer } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StarRating } from '@/components/star-rating';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';

interface CustomerCardProps {
  customer: Customer;
}

export function CustomerCard({ customer }: CustomerCardProps) {
  const { displayName, rating, reviewCount, imageUrl } = customer;
  
  return (
    <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 h-full text-center items-center">
      <CardHeader className="p-6">
         <Avatar className="h-24 w-24 border-4 border-primary/20">
            <AvatarImage src={imageUrl || undefined} alt={displayName} data-ai-hint="person portrait" />
            <AvatarFallback>
                <User className="h-10 w-10 text-muted-foreground" />
            </AvatarFallback>
        </Avatar>
      </CardHeader>
      <CardContent className="p-6 pt-0 flex-grow flex flex-col items-center">
        <CardTitle className="text-xl font-headline mb-2">{displayName}</CardTitle>
        <div className="flex items-center flex-col gap-2 mb-2 text-sm text-muted-foreground">
            <StarRating rating={rating} size={18} />
            <span className="text-xs">({reviewCount} reviews)</span>
        </div>
      </CardContent>
    </Card>
  );
}

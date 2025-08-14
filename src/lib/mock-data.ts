
// src/lib/mock-data.ts
import type { Performer } from '@/types';

export const mockPerformers: Performer[] = [
  {
    id: 'zelda-fire-mock',
    name: 'Zelda the Fire Dancer',
    talentTypes: ['Fire Dancer', 'Performer', 'Circus Arts'],
    description: 'Breathtaking fire performances that will light up your event.',
    longDescription: 'Zelda brings the heat with her mesmerizing fire dancing. Combining dance, acrobatics, and fire manipulation, she creates a stunning visual spectacle that is both thrilling and beautiful. Perfect for festivals, corporate events, and unique celebrations.',
    pricePerHour: 250,
    availability: ['Evenings', 'Festivals'],
    locationsServed: ['Anytown', 'Metropolis'],
    imageUrl: 'https://i.imgur.com/R0Snt6d.jpeg',
    dataAiHint: 'fire dancer',
    rating: 5.0,
    reviewCount: 15,
    contactEmail: 'zelda.fire@example.com',
    specialties: ['LED Shows', 'Fire Eating', 'Group Performances'],
    youtubeVideoId: '',
    isFeatured: true,
  }
];
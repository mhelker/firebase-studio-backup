
import type { Performer } from '@/types';

export const mockPerformers: Performer[] = [
  {
    id: 'matthew-helker-mock',
    name: 'Matthew Helker',
    talentTypes: ['Musician', 'Singer', 'Songwriter'],
    description: 'Acoustic artist with a soulful voice, perfect for intimate events.',
    longDescription: 'Matthew Helker is a versatile musician and singer-songwriter known for his captivating acoustic performances. With a repertoire that spans genres and decades, he creates a warm and engaging atmosphere for any occasion.',
    pricePerHour: 150,
    availability: ['Weekends', 'Weekday Evenings'],
    locationsServed: ['Anytown'],
    imageUrl: 'https://i.imgur.com/UzvGnVw.jpeg',
    dataAiHint: 'musician singer',
    rating: 4.9,
    reviewCount: 28,
    contactEmail: 'matthew.helker@example.com',
    specialties: ['Weddings', 'Private Parties', 'Cafes'],
    youtubeVideoId: 'G4ESrkp3CFQ',
    isFeatured: true,
  },
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

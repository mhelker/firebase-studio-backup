
import type { Timestamp } from "firebase/firestore";

export interface Review {
  id: string; // The review document ID
  bookingId: string; // The booking this review is for
  performerId: string; // The performer being reviewed
  userId: string;
  userName:string;
  userImageUrl?: string;
  rating: number;
  comment: string;
  date: Timestamp | string;
}

export interface Performer {
  id: string; // Document ID from Firestore
  name: string;
  talentTypes: string[];
  description: string;
  longDescription?: string;
  pricePerHour: number;
  availability: string[];
  locationsServed?: string[];
  imageUrl: string;
  dataAiHint?: string;
  rating: number;
  reviewCount?: number;
  reviews?: Review[];
  contactEmail?: string;
  specialties?: string[];
  featuredPerformanceUrl?: string;
  youtubeVideoId?: string;
  isFeatured?: boolean;
  bankAccountNumber?: string;
  routingNumber?: string;
  createdAt?: Timestamp | string;
}

export interface Customer {
  id: string; // Document ID from Firestore (matches user UID)
  displayName: string;
  imageUrl?: string;
  rating: number;
  reviewCount: number;
  createdAt: Timestamp | string;
}


export interface Booking {
  id: string;
  performerId: string; // Added
  performerName: string;
  date: Timestamp;
  time: string;
  location: string;
  status: 'pending' | 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled';
  pricePerHour: number; // The total price the customer pays for the booking (e.g., for 1 hour)
  platformFee: number; // The commission retained by TalentHop
  performerPayout: number; // The net amount the performer receives (pricePerHour - platformFee)
  notes?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp; // When the gig was marked as completed
  userId: string;
  customerReviewSubmitted?: boolean; 
  performerReviewSubmitted?: boolean;
  tipAmount?: number; // Added to store tip
  isVirtual: boolean; // Added for virtual performances
  meetingLink?: string; // Added for virtual performance link
  // Fields to hold review data in escrow until both parties submit
  customerRating?: number;
  customerComment?: string;
  customerName?: string;
  customerImageUrl?: string;
  performerRatingOfCustomer?: number;
  performerCommentOnCustomer?: string;
  reviewDeadline?: Timestamp; // Added to track the 14-day review window
}


export interface AiRecommendedPerformer {
  id: string; // Now includes the real ID from the database
  name: string;
  talentTypes: string[];
  description: string;
  price: number;
  availability: string;
  recommendationReason: string; // Added field for AI justification
  imageUrl?: string;
  dataAiHint?: string;
  rating?: number; // Kept for potential future use or AI estimation
}

export interface SuggestionItem {
  id: string;
  suggestion: string;
  comment: string;
  status: 'new' | 'commented';
  createdAt: Timestamp;
  commentedAt: Timestamp | null;
  suggestedBy: string;
}

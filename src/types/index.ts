import type { Timestamp } from "firebase/firestore";

export interface Review {
  id: string;
  bookingId: string;
  performerId: string;
  userId: string;
  userName: string;
  userImageUrl?: string;
  rating: number;
  comment: string;
  date: Timestamp | string;
}

export interface Performer {
  id: string;
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
  /** Stripe connected account for payouts */
  stripeAccountId?: string;
}

export interface Customer {
  id: string; // Firestore UID
  displayName: string;
  imageUrl?: string;
  rating: number;
  reviewCount: number;
  createdAt: Timestamp | string;
  isActive?: boolean;
}

export interface Booking {
  id: string;
  performerId: string;
  performerName: string;
  /** Date of event */
  date: Timestamp;
  /** Start and end times as full Timestamps for easier queries */
  startTime: Timestamp;
  finishTime: Timestamp;
  location: string;
  status: "pending" | "awaiting_payment" | "confirmed" | "completed" | "cancelled";
  pricePerHour: number;
  platformFee: number;
  performerPayout: number;
  notes?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  userId: string;

  // Review status
  customerReviewedPerformer?: boolean;
  performerReviewSubmitted?: boolean;
  reviewDeadline?: Timestamp;

  // Tip
  tipAmount?: number;
  tipPayoutStatus?: "pending" | "paid" | "failed";
  tipPayoutTransferId?: string;
  tipPayoutError?: string;

  // Stripe payment / payout tracking
  paymentIntentId?: string;
  payoutStatus?: "pending" | "paid" | "failed";
  payoutTransferId?: string;
  payoutError?: string;

  // Escrowed review details
  customerRating?: number;
  customerComment?: string;
  customerName?: string;
  customerImageUrl?: string;
  performerRatingOfCustomer?: number;
  performerCommentOnCustomer?: string;
  performerName?: string;
  performerImageUrl?: string;

  // Virtual/remote gig info
  isVirtual: boolean;
  meetingLink?: string;

  // Flag for publishing combined reviews once both sides submit
  publicReviewsCreated?: boolean;
}

export interface AiRecommendedPerformer {
  id: string;
  name: string;
  talentTypes: string[];
  description: string;
  price: number;
  availability: string;
  recommendationReason: string;
  imageUrl?: string;
  dataAiHint?: string;
  rating?: number;
}

export interface SuggestionItem {
  id: string;
  suggestion: string;
  comment: string;
  status: "new" | "commented";
  createdAt: Timestamp;
  commentedAt: Timestamp | null;
  suggestedBy: string;
}
// src/app/performers/[id]/page.tsx

import { notFound } from 'next/navigation';
import { db } from '@/lib/firebase-admin'; // ✅ make sure firebase-admin exports "db"
import type { Review, Performer } from '@/types';
import { PerformerDetailClient } from '@/components/performer-detail-client';

// Helper to convert Firestore Timestamps to strings
function serializeTimestamp(timestamp: any): string {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  return new Date().toISOString(); // Fallback
}

async function getPerformerData(id: string): Promise<{ performer: Performer; reviews: Review[] }> {
  // Use Admin SDK db
  const performerDocRef = db.collection("performers").doc(id);
  const performerSnap = await performerDocRef.get();

  if (!performerSnap.exists) {
    notFound();
  }

  const performerData = performerSnap.data()!;
  const serializedPerformer: Performer = {
    id: performerSnap.id,
    name: performerData.name || 'Unnamed Performer',
    talentTypes: performerData.talentTypes || [],
    description: performerData.description || '',
    longDescription: performerData.longDescription || '',
    pricePerHour: performerData.pricePerHour || 0,
    availability: performerData.availability || [],
    locationsServed: performerData.locationsServed || [],
    imageUrl: performerData.imageUrl || '',
    dataAiHint: performerData.dataAiHint || '',
    rating: performerData.rating || 0,
    reviewCount: performerData.reviewCount || 0,
    contactEmail: performerData.contactEmail || '',
    specialties: performerData.specialties || [],
    youtubeVideoId: performerData.youtubeVideoId || '',
    isFeatured: performerData.isFeatured || false,
    bankAccountNumber: performerData.bankAccountNumber || "",
    routingNumber: performerData.routingNumber || "",
    createdAt: serializeTimestamp(performerData.createdAt),
  };

  // Fetch PUBLIC reviews
  const reviewsQuery = db.collection('reviews')
    .where("performerId", "==", id)
    .where("author", "==", "customer")
    .orderBy("date", "desc")
    .limit(20);

  const reviewsSnapshot = await reviewsQuery.get();

  const serializedReviews: Review[] = reviewsSnapshot.docs.map(doc => {
    const reviewData = doc.data();
    return {
      id: doc.id,
      bookingId: reviewData.bookingId || '',
      performerId: reviewData.performerId || '',
      userId: reviewData.customerId || '',
      userName: reviewData.userName || 'Anonymous',
      userImageUrl: reviewData.userImageUrl || '',
      rating: reviewData.rating || 0,
      comment: reviewData.comment || '',
      date: serializeTimestamp(reviewData.date),
    };
  });

  return {
    performer: serializedPerformer,
    reviews: serializedReviews,
  };
}

export default async function PerformerDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { performer, reviews } = await getPerformerData(id);

  return (
    <div className="container mx-auto py-8">
      <PerformerDetailClient performer={performer} reviews={reviews} />
    </div>
  );
}
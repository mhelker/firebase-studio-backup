// src/app/performers/[id]/page.tsx

import { notFound } from 'next/navigation';
// --- CHANGE: Import the standard client-side SDK instead of the admin SDK ---
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Review, Performer } from '@/types';
import { PerformerDetailClient } from '@/components/performer-detail-client';

// Helper to convert Firestore Timestamps to strings
function serializeTimestamp(timestamp: any): string {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  // Fallback for data that might already be serialized or is null
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


async function getPerformerData(id: string): Promise<{ performer: Performer; reviews: Review[]; }> {
  // === Using the standard client-side SDK now ===
  const firestore = db; // Use the imported client DB

  // Fetch performer details
  const performerDocRef = doc(firestore, "performers", id);
  const performerSnap = await getDoc(performerDocRef);

  if (!performerSnap.exists()) {
    notFound();
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
      bankAccountNumber: performerData.bankAccountNumber || "",
      routingNumber: performerData.routingNumber || "",
      createdAt: serializeTimestamp(performerData.createdAt),
  };

  // Fetch PUBLIC reviews from the top-level collection
  const publicReviewsRef = collection(firestore, 'reviews');
  const reviewsQuery = query(
    publicReviewsRef,
    where("performerId", "==", id),
    where("author", "==", "customer"),
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


// This part remains the same
export default async function PerformerDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const { performer, reviews } = await getPerformerData(id);

  return (
    <div className="container mx-auto py-8">
      <PerformerDetailClient performer={performer} reviews={reviews} />
    </div>
  );
}

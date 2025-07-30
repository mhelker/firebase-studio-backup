import { notFound } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Review, Performer } from '@/types';
import { PerformerDetailClient } from '@/components/performer-detail-client';

async function getPerformerData(id: string): Promise<{ performer: Performer; reviews: Review[]; }> {
  // Fetch performer details
  const performerDocRef = doc(db, "performers", id);
  const performerSnap = await getDoc(performerDocRef);

  if (!performerSnap.exists()) {
    notFound();
  }
  
  const performerData = performerSnap.data();
  // Manually rebuild the performer object to ensure all data is serializable and has fallbacks
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
      // Safely serialize the timestamp. Pass as is if already a string, or convert from Timestamp.
      createdAt: performerData.createdAt instanceof Timestamp ? performerData.createdAt.toDate().toISOString() : performerData.createdAt,
  };

  // Fetch reviews
  const reviewsCollectionRef = collection(db, `performers/${id}/reviews`);
  const reviewsQuery = query(reviewsCollectionRef, orderBy("date", "desc"), limit(10));
  const reviewsSnapshot = await getDocs(reviewsQuery);
  
  // Manually rebuild reviews to ensure all data is serializable
  const serializedReviews: Review[] = reviewsSnapshot.docs.map(doc => {
    const reviewData = doc.data();
    return {
      id: doc.id,
      bookingId: reviewData.bookingId || '',
      performerId: reviewData.performerId || '',
      userId: reviewData.userId || '',
      userName: reviewData.userName || 'Anonymous',
      userImageUrl: reviewData.userImageUrl || '',
      rating: reviewData.rating || 0,
      comment: reviewData.comment || '',
      // Safely serialize the timestamp
      date: reviewData.date instanceof Timestamp ? reviewData.date.toDate().toISOString() : reviewData.date,
    };
  });

  return {
    performer: serializedPerformer,
    reviews: serializedReviews,
  };
}


// Note: This is now a Server Component
export default async function PerformerDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { performer, reviews } = await getPerformerData(id);

  return (
    <div className="container mx-auto py-8">
      <PerformerDetailClient performer={performer} reviews={reviews} />
    </div>
  );
}

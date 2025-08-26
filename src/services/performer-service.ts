'use server';

import { db } from '@/lib/firebase';
import type { Performer } from '@/types';
import { collection, getDocs, query, where, limit, orderBy, QueryConstraint, Timestamp } from 'firebase/firestore';

interface SearchCriteria {
    talentType?: string;
    searchTerm?: string;
}

export async function searchPerformers(criteria: SearchCriteria): Promise<Performer[]> {
  try {
    const performersCollection = collection(db, 'performers');
    
    // --- THIS IS THE FIX ---
    // We start our query constraints by ensuring we only get active performers.
    // The `"!="` operator correctly includes performers who don't have the `isActive` field yet.
    const constraints: QueryConstraint[] = [
        where('isActive', '!=', false)
    ];

    const { talentType, searchTerm } = criteria;
    
    if (talentType && talentType !== 'All') {
        constraints.push(where('talentTypes', 'array-contains', talentType));
    }
    
    // Add the rest of the constraints
    constraints.push(orderBy('rating', 'desc'));
    constraints.push(limit(15));

    const q = query(performersCollection, ...constraints);
    const querySnapshot = await getDocs(q);

    let performers = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      
      const createdAt = data.createdAt instanceof Timestamp 
        ? data.createdAt.toDate().toISOString() 
        : data.createdAt;

      return { 
        id: doc.id, 
        ...data,
        createdAt,
      } as Performer;
    });

    // Client-side filtering for search term remains the same
    if (searchTerm) {
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        performers = performers.filter(performer => {
             return (performer.name || '').toLowerCase().includes(lowercasedSearchTerm) ||
                    (performer.description || '').toLowerCase().includes(lowercasedSearchTerm) ||
                    (performer.talentTypes || []).some(tt => tt.toLowerCase().includes(lowercasedSearchTerm));
        });
    }

    return performers;

  } catch (error: any) {
    console.error("Error searching performers in Firestore:", error);
    throw new Error(error.message || "An unexpected error occurred while searching for performers.");
  }
}

'use server';

import { db } from '@/lib/firebase';
import type { Performer } from '@/types';
import { collection, getDocs, query, where, limit, orderBy, QueryConstraint } from 'firebase/firestore';

interface SearchCriteria {
    talentType?: string;
    searchTerm?: string;
}

/**
 * Searches for performers in the Firestore database with server-side filtering and sorting.
 * @param criteria An object containing talentType and searchTerm.
 * @returns A promise that resolves to an array of Performer objects.
 */
export async function searchPerformers(criteria: SearchCriteria): Promise<Performer[]> {
  try {
    const performersCollection = collection(db, 'performers');
    const constraints: QueryConstraint[] = [];

    const { talentType, searchTerm } = criteria;
    const normalizedTalentType = talentType?.trim();
    
    // Talent Type Filtering
    if (normalizedTalentType && normalizedTalentType.toLowerCase() !== 'any') {
        // To make search case-insensitive, we'd typically store a lowercase array.
        // For this prototype, we'll try to match the exact string first.
        constraints.push(where('talentTypes', 'array-contains', normalizedTalentType));
    }
    
    // IMPORTANT: Firestore does not support full-text search on its own.
    // The query below can't effectively handle a general `searchTerm` across multiple fields.
    // The best practice is to use a dedicated search service like Algolia or Elasticsearch.
    // For this prototype, we will keep client-side filtering for the search term after an initial DB query.
    // We will, however, add server-side sorting by rating.
    constraints.push(orderBy('rating', 'desc'));
    constraints.push(limit(50)); // Limit to a reasonable number for performance.

    const q = query(performersCollection, ...constraints);
    const querySnapshot = await getDocs(q);

    let performers = querySnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Performer
    );

    // Client-side filtering for search term (as a necessary workaround)
    if (searchTerm) {
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        performers = performers.filter(performer => {
             return (performer.name || '').toLowerCase().includes(lowercasedSearchTerm) ||
                    (performer.description || '').toLowerCase().includes(lowercasedSearchTerm) ||
                    (performer.talentTypes || []).some(tt => tt.toLowerCase().includes(lowercasedSearchTerm));
        });
    }

    return performers;

  } catch (error) {
    console.error("Error searching performers in Firestore:", error);
    // In case of an error (e.g., missing index), return an empty array
    // to prevent the flow from crashing.
    return [];
  }
}

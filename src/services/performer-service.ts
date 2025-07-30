
'use server';

import { db } from '@/lib/firebase';
import type { Performer } from '@/types';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';

/**
 * Searches for performers in the Firestore database.
 * @param talentType The primary talent type to filter by. If 'All' or empty, fetches any performers.
 * @returns A promise that resolves to an array of Performer objects.
 */
export async function searchPerformers(talentType: string): Promise<Performer[]> {
  try {
    const performersCollection = collection(db, 'performers');
    let q;

    const normalizedTalentType = talentType.trim();

    if (normalizedTalentType && normalizedTalentType.toLowerCase() !== 'any') {
      // Create a query to find performers where the talentType is in their talentTypes array.
      // Firestore requires an exact match for array-contains, so case sensitivity matters.
      // A more robust solution would involve storing a lowercase version of talent types.
      // For this prototype, we'll try to match the provided case.
      q = query(
        performersCollection,
        where('talentTypes', 'array-contains', normalizedTalentType),
        limit(10)
      );
    } else {
      // If no specific talent type, just get a general list of performers.
      q = query(performersCollection, limit(10));
    }

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty && normalizedTalentType && normalizedTalentType.toLowerCase() !== 'any') {
        // As a fallback, try matching with the first letter capitalized, as that's a common input format.
        const capitalizedTalentType = normalizedTalentType.charAt(0).toUpperCase() + normalizedTalentType.slice(1).toLowerCase();
        const fallbackQuery = query(
             performersCollection,
            where('talentTypes', 'array-contains', capitalizedTalentType),
            limit(10)
        );
        const fallbackSnapshot = await getDocs(fallbackQuery);
        return fallbackSnapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Performer
        );
    }


    return querySnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Performer
    );
  } catch (error) {
    console.error("Error searching performers in Firestore:", error);
    // In case of an error (e.g., missing index), return an empty array
    // to prevent the flow from crashing.
    return [];
  }
}

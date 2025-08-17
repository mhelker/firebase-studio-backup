'use server';

import { db } from '@/lib/firebase';
import type { Performer } from '@/types';
import { collection, getDocs, query, where, limit, orderBy, QueryConstraint, Timestamp } from 'firebase/firestore'; // Import Timestamp

interface SearchCriteria {
    talentType?: string;
    searchTerm?: string;
}

export async function searchPerformers(criteria: SearchCriteria): Promise<Performer[]> {
  try {
    const performersCollection = collection(db, 'performers');
    const constraints: QueryConstraint[] = [];

    const { talentType, searchTerm } = criteria;
    
    if (talentType && talentType !== 'All') {
        constraints.push(where('talentTypes', 'array-contains', talentType));
    }
    
    constraints.push(orderBy('rating', 'desc'));
    constraints.push(limit(15)); // Limit to a smaller number to conserve AI tokens.

    const q = query(performersCollection, ...constraints);
    const querySnapshot = await getDocs(q);

    // --- THE FIX IS HERE ---
    // We will now manually process each document to ensure all data is "plain"
    let performers = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      
      // Check if createdAt is a Firestore Timestamp and convert it
      const createdAt = data.createdAt instanceof Timestamp 
        ? data.createdAt.toDate().toISOString() 
        : data.createdAt;

      return { 
        id: doc.id, 
        ...data,
        createdAt, // Overwrite the original createdAt with our plain string version
      } as Performer;
    });

    // Client-side filtering for search term
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

"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PerformerCard } from '@/components/performer-card';
import type { Performer } from '@/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X, AlertTriangle, PackageOpen, Loader2 } from 'lucide-react';
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { searchPerformers } from '@/services/performer-service';

// Helper for loading state
const PerformersLoadingSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {[...Array(8)].map((_, i) => (
      <Card key={i} className="flex flex-col overflow-hidden">
        <CardHeader className="p-0">
          <Skeleton className="h-48 w-full" />
        </CardHeader>
        <CardContent className="p-4 flex-grow">
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2 mb-2" />
          <Skeleton className="h-12 w-full mb-3" />
          <Skeleton className="h-4 w-1/3 mb-2" />
          <Skeleton className="h-5 w-2/3" />
        </CardContent>
        <CardFooter className="p-4 border-t">
          <Skeleton className="h-10 w-full" />
        </CardFooter>
      </Card>
    ))}
  </div>
);

export default function PerformersPage() {
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTalentTypes, setAllTalentTypes] = useState<string[]>(['All']);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTalentType, setSelectedTalentType] = useState('All');

  const fetchTalentTypes = useCallback(async () => {
    // Fetch all performers just once to populate the talent type dropdown.
    // This is a trade-off for UI convenience vs. initial load.
    try {
        const performersCollection = collection(db, "performers");
        const q = query(performersCollection, limit(100)); // Limit to prevent huge loads
        const querySnapshot = await getDocs(q);
        const types = new Set<string>();
        querySnapshot.forEach(doc => {
            const data = doc.data() as Performer;
            (data.talentTypes || []).forEach(tt => types.add(tt));
        });
        setAllTalentTypes(['All', ...Array.from(types).sort()]);
    } catch (err) {
        console.error("Error fetching talent types:", err);
        // Don't set a visible error, just fall back to a basic list.
        setAllTalentTypes(['All', 'Music', 'Magic', 'Comedy', 'DJ']);
    }
  }, []);

  const runSearch = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await searchPerformers({
          talentType: selectedTalentType,
          searchTerm: searchTerm
        });
        setPerformers(results);
      } catch (err) {
        console.error("Error fetching performers:", err);
        setError("Failed to load performers. Please check your Firestore security rules and required indexes.");
      } finally {
        setIsLoading(false);
      }
  }, [selectedTalentType, searchTerm]);

  useEffect(() => {
    fetchTalentTypes();
  }, [fetchTalentTypes]);

  // Initial load and subsequent searches
  useEffect(() => {
    runSearch();
  }, [runSearch]);


  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedTalentType('All');
  };

  const isFiltered = searchTerm || selectedTalentType !== 'All';

  return (
    <div className="space-y-8">
      <section className="bg-card p-6 rounded-lg shadow">
        <h1 className="text-3xl font-headline font-semibold mb-6 text-primary">Find Your Perfect Performer</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label htmlFor="search" className="block text-sm font-medium text-foreground mb-1">Search by Name or Keyword</label>
            <div className="relative">
              <Input 
                type="text" 
                id="search" 
                placeholder="e.g., Magician, Jazz Band" 
                className="pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div>
            <label htmlFor="talent-type" className="block text-sm font-medium text-foreground mb-1">Talent Type</label>
            <Select value={selectedTalentType} onValueChange={setSelectedTalentType} disabled={allTalentTypes.length <= 1}>
              <SelectTrigger id="talent-type">
                <SelectValue placeholder="Select talent type" />
              </SelectTrigger>
              <SelectContent>
                {allTalentTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {isFiltered && (
            <div className="flex justify-end mt-4">
                <Button onClick={handleClearFilters} variant="ghost" size="sm">
                    <X className="mr-2 h-4 w-4" />
                    Clear Filters
                </Button>
            </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-headline font-semibold mb-6">
          {isLoading ? 'Searching...' : `Available Performers (${performers.length})`}
        </h2>

        {isLoading && <PerformersLoadingSkeleton />}
        
        {error && (
          <div className="text-center py-10 bg-destructive/10 text-destructive-foreground p-6 rounded-lg shadow">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <p className="text-xl font-semibold">Oops! Something went wrong.</p>
            <p className="mt-2">{error}</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {performers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {performers.map((performer) => (
                  <PerformerCard key={performer.id} performer={performer} />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-card rounded-lg shadow">
                <PackageOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-xl text-muted-foreground">No performers match your criteria.</p>
                <p className="mt-2">Try adjusting your search or talent type filter.</p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}


import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { CheckCircle, Search, Sparkles, Users, Star, Award, AlertTriangle, Heart } from 'lucide-react';
import { collection, getDocs, query, limit, Timestamp, orderBy, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import type { Performer, Customer } from '@/types';
import { PerformerCard } from '@/components/performer-card';
import { CustomerCard } from '@/components/ui/customer-card';
import { mockPerformers } from '@/lib/mock-data';

// This function fetches live performer data from Firestore.
async function getPerformersData(): Promise<{ performers: Performer[], error?: string }> {
    if (!isFirebaseConfigured) {
        return { 
            performers: [], 
            error: "Firebase is not configured. Please add your API keys to src/lib/firebase.ts to connect to the database."
        };
    }
    try {
        const performersCollection = collection(db, "performers");
        const q = query(performersCollection, orderBy("rating", "desc"), limit(50));
        const querySnapshot = await getDocs(q);
        
        const performers = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Manually build the performer object to ensure all data is serializable
            const serializedPerformer: Performer = {
                id: doc.id,
                name: data.name || 'Unnamed Performer',
                talentTypes: data.talentTypes || [],
                description: data.description || '',
                longDescription: data.longDescription || '',
                pricePerHour: data.pricePerHour || 0,
                availability: data.availability || [],
                locationsServed: data.locationsServed || [],
                imageUrl: data.imageUrl || '',
                dataAiHint: data.dataAiHint || '',
                rating: data.rating || 0,
                reviewCount: data.reviewCount || 0,
                contactEmail: data.contactEmail || '',
                specialties: data.specialties || [],
                youtubeVideoId: data.youtubeVideoId || '',
                isFeatured: data.isFeatured || false,
                bankAccountNumber: data.bankAccountNumber || "",
                routingNumber: data.routingNumber || "",
                // Safely serialize the timestamp.
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            };
            return serializedPerformer;
        });
        return { performers };
    } catch (error: any) {
        console.error("Error fetching performers:", error);
        // This error will be shown on the page if Firestore access fails.
        return { 
            performers: [], 
            error: "Could not load performers from the database. This is likely due to Firestore security rules. Please run `firebase deploy --only firestore:rules` in your terminal." 
        };
    }
}

async function getCustomersData(): Promise<{ customers: Customer[], error?: string }> {
    if (!isFirebaseConfigured) {
        return { customers: [] };
    }
    try {
        const customersCollection = collection(db, "customers");
        const q = query(customersCollection, where("reviewCount", ">", 0), orderBy("reviewCount", "desc"), orderBy("rating", "desc"), limit(8));
        const querySnapshot = await getDocs(q);
        
        const customers = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                displayName: data.displayName || 'Anonymous Customer',
                rating: data.rating || 0,
                reviewCount: data.reviewCount || 0,
                imageUrl: data.imageUrl || '',
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            } as Customer;
        });
        return { customers };
    } catch (error: any) {
        console.error("Error fetching customers:", error);
        // This is the critical fix: Check for the specific error code for a missing index.
        if (error.code === 'failed-precondition') {
            return { 
                customers: [],
                error: "A Firestore index is required for this query. Please check the Firebase console for an automatic index creation link, or create one manually on the `customers` collection for `reviewCount` (desc) and `rating` (desc)."
            };
        }
        return { 
            customers: [], 
            error: "An unexpected error occurred while fetching top customers."
        };
    }
}


export default async function HomePage() {
  const { performers: livePerformers, error: performersError } = await getPerformersData();
  const { customers: topCustomers, error: customersError } = await getCustomersData();

  // Use mock data as a fallback if the live database is empty and there was no error fetching.
  const useMockData = !performersError && livePerformers.length === 0;
  const allPerformers = useMockData ? mockPerformers : livePerformers;

  const topPerformers = allPerformers.slice(0, 8);
    
  const sortedTopCustomers = [...topCustomers].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 8);

  const features = [
    { icon: <Search className="w-8 h-8 text-accent" />, title: "Discover Talent", description: "Find amazing performers for any occasion." },
    { icon: <CheckCircle className="w-8 h-8 text-accent" />, title: "Easy Booking", description: "Book your favorite talent in just a few clicks." },
    { icon: <Sparkles className="w-8 h-8 text-accent" />, title: "AI Recommendations", description: "Get personalized suggestions for your event." },
  ];

  return (
    <div className="space-y-16">
      <section
        className="relative h-[400px] rounded-lg shadow-xl overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: "url('https://i.imgur.com/FX1t3e2.jpeg')" }}
        data-ai-hint="concert stage"
      >
        <div className="absolute inset-0 bg-primary/70" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center p-4 text-primary-foreground">
          <h1 className="text-4xl md:text-5xl font-headline font-bold mb-6">
            Talent at Your Doorstep
          </h1>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto">
            Discover and book amazing local performers for your events, parties, or just for fun!
          </p>
          <div className="space-x-4">
            <Button size="lg" asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="/performers">Find Performers</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary" asChild>
              <Link href="/recommendations">Get AI Picks</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-12">
        <h2 className="text-3xl font-headline font-semibold text-center mb-10">How TalentHop Works</h2>
        <div className="grid md:grid-cols-3 gap-8 text-center">
          {features.map((feature, index) => (
            <div key={index} className="bg-card p-6 rounded-lg shadow-md">
              <div className="flex justify-center mb-4">{feature.icon}</div>
              <h3 className="text-xl font-headline font-semibold mb-2 text-primary">{feature.title}</h3>
              <p className="text-foreground/80">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
      
      <section id="top-performers" className="py-12">
        <h2 className="text-3xl font-headline font-semibold text-center mb-10 flex items-center justify-center">
            <Star className="w-8 h-8 mr-3 text-accent" />
            Top Rated Performers
        </h2>
        {useMockData && (
          <div className="text-center bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-8 max-w-3xl mx-auto">
             <p className="font-semibold">Displaying Demo Data</p>
             <p className="text-sm">Your live database is empty. To see live data, please create a performer profile.</p>
          </div>
        )}
        {performersError ? (
          <div className="text-center text-destructive bg-destructive/10 p-6 rounded-lg max-w-3xl mx-auto">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-2">Error Loading Performers</h3>
            <p>{performersError}</p>
          </div>
        ) : topPerformers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {topPerformers.map((performer) => (
              <PerformerCard key={performer.id} performer={performer} />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground bg-card p-8 rounded-lg shadow-sm">
            <p>No performers found. Create a profile to be the first one featured here!</p>
          </div>
        )}
      </section>

      <section id="top-customers" className="py-12">
        <h2 className="text-3xl font-headline font-semibold text-center mb-10 flex items-center justify-center">
            <Heart className="w-8 h-8 mr-3 text-accent" />
            Top Rated Customers
        </h2>
         {customersError ? (
            <div className="text-center text-destructive bg-destructive/10 p-6 rounded-lg max-w-3xl mx-auto">
                <AlertTriangle className="w-8 h-8 mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-2">Error Loading Customers</h3>
                <p>{customersError}</p>
             </div>
         ) : sortedTopCustomers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {sortedTopCustomers.map((customer) => (
                    <CustomerCard key={customer.id} customer={customer} />
                ))}
            </div>
        ) : (
            <div className="text-center text-muted-foreground bg-card p-8 rounded-lg shadow-sm">
                <p>Top customers will be featured here once they receive ratings from performers!</p>
            </div>
        )}
      </section>

      <section className="py-12 bg-secondary/30 rounded-lg">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-headline font-semibold mb-4 text-primary">Are You a Performer?</h2>
          <p className="text-lg mb-6 text-foreground/80">
            Join TalentHop and share your talent with the world. Set your own schedule and prices.
          </p>
          <Button size="lg" variant="outline" asChild className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Link href="/profile/create">Join as a Performer</Link>
          </Button>
        </div>
      </section>
      
       <div className="text-center mt-10">
          <Button size="lg" asChild>
            <Link href="/performers">View All Performers</Link>
          </Button>
        </div>
    </div>
  );

    
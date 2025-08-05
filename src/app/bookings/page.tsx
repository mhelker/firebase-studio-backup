
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CalendarCheck, History, Loader2, PackageOpen, UserX, AlertTriangle } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { collection, query, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import type { Booking } from "@/types";
import { Badge } from "@/components/ui/badge";

export default function BookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [pastBookings, setPastBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const bookingsCollection = collection(db, "bookings");
      const q = query(bookingsCollection, where("userId", "==", user.uid), where("status", "!=", "cancelled"));
      const bookingsSnapshot = await getDocs(q);
      
      const userBookings = bookingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Booking));

      userBookings.sort((a, b) => {
        const dateA = a.date?.toMillis() || 0;
        const dateB = b.date?.toMillis() || 0;
        return dateB - dateA;
      });
      
      const upcoming: Booking[] = [];
      const past: Booking[] = [];
      const now = new Date();

      userBookings.forEach(booking => {
        const bookingDate = booking.date?.toDate ? booking.date.toDate() : new Date(0);
        if (bookingDate < now || booking.status === 'completed') {
            past.push(booking);
        } else {
            upcoming.push(booking);
        }
      });

      setUpcomingBookings(upcoming.sort((a,b) => (a.date?.toMillis() || 0) - (b.date?.toMillis() || 0)));
      setPastBookings(past);

    } catch (err: any) {
      console.error("Error fetching bookings:", err);
      setError("Failed to load bookings. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchBookings();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [user, authLoading, fetchBookings]);

  const getStatusClass = (status: Booking['status']) => {
    switch(status) {
        case 'cancelled': return 'text-destructive';
        case 'confirmed': return 'text-green-600';
        case 'completed': return 'text-green-600';
        case 'pending': return 'text-primary';
        case 'awaiting_payment': return 'text-accent-foreground bg-accent/80 px-2 rounded';
        default: return 'text-primary';
    }
  }


  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading authentication...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 text-center">
         <Card className="max-w-md mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-center"><UserX className="w-8 h-8 mr-2 text-primary" /> Login Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">You need to be logged in to view your bookings.</p>
            <Button asChild>
              <Link href="/login">Go to Login Page</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-headline font-semibold mb-8 text-primary">My Bookings</h1>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><CalendarCheck className="w-6 h-6 mr-2 text-primary" /> Upcoming Bookings</CardTitle>
          <CardDescription>A simplified view of your scheduled performances.</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          {isLoading && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading your bookings...</p>
            </div>
          )}
          {error && <div className="text-center text-destructive bg-destructive/10 p-4 rounded-md">
                <AlertTriangle className="w-6 h-6 mx-auto mb-2"/>
                <p className="font-semibold">Error Loading Bookings</p>
                <p className="text-sm">{error}</p>
            </div>
          }
          {!isLoading && !error && upcomingBookings.length === 0 && (
            <div className="text-center py-10">
              <PackageOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">You have no upcoming bookings.</p>
              <Button asChild>
                <Link href="/performers">Find Talent to Book</Link>
              </Button>
            </div>
          )}
          {!isLoading && !error && upcomingBookings.length > 0 && (
            <div className="space-y-4">
              {upcomingBookings.map(booking => (
                <Card key={booking.id} className="bg-secondary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-headline">Booking for: {booking.performerName}</CardTitle>
                    <CardDescription className="text-sm">
                      Status: <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'} className={`${getStatusClass(booking.status)}`}>{booking.status ? booking.status.replace(/_/g, ' ') : 'N/A'}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1 pt-2">
                    <p><strong>Date:</strong> {booking.date && typeof booking.date.toDate === 'function' ? format(booking.date.toDate(), "PPP") : 'N/A'} at {booking.time}</p>
                    <p><strong>Location:</strong> {booking.location}</p>
                    <p><strong>Price:</strong> ${booking.pricePerHour.toFixed(2)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><History className="w-6 h-6 mr-2 text-primary" /> Past Bookings</CardTitle>
          <CardDescription>A simplified view of your performance history.</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          {isLoading && (
             <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading past bookings...</p>
            </div>
          )}
           {!isLoading && !error && pastBookings.length === 0 && (
            <div className="text-center py-10">
              <PackageOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No past bookings found.</p>
            </div>
          )}
          {!isLoading && !error && pastBookings.length > 0 && (
            <div className="space-y-4">
              {pastBookings.map(booking => (
                 <Card key={booking.id} className="bg-card/80 opacity-70">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-headline">Booking for: {booking.performerName}</CardTitle>
                     <CardDescription className="text-xs">
                       Status: <Badge className={`${getStatusClass(booking.status)}`}>{booking.status ? booking.status.replace(/_/g, ' ') : 'N/A'}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2 pt-2">
                    <p><strong>Date:</strong> {booking.date && typeof booking.date.toDate === 'function' ? format(booking.date.toDate(), "PPP") : 'N/A'} at {booking.time}</p>
                    <p><strong>Price:</strong> ${booking.pricePerHour.toFixed(2)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

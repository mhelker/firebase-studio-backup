
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CalendarCheck, History, Loader2, PackageOpen, UserX, AlertTriangle, CreditCard, Star } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { collection, query, getDocs, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import type { Booking } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ReviewAndTipForm } from "@/components/review-and-tip-form";
import { useRouter } from "next/navigation";


export default function BookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const router = useRouter();

  const fetchBookings = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const bookingsCollection = collection(db, "bookings");
      // A simplified query to avoid needing a composite index immediately.
      // Filtering and sorting will be handled client-side, which is fine for a user's own bookings.
      const q = query(bookingsCollection, where("userId", "==", user.uid));
      const bookingsSnapshot = await getDocs(q);
      
      const userBookings = bookingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Booking));

      // Sort by creation date client-side
      userBookings.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

      setBookings(userBookings);

    } catch (err: any) {
      console.error("Error fetching bookings:", err);
      // More specific error handling for missing indexes
      if (err.code === 'failed-precondition') {
          setError("A Firestore index is required for this query. Please check the terminal logs for a link to create the index in the Firebase console.");
      } else if (err.code === 'permission-denied') {
          setError("Permission denied. Please check your Firestore security rules. You may need to deploy them using the 'firebase deploy' command in your terminal.");
      } else {
          setError("Failed to load bookings. Please try again later.");
      }
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
  
  const getCategorizedBookings = () => {
    const upcoming: Booking[] = [];
    const past: Booking[] = [];
    const now = new Date();

    bookings.forEach(booking => {
      const isPastDate = booking.date ? booking.date.toDate() < now : false;

      // Bookings that are 'completed' or 'cancelled' are always in the past.
      if (booking.status === 'completed' || booking.status === 'cancelled') {
        past.push(booking);
      } 
      // Bookings whose event date has passed should also be considered past events.
      else if (isPastDate) {
        // If it was confirmed, show it as 'completed' to allow review.
        // Otherwise, it expired without action, so it's just a 'past' event.
        past.push({ ...booking, status: booking.status === 'confirmed' ? 'completed' : booking.status });
      }
      // All others are upcoming or pending.
      else {
        upcoming.push(booking);
      }
    });
    
    // Sort upcoming bookings by date ascending (soonest first)
    upcoming.sort((a,b) => (a.date?.toMillis() || 0) - (b.date?.toMillis() || 0));

    return { upcoming, past };
  }

  const { upcoming, past } = getCategorizedBookings();
  
  const handleReviewSubmitted = () => {
      setReviewingBooking(null);
      fetchBookings(); // Re-fetch data to update the UI
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
          <CardTitle className="flex items-center"><CalendarCheck className="w-6 h-6 mr-2 text-primary" /> Upcoming & Pending Bookings</CardTitle>
          <CardDescription>Performances you have requested or confirmed.</CardDescription>
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
          {!isLoading && !error && upcoming.length === 0 && (
            <div className="text-center py-10">
              <PackageOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">You have no upcoming bookings.</p>
              <Button asChild>
                <Link href="/performers">Find Talent to Book</Link>
              </Button>
            </div>
          )}
          {!isLoading && !error && upcoming.length > 0 && (
            <div className="space-y-4">
              {upcoming.map(booking => (
                <Card key={booking.id} className="bg-secondary/30">
                  <CardHeader>
                    <CardTitle className="text-xl font-headline">Booking for: {booking.performerName}</CardTitle>
                    <CardDescription className="text-sm">
                      Status: <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'} className="capitalize">{booking.status ? booking.status.replace(/_/g, ' ') : 'N/A'}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>Date:</strong> {booking.date && typeof booking.date.toDate === 'function' ? format(booking.date.toDate(), "PPP") : 'N/A'} at {booking.time}</p>
                    <p><strong>Location:</strong> {booking.location}</p>
                    <p><strong>Price:</strong> ${booking.pricePerHour.toFixed(2)}</p>
                  </CardContent>
                   <CardFooter>
                      {booking.status === 'awaiting_payment' && (
                        <Button onClick={() => router.push(`/bookings/${booking.id}/pay`)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                          <CreditCard className="w-4 h-4 mr-2" />
                          Confirm & Pay Now
                        </Button>
                      )}
                      {booking.status === 'pending' && (
                          <p className="text-sm text-muted-foreground">Awaiting response from performer...</p>
                      )}
                       {booking.status === 'confirmed' && (
                          <p className="text-sm text-green-600 font-semibold">This booking is confirmed! See you there.</p>
                      )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><History className="w-6 h-6 mr-2 text-primary" /> Past Bookings</CardTitle>
          <CardDescription>Your performance history.</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          {isLoading && (
             <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading past bookings...</p>
            </div>
          )}
           {!isLoading && !error && past.length === 0 && (
            <div className="text-center py-10">
              <PackageOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No past bookings found.</p>
            </div>
          )}
          {!isLoading && !error && past.length > 0 && (
            <div className="space-y-4">
              {past.map(booking => (
                 <Card key={booking.id} className="bg-card/80 opacity-80">
                  <CardHeader>
                    <CardTitle className="text-lg font-headline">Booking for: {booking.performerName}</CardTitle>
                     <CardDescription className="text-xs">
                       Status: <Badge variant={booking.status === 'completed' ? 'default' : 'destructive'} className="capitalize">{booking.status ? booking.status.replace(/_/g, ' ') : 'N/A'}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p><strong>Date:</strong> {booking.date && typeof booking.date.toDate === 'function' ? format(booking.date.toDate(), "PPP") : 'N/A'} at {booking.time}</p>
                    <p><strong>Price:</strong> ${booking.pricePerHour.toFixed(2)}</p>
                    {booking.tipAmount && booking.tipAmount > 0 && (
                        <p className="font-semibold"><strong>Tip Paid:</strong> ${booking.tipAmount.toFixed(2)}</p>
                    )}
                  </CardContent>
                  <CardFooter>
                    {booking.status === 'completed' && !booking.customerReviewSubmitted && (
                       <Button variant="outline" size="sm" onClick={() => setReviewingBooking(booking)}>
                          <Star className="w-4 h-4 mr-2" />
                          Leave a Review
                       </Button>
                    )}
                     {booking.status === 'completed' && booking.customerReviewSubmitted && (
                        <p className="text-sm text-green-600 font-semibold">Thank you for your review!</p>
                     )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

        {reviewingBooking && (
             <Dialog open={!!reviewingBooking} onOpenChange={(isOpen) => !isOpen && setReviewingBooking(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Review your experience with {reviewingBooking.performerName}</DialogTitle>
                        <DialogDescription>
                            Your feedback helps our community. You can also add an optional tip.
                        </DialogDescription>
                    </DialogHeader>
                    <ReviewAndTipForm 
                        bookingId={reviewingBooking.id}
                        performerId={reviewingBooking.performerId}
                        onReviewSubmitted={handleReviewSubmitted}
                    />
                </DialogContent>
            </Dialog>
        )}
    </div>
  );
}


"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CalendarCheck, History, Loader2, PackageOpen, Ban, UserX, Star, CreditCard, Clock, AlertTriangle, Video } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { collection, query, getDocs, doc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import type { Booking } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ReviewAndTipForm } from "@/components/review-and-tip-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSearchParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export default function BookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [pastBookings, setPastBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingBookingId, setReviewingBookingId] = useState<string | null>(null);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // This handles showing a success toast after a tip payment redirect.
  useEffect(() => {
    if (searchParams.get('tip_success')) {
      toast({
        title: "Tip successful!",
        description: "Thank you for your generosity!",
      });
      // Clean up the URL
      router.replace('/bookings', {scroll: false});
    }
  }, [searchParams, toast, router]);

  const fetchBookings = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const bookingsCollection = collection(db, "bookings");
      const q = query(bookingsCollection, where("userId", "==", user.uid));
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
        const isPastDate = bookingDate < now;
        const status = booking.status || 'pending';

        if (status === 'completed' || status === 'cancelled') {
            past.push(booking);
        } else if (isPastDate && (status === 'confirmed' || status === 'awaiting_payment')) {
            // Treat past, but still somehow confirmed/paid bookings as completed for review purposes
            past.push({ ...booking, status: 'completed' });
        } else {
            // All other statuses are upcoming
            upcoming.push(booking);
        }
      });

      setUpcomingBookings(upcoming.sort((a,b) => (a.date?.toMillis() || 0) - (b.date?.toMillis() || 0)));
      setPastBookings(past);

    } catch (err: any) {
      console.error("Error fetching bookings:", err);
      let errorMessage = "Failed to load bookings. Please try again later.";
      if (err.code === 'permission-denied' || err.code === 'unauthenticated') {
          errorMessage = "You don't have permission to view these bookings. Please ensure you have deployed the correct Firestore security rules (`firebase deploy --only firestore:rules`).";
      } else if (err.code === 'unavailable') {
          errorMessage = "Could not connect to the database. This might be due to incorrect Firebase configuration in `src/lib/firebase.ts` or a network issue. Please check your config and deploy the security rules.";
      }
      setError(errorMessage);
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

  const handleUpdateStatus = async (bookingId: string, status: Booking['status'], successTitle: string, successDescription: string) => {
    try {
      const bookingRef = doc(db, "bookings", bookingId);
      await updateDoc(bookingRef, { status });
      toast({
        title: successTitle,
        description: successDescription,
      });
      fetchBookings(); 
    } catch (err) {
      console.error(`Error updating booking to ${status}:`, err);
      toast({
        title: "Error",
        description: "Could not update the booking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusClass = (status: Booking['status']) => {
    switch(status) {
        case 'cancelled': return 'text-destructive';
        case 'confirmed': return 'text-green-600';
        case 'pending': return 'text-primary';
        case 'awaiting_payment': return 'text-accent-foreground bg-accent/80 px-2 rounded';
        case 'completed': return 'text-green-600';
        default: return 'text-primary';
    }
  }

  const CancelBookingButton = ({ bookingId }: { bookingId: string }) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="border-destructive text-destructive hover:bg-destructive/10 flex-shrink-0"
        >
          <Ban className="w-4 h-4 mr-2" />
          Cancel Request
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to cancel?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The performer will be notified that you have cancelled this request.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Booking</AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => handleUpdateStatus(bookingId, 'cancelled', 'Booking Cancelled', 'Your booking has been successfully cancelled.')}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Yes, Cancel
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );


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
          <CardDescription>View and manage your scheduled performances.</CardDescription>
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
                      Status: <span className={`font-semibold capitalize ${getStatusClass(booking.status)}`}>{booking.status ? booking.status.replace(/_/g, ' ') : 'N/A'}</span>
                    </CardDescription>
                     {booking.isVirtual && (
                        <Badge variant="outline" className="w-fit mt-1 bg-background">
                            <Video className="w-4 h-4 mr-2" />
                            Virtual Performance
                        </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>Date:</strong> {booking.date && typeof booking.date.toDate === 'function' ? format(booking.date.toDate(), "PPP") : 'N/A'} at {booking.time}</p>
                    <p><strong>Location:</strong> {booking.location}</p>
                    <p><strong>Price:</strong> ${booking.pricePerHour.toFixed(2)}</p>
                    {booking.notes && <p><strong>Notes:</strong> {booking.notes}</p>}
                    <p className="text-xs text-muted-foreground pt-1">Requested on: {booking.createdAt && typeof booking.createdAt.toDate === 'function' ? format(booking.createdAt.toDate(), "PPP p") : 'N/A'}</p>
                  </CardContent>
                  <CardFooter className="pt-2 pb-4 flex-col items-start gap-2">
                    {booking.status === 'pending' && (
                        <div className="w-full flex flex-col sm:flex-row items-start sm:items-center gap-2">
                          <div className="w-full p-3 bg-primary/10 border border-primary/20 text-primary rounded-md flex items-start gap-3 flex-grow">
                            <Clock className="w-6 h-6 mt-1 flex-shrink-0" />
                            <div>
                                <p className="font-semibold">Awaiting Performer Confirmation</p>
                                <p className="text-xs text-primary/80">The performer has been notified. You will be able to pay once they accept your request.</p>
                            </div>
                          </div>
                          <CancelBookingButton bookingId={booking.id} />
                        </div>
                    )}
                     {booking.status === 'awaiting_payment' && (
                        <div className="w-full flex flex-col sm:flex-row items-start sm:items-center gap-2">
                           <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 flex-grow">
                             <Link href={`/bookings/${booking.id}/pay`}>
                                <CreditCard className="w-4 h-4 mr-2" />
                                Confirm & Pay Now
                             </Link>
                           </Button>
                           <CancelBookingButton bookingId={booking.id} />
                        </div>
                    )}
                    {booking.status === "confirmed" && (
                         <div className="w-full flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            {booking.isVirtual && booking.meetingLink ? (
                                <Button asChild size="sm" className="bg-green-600 hover:bg-green-700 text-white flex-grow">
                                    <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer">
                                        <Video className="w-4 h-4 mr-2" />
                                        Join Virtual Performance
                                    </a>
                                </Button>
                            ) : booking.isVirtual ? (
                                <div className="text-sm p-2 bg-background/50 rounded-md flex-grow">Awaiting meeting link from performer...</div>
                            ) : <div className="text-sm p-2 bg-green-50 border border-green-200 text-green-700 rounded-md flex-grow">Your booking is confirmed! The performer will see you on the scheduled date.</div>}
                         </div>
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
          <CardDescription>Review your performance history.</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          {isLoading && (
             <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading past bookings...</p>
            </div>
          )}
          {error && <div className="text-center text-destructive bg-destructive/10 p-4 rounded-md">
                <AlertTriangle className="w-6 h-6 mx-auto mb-2"/>
                <p className="font-semibold">Error Loading Bookings</p>
                <p className="text-sm">{error}</p>
            </div>
          }
           {!isLoading && !error && pastBookings.length === 0 && (
            <div className="text-center py-10">
              <PackageOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No past bookings found.</p>
            </div>
          )}
          {!isLoading && !error && pastBookings.length > 0 && (
            <div className="space-y-4">
              {pastBookings.map(booking => {
                 const tipAmount = booking.tipAmount || 0;
                 const totalPrice = booking.pricePerHour + tipAmount;

                 return (
                 <Card key={booking.id} className={`bg-card/80 ${booking.status === 'cancelled' ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-headline">Booking for: {booking.performerName}</CardTitle>
                     <CardDescription className="text-xs">
                      Status: <span className={`font-semibold capitalize ${getStatusClass(booking.status)}`}>{booking.status ? booking.status.replace(/_/g, ' ') : 'N/A'}</span>
                    </CardDescription>
                     {booking.isVirtual && (
                        <Badge variant="outline" className="w-fit mt-1 bg-background text-xs">
                            <Video className="w-3 h-3 mr-1.5" />
                            Virtual
                        </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p><strong>Date:</strong> {booking.date && typeof booking.date.toDate === 'function' ? format(booking.date.toDate(), "PPP") : 'N/A'} at {booking.time}</p>
                    <p><strong>Location:</strong> {booking.location}</p>
                    {booking.status === 'completed' && (
                        <div className="text-sm bg-secondary/20 p-3 rounded-md mt-2">
                            <div className="flex justify-between"><span>Booking Price:</span> <span>${booking.pricePerHour.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>Tip:</span> <span>${tipAmount.toFixed(2)}</span></div>
                            <div className="flex justify-between font-bold mt-1 pt-1 border-t"><span>Total Paid:</span> <span>${totalPrice.toFixed(2)}</span></div>
                        </div>
                    )}
                     <p className="text-xs text-muted-foreground pt-2">Requested on: {booking.createdAt && typeof booking.createdAt.toDate === 'function' ? format(booking.createdAt.toDate(), "PPP p") : 'N/A'}</p>
                  </CardContent>
                  {booking.status === 'completed' && !booking.customerReviewSubmitted && (
                    <CardFooter className="pt-2 pb-4">
                      <Dialog open={reviewingBookingId === booking.id} onOpenChange={(isOpen) => setReviewingBookingId(isOpen ? booking.id : null)}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                            <Star className="w-4 h-4 mr-2" />
                            Leave a Review
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Leave a review for {booking.performerName}</DialogTitle>
                            <DialogDescription>
                              Your feedback helps other users. You can also leave an optional tip to show your appreciation!
                            </DialogDescription>
                          </DialogHeader>
                          <ReviewAndTipForm
                            performerId={booking.performerId}
                            bookingId={booking.id}
                            onReviewSubmitted={() => {
                              setReviewingBookingId(null);
                              fetchBookings();
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                    </CardFooter>
                  )}
                  {booking.customerReviewSubmitted && (
                     <CardFooter className="pt-2 pb-4">
                        <div className="text-sm text-green-600 font-semibold p-2 bg-green-50 rounded-md border border-green-200 w-full text-center">
                            Thank you for your review!
                        </div>
                     </CardFooter>
                  )}
                </Card>
              )})}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-12 text-center p-6 bg-secondary/30 rounded-lg">
        <h2 className="text-xl font-headline font-semibold mb-2">Real-Time Tracking</h2>
        <p className="text-muted-foreground">
          Once a performer is on their way, you'll be able to track them in real-time. (Feature Coming Soon)
        </p>
      </div>
    </div>
  );
}

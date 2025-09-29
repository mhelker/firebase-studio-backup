"use client";

import { format, parse } from "date-fns";

// Format Firestore date + "HH:mm" to 12-hour AM/PM
function formatBookingTime(date: any, time?: string) {
  if (!date || !time) return "N/A";
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date.toDate());
  d.setHours(h, m);
  return format(d, "h:mm a");
}

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Check, X, Calendar, Clock, History, Loader2, UserX, PackageOpen, DollarSign, Star, AlertTriangle, Video, Link as LinkIcon, Save, StarHalf, PartyPopper } from "lucide-react";
import { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs, doc, updateDoc, where, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import type { Booking, Performer } from "@/types";
import { Badge } from "@/components/ui/badge";
import { EarningsChart } from "@/components/dashboard/earnings-chart";
import { BookingsPieChart } from "@/components/dashboard/bookings-pie-chart";
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
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CustomerReviewForm } from "@/components/customer-review-form";

// A small component to handle updating the meeting link
function MeetingLinkManager({ bookingId, initialLink }: { bookingId: string, initialLink?: string }) {
  const [link, setLink] = useState(initialLink || '');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!link.startsWith('http')) {
        toast({ title: 'Invalid URL', description: 'Please enter a valid URL (e.g., starting with http:// or https://)', variant: 'destructive' });
        return;
    }
    setIsSaving(true);
    try {
        const bookingRef = doc(db, "bookings", bookingId);
        await updateDoc(bookingRef, { meetingLink: link });
        toast({ title: 'Meeting Link Saved!', description: 'The customer can now join the virtual performance.' });
    } catch (error) {
        console.error('Error saving meeting link:', error);
        toast({ title: 'Error', description: 'Could not save the link. Please try again.', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <LinkIcon className="h-4 w-4 text-muted-foreground" />
      <Input 
        type="url" 
        placeholder="Paste meeting link here" 
        value={link}
        onChange={(e) => setLink(e.target.value)}
        className="h-8 flex-grow"
        disabled={isSaving}
      />
      <Button size="sm" onClick={handleSave} disabled={isSaving}>
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      </Button>
    </div>
  );
}


export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [performerProfile, setPerformerProfile] = useState<Performer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [reviewingBookingId, setReviewingBookingId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Fetch bookings
      const bookingsQuery = query(
        collection(db, "bookings"),
        where("performerId", "==", user.uid)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookingsData = bookingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Booking));
      
      // Sort bookings by date client-side to avoid needing a composite index
      bookingsData.sort((a, b) => {
        const dateA = a.createdAt?.toMillis() || 0;
        const dateB = b.createdAt?.toMillis() || 0;
        return dateB - dateA;
      });
      setBookings(bookingsData);

      // Fetch performer profile for analytics
      const performerDocRef = doc(db, "performers", user.uid);
      const performerSnap = await getDoc(performerDocRef);
      if (performerSnap.exists()) {
        setPerformerProfile(performerSnap.data() as Performer);
      }

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load your dashboard. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchDashboardData();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [user, authLoading]);

  const updateBookingStatus = async (bookingId: string, status: Booking['status']) => {
    try {
      const bookingRef = doc(db, "bookings", bookingId);
      const updateData: { status: Booking['status'], completedAt?: any } = { status };

      if (status === 'completed') {
        updateData.completedAt = serverTimestamp();
      }

      await updateDoc(bookingRef, updateData);
      toast({
        title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        description: `The booking has been successfully updated.`,
      });
      fetchDashboardData(); 
    } catch (err) {
      console.error(`Error updating booking to ${status}:`, err);
      toast({
        title: "Error",
        description: "Could not update the booking. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Helper to get a full Date object for sorting, including time
  const getBookingDateTime = (booking: Booking): Date => {
      const d = booking.date?.toDate() || new Date(0);
      if (booking.startTime) {
          const [h, m] = booking.startTime.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) {
              d.setHours(h, m, 0, 0);
          }
      }
      return d;
  }

  const getCategorizedBookings = () => {
    const pending: Booking[] = [];
    const upcoming: Booking[] = [];
    const pendingCompletion: Booking[] = [];
    const past: Booking[] = [];

    bookings.forEach(booking => {
        const status = booking.status || 'pending';

        if (status === 'completed' || status === 'cancelled') {
            past.push(booking);
        } else if (status === 'pending') {
            pending.push(booking);
        } else if (status === 'awaiting_payment') {
            upcoming.push(booking);
        } else if (status === 'confirmed') {
            pendingCompletion.push(booking);
        }
    });

    // Sort pending by event date (earliest event date first)
    pending.sort((a, b) => 
  (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)
);

    // Sort upcoming & pending completion by when they were created (oldest booking request first)
    // Sort upcoming by event start time (earliest first)
upcoming.sort((a, b) =>
  (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)
);

// Sort pending completion by event finish time (earliest first)
pendingCompletion.sort((a, b) =>
  (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)
);

    // Sort past bookings by date (most recent event first)
    past.sort((a, b) => getBookingDateTime(b).getTime() - getBookingDateTime(a).getTime());

    return { pending, upcoming, pendingCompletion, past };
  };

  const { pending, upcoming, pendingCompletion, past } = getCategorizedBookings();
  
  const totalEarnings = past
    .filter(b => b.status === 'completed')
    .reduce((acc, booking) => acc + (booking.performerPayout ?? 0) + (booking.tipAmount ?? 0), 0);
  const averageRating = performerProfile?.rating || 0;
  const totalReviews = performerProfile?.reviewCount || 0;


  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading dashboard...</p>
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
            <p className="text-muted-foreground mb-6">You need to be logged in to view your performer dashboard.</p>
            <Button asChild>
              <Link href="/login">Go to Login Page</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (isLoading && bookings.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Fetching your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-headline font-semibold text-primary">Performer Dashboard</h1>

      {/* Analytics Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">From gigs & tips (after platform fees)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageRating.toFixed(1)} / 5.0</div>
            <p className="text-xs text-muted-foreground">From {totalReviews} reviews</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Gigs</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcoming.length + pendingCompletion.length}</div>
            <p className="text-xs text-muted-foreground">Confirmed & awaiting payment</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pending.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting your response</p>
          </CardContent>
        </Card>
      </div>

      {/* Visualizations */}
      <div className="grid gap-4 md:grid-cols-2">
        <EarningsChart bookings={bookings} />
        <BookingsPieChart bookings={bookings} />
      </div>

      {/* Pending Bookings */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-6 h-6 mr-2 text-accent" /> Pending Requests
          </CardTitle>
          <CardDescription>New booking requests that need your response.</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No pending requests.</p>
          ) : (
            <div className="space-y-4">
              {pending.map(booking => {
                const status = booking.status || 'pending';
                return (
                  <Card key={booking.id} className="bg-card/80 opacity-80">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-headline">
                        Booking for {booking.customerName || 'Customer'}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Status:{' '}
                        <span className="font-semibold capitalize ml-1 text-accent">
                          {status.replace('_', ' ')}
                        </span>
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="text-sm space-y-1">
                      <p>
                        <strong>Date:</strong>{' '}
                        {booking.date ? format(booking.date.toDate(), 'PPP') : 'N/A'}
                      </p>
                      <p>
                        <strong>Time:</strong>{' '}
                        {booking.startTime && booking.finishTime
                          ? `${formatBookingTime(booking.date, booking.startTime)} to ${formatBookingTime(
                              booking.date,
                              booking.finishTime
                            )}`
                          : 'N/A'}
                      </p>
                      <p>
                        <strong>Location:</strong> {booking.location}
                      </p>

                      {booking.isVirtual && (
                        <Badge variant="outline" className="w-fit mt-1 bg-background text-xs">
                          <Video className="w-3 h-3 mr-1.5" />
                          Virtual
                        </Badge>
                      )}

                      <div className="text-sm bg-secondary/20 p-3 rounded-md mt-2">
                        <div className="flex justify-between">
                          <span>Client Pays:</span>{' '}
                          <span>${(booking.pricePerHour ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold mt-1 pt-1 border-t">
                          <span>Your Payout:</span>{' '}
                          <span>${(booking.performerPayout ?? 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="flex gap-4">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm">
                            <Check className="mr-2 h-4 w-4" /> Accept
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Accept this booking?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will confirm your availability and notify the customer that payment is due.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => updateBookingStatus(booking.id, 'awaiting_payment')}>
                              Yes, Accept
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <X className="mr-2 h-4 w-4" /> Decline
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Decline this booking?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently decline this request and notify the customer. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Yes, Decline
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Upcoming Bookings */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-6 h-6 mr-2 text-primary" /> Upcoming Gigs
          </CardTitle>
          <CardDescription>Your accepted performances that are awaiting payment from the customer.</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No gigs are currently awaiting payment.</p>
          ) : (
            <div className="space-y-4">
              {upcoming.map(booking => {
                return (
                  <Card key={booking.id} className="bg-card/80 opacity-80">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-headline">
                        Booking for {booking.customerName || 'Customer'}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Status:{' '}
                        <span className="font-semibold capitalize ml-1 text-accent">
                          Awaiting Payment
                        </span>
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="text-sm space-y-1">
                      <p>
                        <strong>Date:</strong>{' '}
                        {booking.date ? format(booking.date.toDate(), 'PPP') : 'N/A'}
                      </p>
                      <p>
                        <strong>Time:</strong>{' '}
                        {booking.startTime && booking.finishTime
                          ? `${formatBookingTime(booking.date, booking.startTime)} to ${formatBookingTime(
                              booking.date,
                              booking.finishTime
                            )}`
                          : 'N/A'}
                      </p>
                      <p>
                        <strong>Location:</strong> {booking.location}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Completions */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <PartyPopper className="w-6 h-6 mr-2 text-primary" /> Pending Completions
          </CardTitle>
          <CardDescription>These gigs are paid and confirmed! After the performance, mark them as completed.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingCompletion.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No gigs are pending completion.</p>
          ) : (
            <div className="space-y-4">
              {pendingCompletion.map(booking => {
                return (
                  <Card key={booking.id} className="bg-card/80 opacity-80">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-headline">
                        Booking for {booking.customerName || 'Customer'}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Status:{' '}
                        <span className="font-semibold capitalize ml-1 text-green-600">
                          Confirmed
                        </span>
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="text-sm space-y-1">
                      <p>
                        <strong>Date:</strong>{' '}
                        {booking.date ? format(booking.date.toDate(), 'PPP') : 'N/A'}
                      </p>
                      <p>
                        <strong>Time:</strong>{' '}
                        {booking.startTime && booking.finishTime
                          ? `${formatBookingTime(booking.date, booking.startTime)} to ${formatBookingTime(
                              booking.date,
                              booking.finishTime
                            )}`
                          : 'N/A'}
                      </p>
                      <p>
                        <strong>Location:</strong> {booking.location}
                      </p>

                      {booking.isVirtual && (
                        <Badge variant="outline" className="w-fit mt-1 bg-background text-xs">
                          <Video className="w-3 h-3 mr-1.5" />
                          Virtual
                        </Badge>
                      )}

                      <div className="text-sm bg-secondary/20 p-3 rounded-md mt-2">
                        <div className="flex justify-between">
                          <span>Client Pays:</span>{' '}
                          <span>${(booking.pricePerHour ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold mt-1 pt-1 border-t">
                          <span>Your Payout:</span>{' '}
                          <span>${(booking.performerPayout ?? 0).toFixed(2)}</span>
                        </div>
                      </div>

                      {booking.isVirtual && (
                        <div className="pt-2">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Meeting Link
                          </label>
                          <MeetingLinkManager
                            bookingId={booking.id}
                            initialLink={booking.meetingLink}
                          />
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="flex gap-2">
                      <Dialog open={reviewingBookingId === booking.id} onOpenChange={(isOpen) => setReviewingBookingId(isOpen ? booking.id : null)}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-700 border-green-700 hover:bg-green-100/80"
                          >
                            <Check className="mr-2 h-4 w-4" /> Mark as Completed
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Review Customer to Complete Gig</DialogTitle>
                                <DialogDescription>
                                    To finalize this booking, please provide your feedback on the customer.
                                </DialogDescription>
                            </DialogHeader>
                            <CustomerReviewForm
  bookingId={booking.id}
  customerId={booking.customerId}
  performerId={user.uid} // ADD THIS LINE
  onReviewSubmitted={() => {
      setReviewingBookingId(null);
      fetchDashboardData();
  }}
/>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive hover:bg-destructive/10"
                          >
                            <X className="mr-2 h-4 w-4" /> Cancel Gig
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel This Gig?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to cancel? The customer will be notified and refunded. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Nevermind</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Yes, Cancel Gig
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Bookings */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><History className="w-6 h-6 mr-2 text-muted-foreground" /> Booking History</CardTitle>
          <CardDescription>Your past performances and cancelled bookings.</CardDescription>
        </CardHeader>
        <CardContent>
            {past.length === 0 ? (
                <div className="text-center py-10">
                    <PackageOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No past bookings found.</p>
                </div>
            ) : (
                <div className="space-y-4">
                {past.map(booking => {
                    const tipAmount = booking.tipAmount || 0;
                    const totalPayout = (booking.performerPayout || 0) + tipAmount;
                    const status = booking.status || 'completed';

                    return (
                        <Card key={booking.id} className="bg-card/80 opacity-80">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-headline">
  Booking for {booking.customerName || booking.userName || 'Customer'}
</CardTitle>
                                <CardDescription className="text-xs">
                                    Status: 
                                    <span className={`font-semibold capitalize ml-1 ${
                                        status === 'cancelled' ? 'text-destructive' 
                                        : status === 'completed' ? 'text-green-600' 
                                        : 'text-primary'}`
                                    }>
                                        {status.replace('_', ' ')}
                                    </span>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="text-sm space-y-1">
                                <p>
  <strong>Date:</strong>{" "}
  {booking.date ? format(booking.date.toDate(), "PPP") : "N/A"}
</p>
<p>
  <strong>Time:</strong>{" "}
  {booking.startTime && booking.finishTime
    ? `${formatBookingTime(booking.date, booking.startTime)} to ${formatBookingTime(booking.date, booking.finishTime)}`
    : "N/A"}
</p>
                                <p><strong>Location:</strong> {booking.location}</p>
                                {booking.isVirtual && (
                                    <Badge variant="outline" className="w-fit mt-1 bg-background text-xs">
                                        <Video className="w-3 h-3 mr-1.5" />
                                        Virtual
                                    </Badge>
                                )}
                                {status === 'completed' && (
                                    <div className="text-sm bg-secondary/20 p-3 rounded-md mt-2">
                                        <div className="flex justify-between"><span>Base Payout:</span> <span>${(booking.performerPayout || 0).toFixed(2)}</span></div>
                                        <div className="flex justify-between"><span>Tip Received:</span> <span>${tipAmount.toFixed(2)}</span></div>
                                        <div className="flex justify-between font-bold mt-1 pt-1 border-t"><span>Total Payout:</span> <span>${totalPayout.toFixed(2)}</span></div>
                                    </div>
                                )}
                            </CardContent>
                            {status === 'completed' && (
                                <CardFooter>
                                    {booking.performerReviewSubmitted ? (
                                        <div className="text-sm text-green-600 font-semibold p-2 bg-green-50 rounded-md border border-green-200">
                                            You have reviewed this booking.
                                        </div>
                                    ) : (
                                        <Dialog open={reviewingBookingId === booking.id} onOpenChange={(isOpen) => setReviewingBookingId(isOpen ? booking.id : null)}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                    <StarHalf className="w-4 h-4 mr-2" />
                                                    Review Customer
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Review this Customer</DialogTitle>
                                                    <DialogDescription>
                                                        Your feedback helps maintain a respectful community. It will not be visible to the customer until they have also reviewed you, or after 14 days.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <CustomerReviewForm
  bookingId={booking.id}
  customerId={booking.customerId}
  performerId={user.uid} // ADD THIS LINE
  onReviewSubmitted={() => {
      setReviewingBookingId(null);
      fetchDashboardData();
  }}
/>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </CardFooter>
                            )}
                        </Card>
                    );
                })}
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
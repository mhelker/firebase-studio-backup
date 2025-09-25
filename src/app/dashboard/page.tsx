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
import { Check, X, Calendar, Clock, History, Loader2, UserX, PackageOpen, DollarSign, Star, AlertTriangle, Video, Link as LinkIcon, Save, StarHalf } from "lucide-react";
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
import { PLATFORM_COMMISSION_RATE } from "@/lib/constants";
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
        const dateA = a.date?.toMillis() || 0;
        const dateB = b.date?.toMillis() || 0;
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

  const getCategorizedBookings = () => {
  const pending: Booking[] = [];
  const upcoming: Booking[] = [];
  const past: Booking[] = [];
  const now = new Date();

  bookings.forEach(booking => {
    const isPastDate = booking.date ? booking.date.toDate() < now : false;
    const status = booking.status || 'pending';

    // Skip weird 12:00AM bookings
    const isMidnightBooking = booking.startTime === "00:00" && booking.finishTime === "00:00";

    if ((status === 'completed' || status === 'cancelled') && !isMidnightBooking) {
      past.push(booking);
    } else if (isPastDate && status === 'confirmed' && !isMidnightBooking) {
      past.push({ ...booking, status: 'completed' });
    } else if (status === 'pending') {
      pending.push(booking);
    } else {
      upcoming.push(booking);
    }
  });

  // Sort pending & upcoming by date (earliest first)
  pending.sort((a, b) => (a.date?.toMillis() || 0) - (b.date?.toMillis() || 0));
  upcoming.sort((a, b) => (a.date?.toMillis() || 0) - (b.date?.toMillis() || 0));

  // Sort past bookings by start time (latest first)
past.sort((a, b) => {
  const dateA = a.date?.toDate() || new Date();
  const dateB = b.date?.toDate() || new Date();
  const [aHour, aMin] = a.startTime?.split(":").map(Number) ?? [0, 0];
  const [bHour, bMin] = b.startTime?.split(":").map(Number) ?? [0, 0];

  const aTime = new Date(dateA);
  aTime.setHours(aHour, aMin);

  const bTime = new Date(dateB);
  bTime.setHours(bHour, bMin);

  // NOTE: reverse order for latest first
  return bTime.getTime() - aTime.getTime();
});

  return { pending, upcoming, past };
};

  const { pending, upcoming, past } = getCategorizedBookings();
  
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
            <div className="text-2xl font-bold">{upcoming.length}</div>
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
          <CardTitle className="flex items-center"><Clock className="w-6 h-6 mr-2 text-accent" /> Pending Requests</CardTitle>
          <CardDescription>New booking requests that need your response.</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No pending requests.</p>
          ) : (
            <div className="space-y-4">
              {pending.map(booking => (
                <Card key={booking.id} className="bg-secondary/20">
                    <CardHeader>
                        <CardTitle className="text-lg font-headline">
  Request for {booking.date ? format(booking.date.toDate(), "PPP") : 'N/A'}{" "}
  {booking.startTime && booking.finishTime
  ? (() => {
      try {
        // Combine date + startTime
        const [startHour, startMin] = booking.startTime.split(":").map(Number);
        const startDate = new Date(booking.date.toDate());
        startDate.setHours(startHour, startMin);

        // Combine date + finishTime
        const [endHour, endMin] = booking.finishTime.split(":").map(Number);
        const endDate = new Date(booking.date.toDate());
        endDate.setHours(endHour, endMin);

        return `from ${format(startDate, "h:mm a")} to ${format(endDate, "h:mm a")}`;
      } catch {
        return "Invalid time format";
      }
    })()
  : "Time not set"}
</CardTitle>
                        <CardDescription>Location: {booking.location}</CardDescription>
                         {booking.isVirtual && (
                            <Badge variant="outline" className="w-fit mt-1 bg-background">
                                <Video className="w-4 h-4 mr-2" />
                                Virtual Performance
                            </Badge>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {booking.notes && <p className="text-sm"><strong>Client Notes:</strong> {booking.notes}</p>}
                        <div className="text-sm bg-background/50 p-3 rounded-md">
                          <p><strong>Client Pays:</strong> ${(booking.pricePerHour ?? 0).toFixed(2)}</p>
                          <p><strong>Platform Fee ({PLATFORM_COMMISSION_RATE * 100}%):</strong> -${(booking.platformFee ?? 0).toFixed(2)}</p>
                          <p className="font-semibold"><strong>Your Payout:</strong> ${(booking.performerPayout ?? 0).toFixed(2)}</p>
                        </div>
                    </CardContent>
                    <CardFooter className="flex gap-4">
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button size="sm"><Check className="mr-2 h-4 w-4" /> Accept</Button>
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
                              <Button size="sm" variant="outline"><X className="mr-2 h-4 w-4" /> Decline</Button>
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
                                  <AlertDialogAction onClick={() => updateBookingStatus(booking.id, 'cancelled')} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Yes, Decline
                                  </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Upcoming Bookings */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><Calendar className="w-6 h-6 mr-2 text-primary" /> Upcoming Gigs</CardTitle>
          <CardDescription>Your accepted performances.</CardDescription>
        </CardHeader>
        <CardContent>
           {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No upcoming gigs.</p>
          ) : (
             <div className="space-y-4">
              {upcoming.map(booking => (
                <Card key={booking.id}>
                    <CardHeader>
                        <CardTitle className="text-lg font-headline">
  {booking.date ? format(booking.date.toDate(), "PPP") : 'N/A'}{" "}
  {booking.startTime && booking.finishTime
  ? (() => {
      try {
        // Combine date + startTime
        const [startHour, startMin] = booking.startTime.split(":").map(Number);
        const startDate = new Date(booking.date.toDate());
        startDate.setHours(startHour, startMin);

        // Combine date + finishTime
        const [endHour, endMin] = booking.finishTime.split(":").map(Number);
        const endDate = new Date(booking.date.toDate());
        endDate.setHours(endHour, endMin);

        return `from ${format(startDate, "h:mm a")} to ${format(endDate, "h:mm a")}`;
      } catch {
        return "Invalid time format";
      }
    })()
  : "Time not set"}
</CardTitle>

                        <CardDescription>Location: {booking.location}</CardDescription>
                         {booking.isVirtual && (
                            <Badge variant="outline" className="w-fit mt-1 bg-background">
                                <Video className="w-4 h-4 mr-2" />
                                Virtual Performance
                            </Badge>
                        )}
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                       <div className="flex items-center gap-2">
                            <strong>Status:</strong> 
                            {booking.status === 'confirmed' && <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Confirmed</Badge>}
                            {booking.status === 'awaiting_payment' && <Badge variant="secondary" className="bg-accent/80 text-accent-foreground">Awaiting Payment</Badge>}
                       </div>
                       <p><strong>Client Pays:</strong> ${(booking.pricePerHour ?? 0).toFixed(2)}</p>
                       <p className="font-semibold"><strong>Your Payout:</strong> ${(booking.performerPayout ?? 0).toFixed(2)}</p>
                        {booking.isVirtual && booking.status === 'confirmed' && (
                          <div className="pt-2">
                            <label className="text-xs font-semibold text-muted-foreground">Meeting Link</label>
                            <MeetingLinkManager bookingId={booking.id} initialLink={booking.meetingLink} />
                          </div>
                       )}
                    </CardContent>
                    <CardFooter className="flex gap-2">
                      {booking.status === 'confirmed' && (
                        <>
                           <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-green-700 border-green-700 hover:bg-green-100/80">
                                        <Check className="mr-2 h-4 w-4" /> Mark as Completed
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Ready to mark this gig as completed?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will finalize the booking and allow the customer to leave a review.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => updateBookingStatus(booking.id, 'completed')}>
                                            Yes, Mark Completed
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
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
                                        <AlertDialogAction onClick={() => updateBookingStatus(booking.id, 'cancelled')} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Yes, Cancel Gig
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                      )}
                    </CardFooter>
                </Card>
              ))}
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
                                <CardTitle className="text-lg font-headline">Booking for {booking.date ? format(booking.date.toDate(), "PPP") : 'N/A'}{booking.time && ` at ${booking.time}`}</CardTitle>
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
                                                    customerId={booking.userId}
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

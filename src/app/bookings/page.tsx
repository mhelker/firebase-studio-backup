"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  CalendarCheck,
  History,
  Loader2,
  PackageOpen,
  UserX,
  CreditCard,
  Star
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  getDocs,
  where,
  doc,
  updateDoc
} from "firebase/firestore";
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
  DialogTitle
} from "@/components/ui/dialog";
import { ReviewForm as ReviewAndTipForm } from "@/components/review-and-tip-form";
import { useRouter } from "next/navigation";

// Helper: format Firestore date + "HH:mm"
function formatBookingTime(dateObj: any, timeStr?: string) {
  if (!dateObj || !timeStr) return "N/A";
  try {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date(dateObj.toDate());
    d.setHours(h, m);
    return format(d, "h:mm a");
  } catch {
    return "Invalid time";
  }
}

// Helper: get full Date object for sorting
function getBookingDateTime(booking: Booking, timeField: "startTime" | "finishTime"): Date | null {
  if (!booking.date?.toDate) return null;
  const d = new Date(booking.date.toDate());
  const timeStr = booking[timeField];
  if (timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      d.setHours(h, m, 0, 0);
      return d;
    }
  }
  return d;
}

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
      const q = query(collection(db, "bookings"), where("customerId", "==", user.uid));
      const snap = await getDocs(q);
      const userBookings = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Booking)
      );

      // Sort newest created first
      userBookings.sort(
        (a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
      );
      setBookings(userBookings);
    } catch (err: any) {
      console.error("Error fetching bookings:", err);
      if (err.code === "failed-precondition") {
        setError("A Firestore index is required. Check the terminal for link.");
      } else if (err.code === "permission-denied") {
        setError("Permission denied. Check Firestore rules.");
      } else {
        setError("Failed to load bookings. Try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let previousBookingsJSON: string | null = null;
    const interval = setInterval(async () => {
      if (!user) return;
      try {
        const q = query(collection(db, "bookings"), where("customerId", "==", user.uid));
        const snap = await getDocs(q);
        const fetchedBookings = snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));

        // Sort by createdAt descending
        fetchedBookings.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        const currentBookingsJSON = JSON.stringify(fetchedBookings);
        // Only update state if bookings have actually changed
        if (currentBookingsJSON !== previousBookingsJSON) {
          previousBookingsJSON = currentBookingsJSON;
          setBookings(fetchedBookings);
        }
      } catch (err) {
        console.error("Error fetching bookings in interval:", err);
      }
    }, 60 * 1000); // every 60 seconds

    return () => clearInterval(interval);
  }, [user]);


  // 2️⃣ Initial fetch when auth/user loads
  useEffect(() => {
    if (!authLoading && user) fetchBookings();
    else if (!authLoading && !user) setIsLoading(false);
  }, [user, authLoading, fetchBookings]);

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    await updateDoc(doc(db, "bookings", bookingId), {
      status: "cancelled",
      cancelledAt: new Date()
    });
    fetchBookings();
  };

  const handleReviewSubmitted = () => {
    setReviewingBooking(null);
    fetchBookings();
  };

  const canReview = (b: Booking) => b.status === "confirmed" && !b.customerReviewedPerformer;

   const categorizeBookings = () => {
  const pendingRequests: Booking[] = [];
  const upcomingGigs: Booking[] = [];
  const pendingCompletion: Booking[] = [];
  const past: Booking[] = [];
  const now = new Date();

  bookings.forEach((b) => {
    const startTime = getBookingDateTime(b, "startTime");
    const finishTime = getBookingDateTime(b, "finishTime");

    // 1. Cancelled Bookings (Always Past)
    if (b.status === "cancelled") {
      past.push(b);
    }
    // 2. Customer's Past Bookings (Customer has submitted their review)
    //    This is independent of whether the performer has reviewed or if status is 'completed'.
    else if (b.customerReviewSubmitted === true) { // <--- KEY CHANGE FOR INDEPENDENCE
      past.push(b);
    }
    // 3. Pending Requests (Needs Performer Action)
    else if (b.status === "pending" || b.status === "new") {
      pendingRequests.push(b);
    }
    // 4. Pending Completion (Gig has passed, and customer still needs to review/tip)
    //    Conditions:
    //    - Status is 'confirmed' AND finish time has passed AND customer has NOT reviewed
    //    - Status is 'completed' AND customer has NOT reviewed (in case performer completes first)
    else if (
        (finishTime && finishTime <= now && b.customerReviewSubmitted !== true) || // Gig is over, customer hasn't reviewed
        (b.status === "completed" && b.customerReviewSubmitted !== true) // Status is 'completed', customer hasn't reviewed
    ) {
        pendingCompletion.push(b);
    }
    // 5. Upcoming Gigs (Confirmed and still in the future, OR awaiting payment)
    else {
      upcomingGigs.push(b);
    }
  });

  const sortByStartTime = (arr: Booking[]) =>
    arr.sort(
      (a, b) =>
        (getBookingDateTime(a, "startTime")?.getTime() || 0) -
        (getBookingDateTime(b, "startTime")?.getTime() || 0)
    );

  const sortByFinishDesc = (arr: Booking[]) =>
    arr.sort(
      (a, b) =>
        (getBookingDateTime(b, "finishTime")?.getTime() || 0) -
        (getBookingDateTime(a, "finishTime")?.getTime() || 0)
    );

  return {
    pendingRequests: sortByStartTime(pendingRequests),
    upcomingGigs: sortByStartTime(upcomingGigs),
    pendingCompletion: sortByStartTime(pendingCompletion),
    past: sortByFinishDesc(past),
  };
};

// ✅ Destructure AFTER the function
const { pendingRequests, upcomingGigs, pendingCompletion, past } = categorizeBookings();

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
            <CardTitle className="flex items-center justify-center">
              <UserX className="w-8 h-8 mr-2 text-primary" /> Login Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              You need to be logged in to view your bookings.
            </p>
            <Button asChild>
              <Link href="/login">Go to Login Page</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderBookingCard = (b: Booking, allowCancel: boolean, isPendingCompletion = false) => (
    <Card key={b.id} className={allowCancel ? "bg-secondary/30" : "bg-card/80 opacity-80"}>
      <CardHeader>
        <CardTitle className="text-xl font-headline">
          {" "}
          Booking for: {b.performerName}{" "}
        </CardTitle>
        <CardDescription>
          {" "}
          Status:{" "}
          <Badge
            variant={
              b.status === "confirmed" || b.status === "completed" ? "default" : "destructive"
            }
            className="capitalize"
          >
            {" "}
            {b.status ? b.status.replace(/_/g, " ") : "N/A"}{" "}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        <p>
          <strong>Date:</strong> {b.date?.toDate ? format(b.date.toDate(), "PPP") : "N/A"}
        </p>
        <p>
          <strong>Time:</strong> {formatBookingTime(b.date, b.startTime)} -{" "}
          {formatBookingTime(b.date, b.finishTime)}
        </p>
        <p>
          <strong>Location:</strong> {b.location}
        </p>
        <p>
          <strong>Price:</strong> ${b.pricePerHour.toFixed(2)}
        </p>
        {b.tipAmount && b.tipAmount > 0 && (
          <p className="font-semibold">
            <strong>Tip Paid:</strong> ${b.tipAmount.toFixed(2)}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex items-center gap-2">
        {b.status === "awaiting_payment" && (
          <>
            <Button
              onClick={() => router.push(`/bookings/${b.id}/pay`)}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <CreditCard className="w-4 h-4 mr-2" /> Confirm & Pay Now
            </Button>
            <Button variant="destructive" onClick={() => handleCancelBooking(b.id)}>
              {" "}
              Cancel{" "}
            </Button>
          </>
        )}
        {b.status === "pending" && (
          <p className="text-sm text-muted-foreground"> Awaiting response from performer... </p>
        )}
        {b.status === "confirmed" && !isPendingCompletion && (
  b.customerReviewedPerformer ? (
    <div className="text-sm text-green-600 font-semibold p-2 bg-green-50 rounded-md border border-green-200">
      You have reviewed this booking.
    </div>
  ) : (
    <p className="text-sm text-green-600 font-semibold">
      This booking is confirmed! See you there.
    </p>
  )
)}
        {isPendingCompletion && !b.customerReviewedPerformer && b.customerBookingStatus !== "completed" && (
  <Button variant="outline" size="sm" onClick={() => setReviewingBooking(b)}>
    <Star className="w-4 h-4 mr-2" /> Leave a Review & Tip
  </Button>
)}
      </CardFooter>
    </Card>
  );

  const renderSection = (
    title: string,
    bookingsArr: Booking[],
    allowCancel: boolean,
    Icon: any,
    description: string,
    isPendingCompletion = false
  ) => (
    <Card className="mt-8 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Icon className="w-6 h-6 mr-2 text-primary" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="py-6">
        {isLoading && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading...</p>
          </div>
        )}
        {!isLoading && !error && bookingsArr.length === 0 && (
          <div className="text-center py-10">
            <PackageOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No bookings found.</p>
          </div>
        )}
        {!isLoading && !error && bookingsArr.length > 0 && (
          <div className="space-y-4">
            {bookingsArr.map((b) => renderBookingCard(b, allowCancel, isPendingCompletion))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-headline font-semibold mb-8 text-primary"> My Bookings </h1>

      {/* Pending Requests */}
      {renderSection(
        "Pending Requests",
        pendingRequests,
        true,
        CalendarCheck,
        "New booking requests that need your response."
      )}

      {/* Upcoming Gigs */}
      {renderSection(
        "Upcoming Gigs",
        upcomingGigs,
        true,
        CalendarCheck,
        "Your accepted performances that are awaiting payment from the customer."
      )}

      {/* Pending Completions */}
      {renderSection(
        "Pending Completions",
        pendingCompletion,
        false,
        CalendarCheck,
        "These gigs are paid and confirmed! After the performance, mark them as completed.",
        true
      )}

      {/* Past Bookings Preview */}
      <div className="mb-8">
        {past.length > 0 && (
          <>
            {renderSection(
              "Past Bookings",
              past.slice(0, 3),
              false,
              History,
              "Your performance history."
            )}
            {past.length > 3 && (
              <div className="text-right mt-2">
                <Link href="/bookings/past" className="text-sm text-primary underline">
                  {" "}
                  View All Past Bookings{" "}
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Review Dialog */}
      {reviewingBooking && (
        <Dialog open={!!reviewingBooking} onOpenChange={(o) => !o && setReviewingBooking(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {" "}
                Review your experience with {reviewingBooking.performerName}{" "}
              </DialogTitle>
              <DialogDescription>
                {" "}
                Your feedback helps our community. You can also add an optional tip.{" "}
              </DialogDescription>
            </DialogHeader>
            <ReviewAndTipForm
              bookingId={reviewingBooking.id}
              performerId={reviewingBooking.performerId}
              onReviewSubmitted={handleReviewSubmitted}
              performerName={reviewingBooking.performerName}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
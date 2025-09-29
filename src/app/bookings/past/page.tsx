"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { History, Loader2, PackageOpen } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Booking } from "@/types";
import { useAuth } from "@/contexts/auth-context";

// Helper: format Firestore date + "HH:mm" to 12-hour AM/PM
function formatBookingTime(dateObj: any, timeStr?: string) {
  if (!dateObj || !timeStr) return "N/A";
  try {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const d = new Date(dateObj.toDate ? dateObj.toDate() : dateObj); // handle Firestore Timestamp
    d.setHours(hours, minutes, 0, 0);
    return format(d, "h:mm a"); // 12-hour format with AM/PM
  } catch (err) {
    console.error("Error formatting booking time:", err);
    return "Invalid time";
  }
}

export default function PastBookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchBookings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const q = query(collection(db, "bookings"), where("customerId", "==", user.uid));
        const snap = await getDocs(q);
        const allBookings = snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
        setBookings(
          allBookings
            .filter(b => b.status === "completed" || b.status === "cancelled")
            .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
        );
      } catch (err) {
        console.error(err);
        setError("Failed to load bookings.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchBookings();
  }, [user]);

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <p className="text-center text-red-600">Please log in to see your bookings.</p>;
  if (error) return <p className="text-center text-red-600">{error}</p>;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-headline font-semibold mb-8 text-primary">
        Past Bookings
      </h1>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <History className="w-6 h-6 mr-2 text-primary" /> Your Performance History
          </CardTitle>
          <CardDescription>All completed or cancelled bookings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {bookings.length === 0 ? (
            <div className="text-center py-10">
              <PackageOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No past bookings.</p>
            </div>
          ) : (
            bookings.map(b => (
              <div key={b.id} className="border-b pb-4">
                <p className="font-semibold">{b.performerName}</p>
                <p>Date: {b.date?.toDate ? format(b.date.toDate(), "P") : "N/A"}</p>
                <p>
                  <strong>Time:</strong> {formatBookingTime(b.date, b.startTime)} - {formatBookingTime(b.date, b.finishTime)}
                </p>
                <p>Location: {b.location}</p>
                <p>Price: ${b.pricePerHour.toFixed(2)}</p>
                {b.tipAmount ? <p>Tip: ${b.tipAmount.toFixed(2)}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
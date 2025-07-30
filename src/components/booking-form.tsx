
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

import { CalendarIcon, Clock, Loader2 } from "lucide-react";

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";

import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { PLATFORM_COMMISSION_RATE } from "@/lib/constants";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const bookingFormSchema = z.object({
  date: z.date({
    required_error: "A date for the performance is required.",
  }),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Please enter a valid time (HH:MM)."),
  location: z.string().min(5, "Location must be at least 5 characters long."),
  notes: z.string().optional(),
  isVirtual: z.boolean().default(false),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

interface BookingFormProps {
  performerId: string;
  performerName: string;
  pricePerHour: number;
}

export function BookingForm({ performerId, performerName, pricePerHour }: BookingFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      location: "",
      notes: "",
      time: "",
      isVirtual: false,
    },
  });

  const isVirtual = form.watch("isVirtual");

  useEffect(() => {
    if (isVirtual) {
      form.setValue("location", "Virtual Event", { shouldValidate: true });
    } else if (form.getValues("location") === "Virtual Event") {
      form.setValue("location", "", { shouldValidate: true });
    }
  }, [isVirtual, form]);

  async function onSubmit(data: BookingFormValues) {
    if (!user) {
      toast({
        title: "Not Logged In",
        description: "You need to be logged in to make a booking.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if customer exists
      const customerDocRef = doc(db, "customers", user.uid);
      const customerSnap = await getDoc(customerDocRef);

      if (!customerSnap.exists()) {
        await setDoc(customerDocRef, {
          id: user.uid,
          displayName: user.email?.split("@")[0] || "Anonymous",
          imageUrl: "",
          rating: 0,
          reviewCount: 0,
          createdAt: serverTimestamp(),
        });
      }

      const totalPrice = pricePerHour;
      const platformFee = totalPrice * PLATFORM_COMMISSION_RATE;
      const performerPayout = totalPrice - platformFee;

      const bookingData = {
        ...data,
        date: Timestamp.fromDate(data.date),
        performerId,
        performerName,
        pricePerHour: totalPrice,
        platformFee,
        performerPayout,
        status: "pending",
        createdAt: serverTimestamp(),
        userId: user.uid,
        customerName: user.email?.split("@")[0] || "Anonymous",
        customerImageUrl: "",
        customerReviewSubmitted: false,
        performerReviewSubmitted: false,
      };

      await addDoc(collection(db, "bookings"), bookingData);

      toast({
        title: "Booking Request Sent!",
        description: `Your booking is pending confirmation from the performer.`,
        duration: 5000,
      });

      router.push("/bookings");
    } catch (error) {
      console.error("Error submitting booking:", error);
      toast({
        title: "Error",
        description: "There was an error submitting your booking request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="text-center p-6 bg-secondary/20 rounded-lg">
        <p className="text-lg font-semibold text-primary mb-2">Login Required</p>
        <p className="text-muted-foreground">Please log in to book a performer.</p>
        <Button asChild className="mt-4">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="isVirtual"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Make it a virtual performance?</FormLabel>
                <FormDescription>The performer will join via video call.</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                      disabled={isSubmitting}
                    >
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Time (HH:MM)</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type="time" placeholder="e.g., 14:30" {...field} className="pl-10" disabled={isSubmitting} />
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{isVirtual ? "Virtual Platform" : "Location Address"}</FormLabel>
              <FormControl>
                <Input
                  placeholder={isVirtual ? "e.g., Zoom, Google Meet" : "e.g., 123 Main St, Anytown"}
                  {...field}
                  disabled={isSubmitting || isVirtual}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any special requests or details for the performer..."
                  className="resize-none"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="text-sm text-muted-foreground">
          The performer will confirm the final price. The estimated cost for a one-hour performance is: $
          {pricePerHour.toFixed(2)}.
        </div>

        <Button
          type="submit"
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
          disabled={isSubmitting}
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Request Booking"}
        </Button>
      </form>
    </Form>
  );
}

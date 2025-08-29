"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UserX, Edit, Calendar, Briefcase, AlertTriangle, KeyRound, Upload } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, writeBatch, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import type { Performer, Customer } from "@/types";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";


export default function ProfilePage() {
  // --- CHANGE 1: Renamed `imageUrl` from context for clarity ---
  const { user, loading: authLoading, logOut, sendPasswordReset, imageUrl: customerImageUrl } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [performerProfile, setPerformerProfile] = useState<Performer | null>(null);
  const [customerProfile, setCustomerProfile] = useState<Customer | null>(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // --- CHANGE 2: Created two separate refs for the two different file inputs ---
  const customerFileInputRef = useRef<HTMLInputElement>(null);
  const performerFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // This entire useEffect block is your original, correct code. No changes needed here.
    const fetchProfiles = async () => {
      if (!user) {
        setIsFetchingProfile(false);
        return;
      }
      setIsFetchingProfile(true);
      try {
        const performerDocRef = doc(db, "performers", user.uid);
        const customerDocRef = doc(db, "customers", user.uid);

        const [performerSnap, customerSnap] = await Promise.all([
          getDoc(performerDocRef),
          getDoc(customerDocRef)
        ]);

        if (performerSnap.exists()) {
          setPerformerProfile({ id: performerSnap.id, ...performerSnap.data() } as Performer);
        } else {
          setPerformerProfile(null);
        }

        if (customerSnap.exists()) {
          const customerData = { id: customerSnap.id, ...customerSnap.data() } as Customer;
          setCustomerProfile(customerData);
        } else {
          console.error(`CRITICAL: No customer document found for authenticated user ${user.uid}`);
          toast({ title: "Error", description: "Could not find your profile data. The document may be missing.", variant: "destructive" });
          setCustomerProfile(null);
        }

      } catch (error) {
        console.error("Error fetching profiles:", error);
        setPerformerProfile(null);
        setCustomerProfile(null);
        toast({ title: "Error", description: "Could not fetch profile data.", variant: "destructive" });
      } finally {
        setIsFetchingProfile(false);
      }
    };
    
    if (!authLoading && user) {
      fetchProfiles();
    }
     if (!authLoading && !user) {
      setIsFetchingProfile(false);
    }
  }, [user, authLoading, toast]);

  // Your original handleDeleteRequest and handlePasswordReset functions are perfect.
  const handleDeleteRequest = async () => { /* ... (no changes) ... */ };
  const handlePasswordReset = async () => { /* ... (no changes) ... */ };
  
  // --- CHANGE 3: Renamed the original functions to be specific to the CUSTOMER picture ---
  const handleCustomerFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
      handleCustomerImageUpload(file, user.uid);
    }
  };

  const handleCustomerImageUpload = async (file: File, userId: string) => {
    setIsUploading(true);
    try {
      const storagePath = `customer-images/${userId}/profile-picture-${Date.now()}`;
      const storageRef = ref(storage, storagePath);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      // This function now ONLY updates the customer document.
      const customerDocRef = doc(db, "customers", userId);
      await setDoc(customerDocRef, { imageUrl: downloadURL }, { merge: true });

      toast({
        title: "Success!",
        description: "Your new account picture has been uploaded.",
      });

    } catch (error: any) {
      console.error("Error uploading customer image:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "An unknown error occurred during upload.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // --- CHANGE 4: Added NEW, separate functions for the PERFORMER picture ---
  const handlePerformerFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
      handlePerformerImageUpload(file, user.uid);
    }
  };

  const handlePerformerImageUpload = async (file: File, userId: string) => {
    setIsUploading(true);
    try {
      const storagePath = `performer-images/${userId}/profile-picture-${Date.now()}`;
      const storageRef = ref(storage, storagePath);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      // This function ONLY updates the performer document.
      const performerDocRef = doc(db, "performers", userId);
      await updateDoc(performerDocRef, { imageUrl: downloadURL });

      setPerformerProfile(prev => prev ? { ...prev, imageUrl: downloadURL } : null);

      toast({
        title: "Success!",
        description: "Your new performer picture has been uploaded.",
      });

    } catch (error: any) {
      console.error("Error uploading performer image:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };


  // Your original loading and auth checks are perfect.
  if (authLoading || (user && isFetchingProfile)) { /* ... (no changes) ... */ }
  if (!user) { /* ... (no changes) ... */ }
  if (!customerProfile) { /* ... (no changes) ... */ }
  if (customerProfile.isActive === false) { /* ... (no changes) ... */ }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-semibold mb-2">Welcome, {customerProfile.displayName || user.email?.split('@')[0] || 'User'}!</h1>
        <p className="text-muted-foreground mb-8">This is your central hub. Manage your bookings as a customer or your profile as a performer.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <Card className="shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center"><Calendar className="w-6 h-6 mr-2 text-primary" /> Customer Hub</CardTitle>
            <CardDescription>Manage your bookings and account settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-grow">
             <div className="p-4 border rounded-md bg-secondary/20 space-y-4">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 text-2xl">
                        {/* This correctly uses the customerImageUrl from the auth context */}
                        <AvatarImage src={customerImageUrl || ''} alt="Customer avatar" />
                        <AvatarFallback>{customerProfile.displayName?.charAt(0).toUpperCase() || 'C'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-primary">Your Account Email:</p>
                      <p className="text-md text-foreground truncate">{user.email}</p>
                    </div>
                </div>
                 <div>
                    <h4 className="font-semibold text-primary mb-2">Update Account Picture</h4>
                    <input
                        type="file"
                        accept="image/png, image/jpeg, image/gif"
                        ref={customerFileInputRef}
                        onChange={handleCustomerFileSelect}
                        className="hidden"
                    />
                     <Button 
                        variant="outline" 
                        onClick={() => customerFileInputRef.current?.click()}
                        disabled={isUploading || authLoading}
                    >
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                       Upload Picture
                    </Button>
                </div>
                <div>
                    <h4 className="font-semibold text-primary mb-2">Password Settings</h4>
                    <Button 
                        variant="outline" 
                        onClick={handlePasswordReset} 
                        disabled={isSendingReset}
                    >
                       {isSendingReset ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                       Send Password Reset Email
                    </Button>
                </div>
             </div>
             <p className="text-sm text-muted-foreground pt-2">
                As a customer, you can browse and book any talent on the platform. Keep track of all your upcoming and past events here.
             </p>
          </CardContent>
          <CardFooter className="flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <Button asChild className="flex-grow" onClick={() => router.push('/bookings')}>
              <Link href="/bookings">View My Bookings</Link>
            </Button>
            <Button variant="outline" onClick={logOut} className="flex-grow">Logout</Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center"><Briefcase className="w-6 h-6 mr-2 text-primary" /> Performer Hub</CardTitle>
            <CardDescription>
                {performerProfile ? "Manage your public profile and bookings." : "Share your talent and start getting booked."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            {isFetchingProfile ? (
                 <div className="flex justify-center items-center h-full min-h-[150px]"><Loader2 className="w-8 h-8 animate-spin text-primary"/></div>
            ) : performerProfile ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 border rounded-md bg-secondary/20">
                        <Avatar className="h-16 w-16 text-2xl">
                            {/* This now uses the performer's specific image URL */}
                            <AvatarImage src={performerProfile.imageUrl || ''} alt={performerProfile.name || 'Performer avatar'}/>
                            <AvatarFallback>{performerProfile.name?.charAt(0).toUpperCase() || 'P'}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="font-bold text-lg">{performerProfile.name}</h3>
                            <p className="text-sm text-muted-foreground">Your performer profile is live.</p>
                        </div>
                    </div>
                    {/* --- CHANGE 5: Added the new upload section for performers --- */}
                    <div>
                        <h4 className="font-semibold text-primary mb-2">Update Performer Picture</h4>
                         <input
                            type="file"
                            accept="image/png, image/jpeg, image/gif"
                            ref={performerFileInputRef}
                            onChange={handlePerformerFileSelect}
                            className="hidden"
                        />
                        <Button 
                            variant="outline" 
                            onClick={() => performerFileInputRef.current?.click()}
                            disabled={isUploading || authLoading}
                        >
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            Upload Picture
                        </Button>
                    </div>
                     <Button asChild className="w-full" href="/dashboard">
                        <Link href="/dashboard">Go to Dashboard</Link>
                    </Button>
                </div>
            ) : (
                <div className="text-center h-full flex flex-col justify-center items-center bg-accent/10 p-6 rounded-lg min-h-[150px]">
                    <p className="text-muted-foreground mb-4">You don't have a performer profile yet. Create one to get discovered!</p>
                    <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                        <Link href="/profile/create">Become a Performer</Link>
                    </Button>
                </div>
            )}
          </CardContent>
           {performerProfile && (
            <CardFooter className="flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <Button asChild variant="outline" className="flex-grow">
                    <Link href={`/performers/${user.uid}`}>View Public Profile</Link>
                </Button>
                <Button asChild variant="outline" className="flex-grow">
                    <Link href="/profile/edit"><Edit className="mr-2 h-4 w-4" /> Edit Profile</Link>
                </Button>
            </CardFooter>
           )}
        </Card>
      </div>

      <Card className="border-destructive shadow-lg">
        <CardHeader>
            <CardTitle className="text-destructive flex items-center">
                <AlertTriangle className="w-6 h-6 mr-2" />
                Danger Zone
            </CardTitle>
            <CardDescription>
                Actions in this section are permanent and cannot be undone.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <h4 className="font-semibold">Delete Your Account</h4>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
                This will permanently delete your account and all associated data, including performer profiles and booking history.
            </p>
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive">Request Account Deletion</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will sign you out and start the account deletion process. Are you sure you want to proceed?
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleDeleteRequest}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        Yes, Delete My Account
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
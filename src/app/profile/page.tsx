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
  const { user, loading: authLoading, logOut, sendPasswordReset, imageUrl } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [performerProfile, setPerformerProfile] = useState<Performer | null>(null);
  const [customerProfile, setCustomerProfile] = useState<Customer | null>(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
          // This is a critical fallback. If a user exists in Auth but not Firestore,
          // we should log an error.
          console.error(`CRITICAL: No customer document found for authenticated user ${user.uid}`);
          toast({ title: "Error", description: "Could not find your profile data. The document may be missing.", variant: "destructive" });
          setCustomerProfile(null); // Explicitly set to null on failure
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

  const handleDeleteRequest = async () => {
    if (!user) return;
    try {
        const batch = writeBatch(db);
        
        const customerDocRef = doc(db, "customers", user.uid);
        batch.update(customerDocRef, { isActive: false });
        
        if (performerProfile) {
            const performerDocRef = doc(db, "performers", user.uid);
            batch.update(performerDocRef, { isActive: false });
        }
        
        await batch.commit();

        toast({
            title: "Account Deactivated",
            description: "Your account has been marked for deletion and you have been logged out.",
            duration: 8000,
        });

        logOut();
    } catch (error: any) {
        console.error("Error deactivating account:", error);
        toast({
            title: "Error",
            description: "Could not deactivate your account. Please contact support.",
            variant: "destructive",
        });
    }
  }

  const handlePasswordReset = async () => {
    if (!user || !user.email) return;
    setIsSendingReset(true);
    const success = await sendPasswordReset(user.email);
    if (success) {
        toast({
            title: "Password Reset Email Sent",
            description: `A link to reset your password has been sent to ${user.email}.`,
            duration: 8000
        });
    }
    setIsSendingReset(false);
  }
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
      handleImageUpload(file, user.uid);
    }
  };

  const handleImageUpload = async (file: File, userId: string) => {
    setIsUploading(true);
    try {
      const storagePath = `customer-images/${userId}/profile-picture-${Date.now()}`;
      const storageRef = ref(storage, storagePath);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      const batch = writeBatch(db);
      
      const customerDocRef = doc(db, "customers", userId);
      batch.set(customerDocRef, { imageUrl: downloadURL }, { merge: true });

      // We also update the performer doc, if it exists. The batch handles this safely.
      const performerDocRef = doc(db, "performers", userId);
      batch.update(performerDocRef, { imageUrl: downloadURL });

      await batch.commit();

      toast({
        title: "Success!",
        description: "Your new profile picture has been uploaded and synced.",
      });

    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "An unknown error occurred during upload.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };


  if (authLoading || (user && isFetchingProfile)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-3 text-muted-foreground">Loading profile...</p>
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
            <p className="text-muted-foreground mb-6">You need to be logged in to view your profile.</p>
            <Button asChild>
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // This is the most likely cause of the blank page. If customerProfile is null,
  // the page will stop rendering here.
  if (!customerProfile) {
     return (
        <div className="container mx-auto py-8 text-center">
            <Card className="max-w-md mx-auto shadow-lg border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 mr-2" /> Profile Error
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground mb-6">
                        Could not load your profile data. The Firestore document may be missing or there was an error.
                    </p>
                    <Button onClick={logOut} variant="destructive">Logout and Try Again</Button>
                </CardContent>
            </Card>
        </div>
     );
  }

  if (customerProfile.isActive === false) {
    return (
        <div className="container mx-auto py-8 text-center">
            <Card className="max-w-md mx-auto shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 mr-2 text-destructive" /> Account Deactivated
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground mb-6">
                This account has been deactivated. Please contact support to reactivate.
                </p>
                <Button onClick={logOut}>Logout</Button>
            </CardContent>
            </Card>
        </div>
    );
  }

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
                        <AvatarImage src={imageUrl || ''} alt="Customer avatar" />
                        <AvatarFallback>{customerProfile.displayName?.charAt(0).toUpperCase() || 'C'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-primary">Your Account Email:</p>
                      <p className="text-md text-foreground truncate">{user.email}</p>
                    </div>
                </div>
                 <div>
                    <h4 className="font-semibold text-primary mb-2">Update Profile Picture</h4>
                    <input
                        type="file"
                        accept="image/png, image/jpeg, image/gif"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                     <Button 
                        variant="outline" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || authLoading}
                    >
                        {isUploading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="mr-2 h-4 w-4" />
                        )}
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
                       {isSendingReset ? (
                           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       ) : (
                           <KeyRound className="mr-2 h-4 w-4" />
                       )}
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
                 <div className="flex justify-center items-center h-full min-h-[150px]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary"/>
                 </div>
            ) : performerProfile ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 border rounded-md bg-secondary/20">
                        <Avatar className="h-16 w-16 text-2xl">
                            <AvatarImage src={imageUrl || ''} alt={performerProfile.name || 'Performer avatar'}/>
                            <AvatarFallback>{performerProfile.name?.charAt(0).toUpperCase() || 'P'}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="font-bold text-lg">{performerProfile.name}</h3>
                            <p className="text-sm text-muted-foreground">Your performer profile is live.</p>
                        </div>
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
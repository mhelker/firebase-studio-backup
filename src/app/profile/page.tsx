"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UserX, Edit, Calendar, Briefcase, AlertTriangle, KeyRound, Upload } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect, useRef } from "react";
// --- CHANGE 1: Imported `updateDoc` ---
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
          setCustomerProfile({
             id: user.uid,
             displayName: user.email?.split('@')[0] || 'User',
             imageUrl: '',
             rating: 0,
             reviewCount: 0,
             createdAt: new Date().toISOString()
          });
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

  // --- CHANGE 2: Updated the delete function to perform a "soft delete" ---
  const handleDeleteRequest = async () => {
    if (!user) return;
    try {
        const batch = writeBatch(db);
        
        // Mark the customer profile as inactive
        const customerDocRef = doc(db, "customers", user.uid);
        batch.update(customerDocRef, { isActive: false });
        
        // If they have a performer profile, mark that as inactive too
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

        logOut(); // Log the user out after deactivating
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

      const performerDocRef = doc(db, "performers", userId);
      const performerSnap = await getDoc(performerDocRef);
      if (performerSnap.exists()) {
        batch.update(performerDocRef, { imageUrl: downloadURL });
      }

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
    // ... No changes to this section ...
  }

  // --- CHANGE 3: Added a check for deactivated accounts ---
  if (customerProfile && customerProfile.isActive === false) {
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
      {/* ... The rest of your page JSX remains exactly the same ... */}
    </div>
  );
}
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { useState, useEffect } from "react";
import { Loader2, UserCog, UserX, AlertTriangle, Banknote, Sparkles, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { Performer } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { generatePerformerDescriptions } from "@/ai/flows/generate-performer-descriptions";
import { generatePerformerImage } from "@/ai/flows/generate-performer-image";
import { uploadDataUrlToStorage } from "@/services/storage-service";
import Image from "next/image";

const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  talentTypes: z.string().min(3, { message: "Please enter at least one talent type." }),
  description: z.string().min(10, { message: "Description must be at least 10 characters." }),
  longDescription: z.string().optional(),
  pricePerHour: z.coerce.number().min(0, { message: "Price must be a non-negative number." }),
  availability: z.string().min(3, { message: "Please describe your availability." }),
  locationsServed: z.string().optional(),
  imageUrl: z.string().url({ message: "Please enter a valid image URL." }).optional().or(z.literal('')),
  contactEmail: z.string().email({ message: "Please enter a valid email address." }),
  specialties: z.string().optional(),
  youtubeVideoId: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function EditPerformerProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImagePreview, setGeneratedImagePreview] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      talentTypes: "",
      description: "",
      longDescription: "",
      pricePerHour: 100,
      availability: "",
      locationsServed: "",
      imageUrl: "",
      contactEmail: user?.email || "",
      specialties: "",
      youtubeVideoId: "",
      bankAccountNumber: "",
      routingNumber: "",
    },
  });

  useEffect(() => {
    const fetchProfileData = async () => {
      if (user) {
        setIsLoadingProfile(true);
        const docRef = doc(db, "performers", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setProfileExists(true);
          const data = docSnap.data() as Performer;
          form.reset({
            name: data.name || "",
            contactEmail: data.contactEmail || "",
            talentTypes: (data.talentTypes || []).join(", "),
            description: data.description || "",
            longDescription: data.longDescription || "",
            pricePerHour: data.pricePerHour || 0,
            availability: (data.availability || []).join(", "),
            locationsServed: (data.locationsServed || []).join(", "),
            imageUrl: data.imageUrl || "",
            specialties: (data.specialties || []).join(", "),
            youtubeVideoId: data.youtubeVideoId || "",
            bankAccountNumber: data.bankAccountNumber || "",
            routingNumber: data.routingNumber || "",
          });
        } else {
          setProfileExists(false);
        }
        setIsLoadingProfile(false);
      }
    };

    if (!authLoading && user) {
      fetchProfileData();
    } else if (!authLoading && !user) {
        setIsLoadingProfile(false);
    }
  }, [user, authLoading, form]);

  const handleGenerateCopy = async () => {
    const { name, talentTypes } = form.getValues();

    if (!name || !talentTypes) {
      toast({
        title: "Missing Information",
        description: "Please enter a name and at least one talent type to generate descriptions.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingCopy(true);
    try {
      const result = await generatePerformerDescriptions({
        name,
        talentTypes: talentTypes.split(',').map(s => s.trim()).filter(Boolean),
      });
      form.setValue("description", result.shortDescription, { shouldValidate: true });
      form.setValue("longDescription", result.longDescription, { shouldValidate: true });
      toast({
        title: "AI Descriptions Generated!",
        description: "The description fields have been updated.",
      });
    } catch (error) {
      console.error("Error generating descriptions:", error);
      toast({
        title: "Generation Failed",
        description: "Could not generate descriptions with AI. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!user) return;
    const { talentTypes } = form.getValues();
    if (!talentTypes) {
        toast({
            title: "Missing Talent Types",
            description: "Please enter at least one talent type to generate an image.",
            variant: "destructive",
        });
        return;
    }

    setIsGeneratingImage(true);
    setGeneratedImagePreview(null);
    try {
        const dataUri = await generatePerformerImage({
            talentTypes: talentTypes.split(',').map(s => s.trim()).filter(Boolean),
        });
        setGeneratedImagePreview(dataUri); // Show preview
        
        toast({ title: "Image Generated!", description: "Now uploading to secure storage..." });
        const storagePath = `customer-images/${user.uid}/${Date.now()}.png`;
        const downloadURL = await uploadDataUrlToStorage(dataUri, storagePath);
        
        form.setValue("imageUrl", downloadURL, { shouldValidate: true });
        
        // Also update the customer profile
        const customerDocRef = doc(db, "customers", user.uid);
        await setDoc(customerDocRef, { imageUrl: downloadURL }, { merge: true });

        toast({ title: "Image Ready!", description: "Your new AI-generated profile image URL has been saved and synced." });

    } catch (error) {
        console.error("Error generating or uploading image:", error);
        toast({
            title: "Image Generation Failed",
            description: "Could not generate or save the image. Please try again.",
            variant: "destructive",
        });
    } finally {
        setIsGeneratingImage(false);
    }
  };

  async function onSubmit(data: ProfileFormValues) {
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "You must be logged in to update a profile.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      const performerDocRef = doc(db, "performers", user.uid);
      const performerSnap = await getDoc(performerDocRef);
      const existingData = performerSnap.exists() ? performerSnap.data() : {};
      
      const performerData = {
        ...existingData,
        name: data.name,
        talentTypes: data.talentTypes.split(',').map(s => s.trim()).filter(Boolean),
        description: data.description,
        longDescription: data.longDescription || "",
        pricePerHour: data.pricePerHour,
        availability: data.availability.split(',').map(s => s.trim()).filter(Boolean),
        locationsServed: data.locationsServed?.split(',').map(s => s.trim()).filter(Boolean) || [],
        imageUrl: data.imageUrl || "",
        dataAiHint: data.talentTypes.toLowerCase(),
        contactEmail: data.contactEmail,
        specialties: data.specialties?.split(',').map(s => s.trim()).filter(Boolean) || [],
        youtubeVideoId: data.youtubeVideoId || "",
        bankAccountNumber: data.bankAccountNumber || "",
        routingNumber: data.routingNumber || "",
      };
      
      batch.set(performerDocRef, performerData);

      const customerDocRef = doc(db, "customers", user.uid);
      batch.set(customerDocRef, { imageUrl: data.imageUrl || "" }, { merge: true });

      await batch.commit();

      toast({
        title: "Profile Updated!",
        description: "Your performer profile has been successfully updated.",
      });
      
      // Tell the Vercel server to get fresh data in the background
      fetch('/api/revalidate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_REVALIDATE_TOKEN}`
        }
      });

      // --- THIS IS THE FINAL, GUARANTEED FIX ---
      // Force a hard navigation to the profile page to clear the browser cache.
      window.location.href = '/profile';

    } catch (error) {
      console.error("Error updating performer profile:", error);
      toast({
        title: "Error",
        description: "Could not update your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || isLoadingProfile) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="ml-4 text-muted-foreground">Loading Profile Editor...</span>
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
            <p className="text-muted-foreground mb-6">You must be logged in to edit a performer profile.</p>
            <Button asChild>
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!profileExists) {
     return (
      <div className="container mx-auto py-8 text-center">
        <Card className="max-w-md mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-center"><AlertTriangle className="w-8 h-8 mr-2 text-accent" /> No Profile Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">You don't have a performer profile yet. Create one first!</p>
            <Button asChild>
              <Link href="/profile/create">Create a Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-3xl font-headline flex items-center"><UserCog className="w-8 h-8 mr-3 text-primary" /> Edit Your Performer Profile</CardTitle>
              <CardDescription>Update your details below. Your changes will be reflected publicly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Performer Name / Stage Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Mystic Max" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Public Contact Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., contact@mysticmax.com" {...field} />
                    </FormControl>
                    <FormDescription>This email will be visible on your public profile.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="talentTypes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Talent Types</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Magician, Comedian, Mentalist" {...field} />
                    </FormControl>
                    <FormDescription>Enter a comma-separated list of your talents. This is used for AI generation.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="specialties"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specialties (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Children's Parties, Corporate Events, Close-up Magic" {...field} />
                    </FormControl>
                    <FormDescription>Enter a comma-separated list of your specialties.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                        <FormLabel>Short Description (for cards)</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateCopy}
                          disabled={isGeneratingCopy || isSubmitting}
                        >
                          {isGeneratingCopy ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                          ) : (
                            <><Sparkles className="mr-2 h-4 w-4" /> Generate with AI</>
                          )}
                        </Button>
                    </div>
                    <FormControl>
                      <Textarea placeholder="A brief, catchy description of what you do." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="longDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Description (for your profile page)</FormLabel>
                    <FormControl>
                      <Textarea rows={5} placeholder="Tell potential clients more about yourself, your experience, and what makes your performance special." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pricePerHour"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per Hour ($)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="availability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Availability</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Weekends, Weekday Evenings after 6 PM" {...field} />
                    </FormControl>
                     <FormDescription>Enter a comma-separated list of your general availability.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="locationsServed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Locations Served (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Downtown, Westside, North End" {...field} />
                    </FormControl>
                    <FormDescription>A comma-separated list of areas you serve.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Image URL</FormLabel>
                     <div className="flex items-start gap-4">
                        <FormControl className="flex-grow">
                            <Input placeholder="https://your-image-host.com/your-photo.jpg" {...field} />
                        </FormControl>
                         <Button
                          type="button"
                          variant="outline"
                          onClick={handleGenerateImage}
                          disabled={isGeneratingImage || isSubmitting}
                          className="flex-shrink-0"
                        >
                          {isGeneratingImage ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                          ) : (
                            <><ImageIcon className="mr-2 h-4 w-4" /> Generate with AI</>
                          )}
                        </Button>
                    </div>
                    <FormDescription>Provide a link to your photo or generate one with AI using your talent types.</FormDescription>
                    <FormMessage />
                    {generatedImagePreview && (
                        <div className="mt-4">
                            <p className="text-sm font-medium mb-2">AI Generated Image Preview:</p>
                            <Image src={generatedImagePreview} alt="AI generated preview" width={200} height={200} className="rounded-lg border shadow-md" />
                        </div>
                    )}
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="youtubeVideoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>YouTube Video ID (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., G4ESrkp3CFQ" {...field} />
                    </FormControl>
                    <FormDescription>The ID from a YouTube URL (e.g., the 'G4ESrkp3CFQ' part of 'youtube.com/watch?v=G4ESrkp3CFQ').</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

           <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-headline flex items-center"><Banknote className="w-7 h-7 mr-3 text-primary" /> Payout Information</CardTitle>
                <CardDescription>This is where your earnings will be sent. This information is not public.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Prototype Environment</AlertTitle>
                  <AlertDescription>
                    Do not enter real bank account information. This form is for demonstration purposes only.
                  </AlertDescription>
                </Alert>
                <FormField
                  control={form.control}
                  name="routingNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Routing Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bankAccountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Account Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 000123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
          </Card>


          <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-6" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Update Profile"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
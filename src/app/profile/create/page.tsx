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
import { db, storage } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useState, useRef } from "react";
import { Loader2, UserPlus, UserX, AlertTriangle, Banknote, Sparkles, Image as ImageIcon, Upload } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { generatePerformerDescriptions } from "@/ai/flows/generate-performer-descriptions";
import { generatePerformerImage } from "@/ai/flows/generate-performer-image";
import { uploadDataUrlToStorage } from "@/services/storage-service";
import Image from "next/image";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function CreatePerformerProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImagePreview, setGeneratedImagePreview] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    },
  });

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
        setGeneratedImagePreview(dataUri);
        
        toast({ title: "Image Generated!", description: "Now uploading to secure storage..." });
        const storagePath = `performer-images/${user.uid}/${Date.now()}.png`;
        const downloadURL = await uploadDataUrlToStorage(dataUri, storagePath);
        
        form.setValue("imageUrl", downloadURL, { shouldValidate: true });
        toast({ title: "Image Ready!", description: "Your new AI-generated profile image URL has been saved." });
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setGeneratedImagePreview(null);
      setImagePreviewUrl(URL.createObjectURL(file));
      form.setValue("imageUrl", "", { shouldValidate: true });
    }
  };

  async function onSubmit(data: ProfileFormValues) {
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "You must be logged in to create a profile.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedFile && !data.imageUrl) {
        toast({ title: "Image Required", description: "Please upload or generate a profile picture.", variant: "destructive"});
        return;
    }

    setIsSubmitting(true);
    try {
      let finalImageUrl = data.imageUrl || "";
      if (selectedFile) {
        toast({ title: "Uploading Image..." });
        const storagePath = `performer-images/${user.uid}/profile-picture-${Date.now()}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, selectedFile);
        finalImageUrl = await getDownloadURL(storageRef);
      }

      const performerData = {
        name: data.name,
        talentTypes: data.talentTypes.split(',').map(s => s.trim()).filter(Boolean),
        description: data.description,
        longDescription: data.longDescription || "",
        pricePerHour: data.pricePerHour,
        availability: data.availability.split(',').map(s => s.trim()).filter(Boolean),
        locationsServed: data.locationsServed?.split(',').map(s => s.trim()).filter(Boolean) || [],
        imageUrl: finalImageUrl,
        dataAiHint: data.talentTypes.toLowerCase(),
        rating: 0,
        reviewCount: 0,
        contactEmail: data.contactEmail,
        specialties: data.specialties?.split(',').map(s => s.trim()).filter(Boolean) || [],
        youtubeVideoId: data.youtubeVideoId || "",
        isFeatured: false,
        stripeAccountId: null,
        payoutsEnabled: false,
        createdAt: serverTimestamp(),
        isActive: true,
      };
      
      await setDoc(doc(db, "performers", user.uid), performerData);

      toast({
        title: "Profile Created!",
        description: "Your performer profile is now live. Redirecting you to set up your payouts.",
      });
      router.push('/profile/edit');
    } catch (error) {
      console.error("Error creating performer profile:", error);
      toast({
        title: "Error",
        description: "Could not create your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
            <p className="text-muted-foreground mb-6">You must be logged in to create a performer profile.</p>
            <Button asChild>
              <Link href="/login">Go to Login</Link>
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
              <CardTitle className="text-3xl font-headline flex items-center"><UserPlus className="w-8 h-8 mr-3 text-primary" /> Create Your Performer Profile</CardTitle>
              <CardDescription>Fill out the details below to get listed on TalentHop and start getting bookings.</CardDescription>
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
              <FormItem>
                <FormLabel>Profile Image</FormLabel>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Avatar className="h-24 w-24 border text-muted-foreground">
                    <AvatarImage src={imagePreviewUrl || generatedImagePreview || ''} alt="Profile preview" />
                    <AvatarFallback><ImageIcon className="h-10 w-10" /></AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting || isGeneratingImage}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload a Photo
                    </Button>
                    <p className="text-xs text-muted-foreground">or</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage || isSubmitting}
                    >
                      {isGeneratingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Generate with AI
                    </Button>
                  </div>
                </div>
                <FormDescription>
                  Upload a high-quality photo or generate one with AI using your talent types.
                </FormDescription>
                <FormMessage />
              </FormItem>
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
          
          <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-6" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Create My Profile
          </Button>
        </form>
      </Form>
    </div>
  );
}
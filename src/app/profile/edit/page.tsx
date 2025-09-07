"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { useState, useEffect } from "react";
import { Loader2, UserCog, UserX, AlertTriangle, Banknote, Sparkles, Image as ImageIcon, Trash } from "lucide-react";
import Link from "next/link";
import { Performer } from "@/types";
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
  imageUrls: z.array(z.string().url().optional()).optional(),
  contactEmail: z.string().email({ message: "Please enter a valid email address." }),
  specialties: z.string().optional(),
  youtubeVideoIds: z.array(z.string()).optional(),
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
  const [isRedirecting, setIsRedirecting] = useState(false);

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
      imageUrls: [""],
      contactEmail: user?.email || "",
      specialties: "",
      youtubeVideoIds: [""],
    },
  });

  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({
    control: form.control,
    name: "imageUrls",
  });

  const { fields: videoFields, append: appendVideo, remove: removeVideo } = useFieldArray({
    control: form.control,
    name: "youtubeVideoIds",
  });

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;
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
          imageUrls: data.imageUrls?.length ? data.imageUrls : [""],
          specialties: (data.specialties || []).join(", "),
          youtubeVideoIds: data.youtubeVideoIds?.length ? data.youtubeVideoIds : [""],
        });
      } else {
        setProfileExists(false);
      }
      setIsLoadingProfile(false);
    };

    if (!authLoading && user) fetchProfileData();
    else if (!authLoading && !user) setIsLoadingProfile(false);
  }, [user, authLoading, form]);

  const handleGenerateCopy = async () => {
    const { name, talentTypes } = form.getValues();
    if (!name || !talentTypes) {
      toast({ title: "Missing Info", description: "Enter name & talent types", variant: "destructive" });
      return;
    }
    setIsGeneratingCopy(true);
    try {
      const result = await generatePerformerDescriptions({
        name,
        talentTypes: talentTypes.split(',').map(s => s.trim()).filter(Boolean),
      });
      form.setValue("description", result.shortDescription);
      form.setValue("longDescription", result.longDescription);
      toast({ title: "AI Descriptions Generated!" });
    } catch {
      toast({ title: "AI Generation Failed", variant: "destructive" });
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const handleGenerateImage = async (index: number) => {
    if (!user) return;
    const { talentTypes } = form.getValues();
    if (!talentTypes) {
      toast({ title: "Missing Talent Types", variant: "destructive" });
      return;
    }
    setIsGeneratingImage(true);
    try {
      const dataUri = await generatePerformerImage({ talentTypes: talentTypes.split(',').map(s => s.trim()).filter(Boolean) });
      setGeneratedImagePreview(dataUri);
      const storagePath = `performer-images/${user.uid}/${Date.now()}.png`;
      const downloadURL = await uploadDataUrlToStorage(dataUri, storagePath);
      form.setValue(`imageUrls.${index}`, downloadURL);
      toast({ title: "Image Uploaded!" });
    } catch {
      toast({ title: "Image Generation Failed", variant: "destructive" });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleStripeOnboarding = async () => {
    if (!user) return toast({ title: "Login required", variant: "destructive" });
    setIsRedirecting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/stripe-connect', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || "Stripe onboarding failed");
    } catch (err: any) {
      toast({ title: "Stripe Error", description: err.message, variant: "destructive" });
      setIsRedirecting(false);
    }
  };

  async function onSubmit(data: ProfileFormValues) {
    if (!user) return toast({ title: "Login required", variant: "destructive" });
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const performerDocRef = doc(db, "performers", user.uid);
      const performerSnap = await getDoc(performerDocRef);
      const existingData = performerSnap.exists() ? performerSnap.data() : {};
      batch.set(performerDocRef, {
        ...existingData,
        name: data.name,
        talentTypes: data.talentTypes.split(',').map(s => s.trim()).filter(Boolean),
        description: data.description,
        longDescription: data.longDescription || "",
        pricePerHour: data.pricePerHour,
        availability: data.availability.split(',').map(s => s.trim()).filter(Boolean),
        locationsServed: data.locationsServed?.split(',').map(s => s.trim()).filter(Boolean) || [],
        imageUrls: data.imageUrls || [],
        youtubeVideoIds: data.youtubeVideoIds || [],
        dataAiHint: data.talentTypes.toLowerCase(),
        contactEmail: data.contactEmail,
        specialties: data.specialties?.split(',').map(s => s.trim()).filter(Boolean) || [],
      }, { merge: true });
      await batch.commit();
      toast({ title: "Profile Updated!" });
      router.push('/profile');
    } catch {
      toast({ title: "Update Failed", variant: "destructive" });
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
            <Button asChild><Link href="/login">Go to Login</Link></Button>
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
            <Button asChild><Link href="/profile/create">Create a Profile</Link></Button>
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
              {/* Form fields like name, email, talent types, specialties, descriptions, price, availability, locations */}

              {/* Multiple Images */}
              {imageFields.map((field, index) => (
                <FormItem key={field.id}>
                  <FormLabel>Profile Image {index + 1}</FormLabel>
                  <div className="flex gap-2 items-start">
                    <FormControl className="flex-grow">
                      <Input {...form.register(`imageUrls.${index}`)} placeholder="https://..." />
                    </FormControl>
                    <Button type="button" variant="outline" onClick={() => handleGenerateImage(index)} disabled={isGeneratingImage}>AI</Button>
                    {index > 0 && <Button type="button" variant="destructive" onClick={() => removeImage(index)}><Trash /></Button>}
                  </div>
                  {generatedImagePreview && index === imageFields.length - 1 && (
                    <div className="mt-2">
                      <Image src={generatedImagePreview} alt="AI preview" width={200} height={200} className="rounded-lg border" />
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              ))}
              <Button type="button" variant="outline" onClick={() => appendImage("")}>Add Another Image</Button>

              {/* Multiple YouTube Videos */}
              {videoFields.map((field, index) => (
                <FormItem key={field.id}>
                  <FormLabel>YouTube Video {index + 1}</FormLabel>
                  <div className="flex gap-2">
                    <FormControl className="flex-grow">
                      <Input {...form.register(`youtubeVideoIds.${index}`)} placeholder="Video ID" />
                    </FormControl>
                    {index > 0 && <Button type="button" variant="destructive" onClick={() => removeVideo(index)}><Trash /></Button>}
                  </div>
                  <FormMessage />
                </FormItem>
              ))}
              <Button type="button" variant="outline" onClick={() => appendVideo("")}>Add Another Video</Button>
            </CardContent>
          </Card>

          {/* Stripe Payout */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-headline flex items-center"><Banknote className="w-7 h-7 mr-3 text-primary" /> Payout Information</CardTitle>
              <CardDescription>Set up a secure account with Stripe for payouts.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" onClick={handleStripeOnboarding} disabled={isRedirecting} className="w-full">
                {isRedirecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Set Up Stripe Payouts
              </Button>
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
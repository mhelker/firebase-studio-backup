"use client";

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
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
import { Loader2, UserCog, UserX, AlertTriangle, Banknote, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { Performer } from "@/types";
import { generatePerformerDescriptions } from "@/ai/flows/generate-performer-descriptions";
import { generatePerformerImage } from "@/ai/flows/generate-performer-image";
import { uploadDataUrlToStorage } from "@/services/storage-service";
import Image from "next/image";

const profileFormSchema = z.object({
  name: z.string().min(2),
  talentTypes: z.string().min(3),
  description: z.string().min(10),
  longDescription: z.string().optional(),
  pricePerHour: z.coerce.number().min(0),
  availability: z.string().min(3),
  locationsServed: z.string().optional(),
  images: z.array(z.string().url()).optional(),
  contactEmail: z.string().email(),
  specialties: z.string().optional(),
  youtubeVideoId: z.string().optional(),
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
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
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
      images: [],
      contactEmail: user?.email || "",
      specialties: "",
      youtubeVideoId: "",
    },
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
          images: data.images || [],
          specialties: (data.specialties || []).join(", "),
          youtubeVideoId: data.youtubeVideoId || "",
        });
        setGeneratedImages(data.images || []);
      } else {
        setProfileExists(false);
      }
      setIsLoadingProfile(false);
    };

    if (!authLoading) fetchProfileData();
  }, [user, authLoading, form]);

  const handleGenerateImage = async () => {
    if (!user) return;
    const { talentTypes } = form.getValues();
    if (!talentTypes) {
      toast({ title: "Missing Talent Types", description: "Enter talent types to generate an image.", variant: "destructive" });
      return;
    }

    setIsGeneratingImage(true);

    try {
      const dataUri = await generatePerformerImage({ talentTypes: talentTypes.split(',').map(s => s.trim()) });
      const storagePath = `performer-images/${user.uid}/${Date.now()}.png`;
      const downloadURL = await uploadDataUrlToStorage(dataUri, storagePath);

      const updatedImages = [...generatedImages, downloadURL];
      setGeneratedImages(updatedImages);
      form.setValue("images", updatedImages);

      const performerDocRef = doc(db, "performers", user.uid);
      await setDoc(performerDocRef, { images: updatedImages }, { merge: true });

      toast({ title: "Image Added", description: "AI-generated image added to your profile." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to generate image.", variant: "destructive" });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const performerDocRef = doc(db, "performers", user.uid);

      batch.set(performerDocRef, {
        ...data,
        talentTypes: data.talentTypes.split(',').map(s => s.trim()),
        availability: data.availability.split(',').map(s => s.trim()),
        locationsServed: data.locationsServed?.split(',').map(s => s.trim()) || [],
      }, { merge: true });

      await batch.commit();
      toast({ title: "Profile Updated" });
      router.push("/profile");
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

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
      <Card className="max-w-md mx-auto mt-12">
        <CardHeader>
          <CardTitle><UserX /> Login Required</CardTitle>
        </CardHeader>
        <CardContent>
          <p>You must be logged in to edit your profile.</p>
          <Button asChild><Link href="/login">Go to Login</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (!profileExists) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardHeader>
          <CardTitle><AlertTriangle /> No Profile Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Create a performer profile first.</p>
          <Button asChild><Link href="/profile/create">Create Profile</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-3xl flex items-center"><UserCog className="mr-3" /> Edit Your Profile</CardTitle>
              <CardDescription>Update your details below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField name="name" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField name="talentTypes" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Talent Types</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Carousel for images */}
              <Card className="p-4">
                <CardHeader>
                  <CardTitle className="text-lg">Profile Images</CardTitle>
                  <Button onClick={handleGenerateImage} disabled={isGeneratingImage}>
                    {isGeneratingImage ? "Generating..." : "Add AI Image"}
                  </Button>
                </CardHeader>
                <CardContent>
                  <Carousel className="gap-4">
                    {generatedImages.map((img, idx) => (
                      <CarouselItem key={idx}>
                        <Image src={img} alt={`Profile ${idx}`} width={300} height={300} className="rounded-lg border shadow-md" />
                      </CarouselItem>
                    ))}
                  </Carousel>
                </CardContent>
              </Card>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Updating..." : "Update Profile"}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
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
import { db, storage } from "@/lib/firebase"; // --- CHANGE: ENSURED `storage` IS IMPORTED ---
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useState, useRef } from "react"; // --- CHANGE: ENSURED `useRef` IS IMPORTED ---
import { Loader2, UserPlus, UserX, AlertTriangle, Banknote, Sparkles, Image as ImageIcon, Upload } from "lucide-react"; // --- CHANGE: ENSURED `Upload` IS IMPORTED ---
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { generatePerformerDescriptions } from "@/ai/flows/generate-performer-descriptions";
import { generatePerformerImage } from "@/ai/flows/generate-performer-image";
import { uploadDataUrlToStorage } from "@/services/storage-service";
import Image from "next/image";
// --- CHANGE: IMPORTED FUNCTIONS FOR FILE UPLOAD ---
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  talentTypes: z.string().min(3, { message: "Please enter at least one talent type." }),
  description: z.string().min(10, { message: "Description must be at least 10 characters." }),
  longDescription: z.string().optional(),
  pricePerHour: z.coerce.number().min(0, { message: "Price must be a non-negative number." }),
  availability: z.string().min(3, { message: "Please describe your availability." }),
  locationsServed: z.string().optional(),
  // --- CHANGE: `imageUrl` is optional in the schema because we handle it separately ---
  imageUrl: z.string().url({ message: "Please enter a valid image URL." }).optional().or(z.literal('')),
  contactEmail: z.string().email({ message: "Please enter a valid email address." }),
  specialties: z.string().optional(),
  youtubeVideoId: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
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

  // --- CHANGE: ADDED STATE AND REF FOR MANUAL UPLOAD ---
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
      bankAccountNumber: "",
      routingNumber: "",
    },
  });

  const handleGenerateCopy = async () => { /* ... (This function is unchanged from your original) ... */ };

  const handleGenerateImage = async () => { /* ... (This function is unchanged from your original) ... */ };

  // --- CHANGE: ADDED HANDLER FOR MANUAL FILE SELECTION ---
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setGeneratedImagePreview(null); // Clear AI image if a manual one is chosen
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  async function onSubmit(data: ProfileFormValues) {
    if (!user) {
      toast({ title: "Not authenticated", variant: "destructive" });
      return;
    }
    // --- CHANGE: VALIDATION FOR IMAGE ---
    if (!selectedFile && !data.imageUrl) {
        toast({ title: "Image Required", description: "Please upload or generate a profile picture.", variant: "destructive"});
        setIsSubmitting(false);
        return;
    }

    setIsSubmitting(true);
    try {
      let finalImageUrl = data.imageUrl || "";

      // --- CHANGE: UPLOAD LOGIC ---
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
        bankAccountNumber: data.bankAccountNumber || "",
        routingNumber: data.routingNumber || "",
        createdAt: serverTimestamp(),
      };
      
      await setDoc(doc(db, "performers", user.uid), performerData);

      toast({ title: "Profile Created!", description: "Your performer profile is now live." });
      router.push('/profile');
    } catch (error) {
      console.error("Error creating performer profile:", error);
      toast({ title: "Error", description: "Could not create your profile.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading) { /* ... (This section is unchanged) ... */ }
  if (!user) { /* ... (This section is unchanged) ... */ }

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
              {/* ... (All fields from name to locationsServed are unchanged) ... */}
              
              {/* --- CHANGE: REPLACED THE OLD `imageUrl` FIELD --- */}
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
              
              {/* ... (youtubeVideoId field is unchanged) ... */}
            </CardContent>
          </Card>
          
          <Card className="shadow-xl">
            {/* ... (This entire Payout Information Card is unchanged) ... */}
          </Card>

          <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-6" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Create My Profile
          </Button>
        </form>
      </Form>
    </div>
  );
}```
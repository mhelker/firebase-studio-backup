import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function RecommendationsLoading() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-6">
            <Skeleton className="h-20 w-full" /> {/* Textarea */}
            <div className="grid md:grid-cols-3 gap-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-12 w-full" /> {/* Button */}
        </CardContent>
      </Card>
      
      <div className="text-center py-6">
        <Skeleton className="h-12 w-12 rounded-full mx-auto" />
        <Skeleton className="h-4 w-1/3 mt-2 mx-auto" />
      </div>
    </div>
  );
}

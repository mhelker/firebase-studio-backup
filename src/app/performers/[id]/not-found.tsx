import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function PerformerNotFound() {
  return (
    <div className="container mx-auto py-12 text-center">
      <Card className="max-w-lg mx-auto shadow-lg">
        <CardHeader>
          <AlertTriangle className="w-16 h-16 mx-auto text-destructive mb-4" />
          <CardTitle className="text-3xl font-headline text-destructive">404 - Performer Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Sorry, we couldn't find the performer you were looking for. They may no longer be on the platform or the link may be incorrect.
          </p>
          <Button asChild>
            <Link href="/performers">Back to Performers List</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

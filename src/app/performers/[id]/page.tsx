import { PerformerDetailClient } from '@/components/performer-detail-client';

// This page component now only passes the ID to the client component.
// The actual data fetching will happen on the client-side.
export default function PerformerDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-8">
      {/* Pass the performer ID to the client component */}
      <PerformerDetailClient performerId={params.id} />
    </div>
  );
}

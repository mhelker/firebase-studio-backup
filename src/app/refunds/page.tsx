export default function RefundPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <article className="prose prose-neutral lg:prose-lg max-w-none">

          <h1 className="mb-2">Refund Policy</h1>

          <p className="text-sm text-gray-500">
            Effective Date: February 2, 2026
          </p>

          <p className="mt-6">
            This Refund Policy explains how cancellations and refunds
            are handled on the TalentHop platform.
          </p>

          <h2 className="mt-12">1. Booking Cancellations</h2>
          <p>
            Cancellation policies may vary depending on the specific
            agreement between the Customer and Performer.
          </p>
          <p>
            Refund eligibility may depend on the timing of the cancellation
            and whether services have already been performed.
          </p>

          <h2 className="mt-12">2. Completed Services</h2>
          <p>
            Completed services are generally non-refundable unless
            otherwise required by applicable law.
          </p>

          <h2 className="mt-12">3. Payment Disputes</h2>
          <p>
            Payment disputes may be subject to Stripe’s dispute resolution
            process. TalentHop reserves the right to review refund requests
            on a case-by-case basis.
          </p>

          <h2 className="mt-12">4. Platform Fees</h2>
          <p>
            Platform service fees may be non-refundable unless otherwise
            stated at the time of booking.
          </p>

          <h2 className="mt-12">5. Contact</h2>
          <p>
            Email:{" "}
            <a href="mailto:mdhelker23@gmail.com">
              mdhelker23@gmail.com
            </a>
          </p>

        </article>
      </div>
    </div>
  );
}
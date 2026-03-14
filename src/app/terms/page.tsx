export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <article className="prose prose-neutral lg:prose-lg max-w-none">

          <h1 className="mb-2">Terms of Service</h1>

          <p className="text-sm text-gray-500">
            Effective Date: February 2, 2026
          </p>

          <p className="mt-6">
            Welcome to TalentHop LLC (“TalentHop,” “we,” “us,” or “our”).
            By accessing or using our platform, website, or related services
            (the “Service”), you agree to be bound by these Terms of Service.
          </p>

          <h2 className="mt-12">1. Platform Role</h2>
          <p>
            TalentHop is a marketplace that connects independent performers
            (“Performers”) with customers (“Customers”). TalentHop is not a
            party to agreements between Customers and Performers.
          </p>
          <p>
            We do not guarantee the quality, safety, legality, or performance
            of any services offered or booked through the platform. All
            arrangements, communications, and agreements are solely between
            the Customer and the Performer.
          </p>

          <h2 className="mt-12">2. User Accounts</h2>
          <p>
            Users must provide accurate and complete information when creating
            an account.
          </p>

          <p>You are responsible for:</p>
          <ul>
            <li>Maintaining the confidentiality of your login credentials</li>
            <li>All activity under your account</li>
            <li>Ensuring compliance with applicable laws</li>
          </ul>

          <p>
            We reserve the right to suspend or terminate accounts for violations
            of these Terms.
          </p>

          <h2 className="mt-12">3. Payments and Fees</h2>
          <p>
            Payments are processed through Stripe, a third-party payment processor.
            By using the Service, you agree to be bound by Stripe’s terms and policies.
          </p>
          <p>
            TalentHop does not store full credit or debit card information.
            Platform service fees may apply and will be disclosed at the time of booking.
          </p>

          <h2 className="mt-12">4. Cancellations and Refunds</h2>
          <p>
            Refund eligibility depends on booking status and service completion.
            Completed services are generally non-refundable unless otherwise required by law.
          </p>
          <p>
            Payment disputes may be subject to Stripe’s dispute resolution process.
          </p>

          <h2 className="mt-12">5. Independent Contractors</h2>
          <p>
            Performers are independent contractors and are not employees,
            agents, or representatives of TalentHop LLC.
          </p>

          <h2 className="mt-12">6. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, TalentHop LLC shall not
            be liable for indirect, incidental, special, consequential, or
            punitive damages arising from use of the Service.
          </p>
          <p>
            Our total liability shall not exceed the amount paid through
            the platform for the specific transaction at issue.
          </p>

          <h2 className="mt-12">7. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless TalentHop LLC from any
            claims, damages, or liabilities arising from your use of the
            Service or violation of these Terms.
          </p>

          <h2 className="mt-12">8. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the State of Hawaiʻi,
            without regard to conflict of law principles.
          </p>

          <h2 className="mt-12">9. Modifications</h2>
          <p>
            We may update these Terms from time to time. Continued use of
            the Service constitutes acceptance of any revised Terms.
          </p>

          <h2 className="mt-12">10. Contact</h2>
          <p>
            TalentHop LLC<br />
            Honolulu, Hawaiʻi<br />
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
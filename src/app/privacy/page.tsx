export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <article className="prose prose-neutral lg:prose-lg max-w-none">

          <h1 className="mb-2">Privacy Policy</h1>

          <p className="text-sm text-gray-500">
            Effective Date: February 2, 2026
          </p>

          <p className="mt-6">
            TalentHop LLC (“TalentHop,” “we,” “us,” or “our”) respects your
            privacy. This Privacy Policy explains how we collect, use,
            and protect your information when you use our platform.
          </p>

          <h2 className="mt-12">1. Information We Collect</h2>
          <ul>
            <li>Account information (name, email address, profile details)</li>
            <li>Booking and transaction data</li>
            <li>Communications between users on the platform</li>
            <li>Usage analytics and device information</li>
          </ul>

          <p>
            Payment information is processed securely by Stripe. TalentHop
            does not store full credit or debit card numbers.
          </p>

          <h2 className="mt-12">2. How We Use Information</h2>
          <p>We use collected information to:</p>
          <ul>
            <li>Operate and maintain the platform</li>
            <li>Process transactions and bookings</li>
            <li>Prevent fraud and abuse</li>
            <li>Improve user experience and platform features</li>
            <li>Communicate service updates or promotional content</li>
          </ul>

          <h2 className="mt-12">3. Sharing of Information</h2>
          <p>
            We do not sell personal information.
          </p>
          <p>
            We may share information with trusted third-party service
            providers who help operate the platform, including:
          </p>
          <ul>
            <li>Payment processors (e.g., Stripe)</li>
            <li>Cloud hosting providers (e.g., Firebase)</li>
            <li>Analytics services</li>
            <li>Legal authorities when required by law</li>
          </ul>

          <h2 className="mt-12">4. Data Security</h2>
          <p>
            We implement reasonable administrative, technical, and
            organizational safeguards to protect user data. However,
            no method of transmission or storage is completely secure.
          </p>

          <h2 className="mt-12">5. Your Rights</h2>
          <p>
            You may request access, correction, or deletion of your
            personal information by contacting us.
          </p>

          <h2 className="mt-12">6. Contact</h2>
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
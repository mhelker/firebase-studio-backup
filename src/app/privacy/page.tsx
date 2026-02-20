export default function PrivacyPage() {
  return (
    <div className="prose max-w-3xl mx-auto">
      <h1>Privacy Policy</h1>

      <p><strong>Effective Date:</strong> February 2, 2026</p>

      <h2>Information Collected</h2>
      <ul>
        <li>Account information (name, email, etc.)</li>
        <li>Usage analytics (app activity, preferences)</li>
        <li>Payment processing via Stripe (we do not store full card data)</li>
      </ul>

      <h2>How We Use Data</h2>
      <p>
        Data is used to operate and improve the platform, prevent fraud, 
        and communicate service updates or promotions.
      </p>

      <h2>Sharing Information</h2>
      <p>
        We do not sell personal data. Data may be shared with service providers 
        who help operate the platform.
      </p>

      <h2>Contact</h2>
      <p>Email: <a href="mailto:mdhelker23@gmail.com">mdhelker23@gmail.com</a></p>
    </div>
  );
}
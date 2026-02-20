import Link from "next/link";
import { QuestionsSection } from "@/components/questions-section";

export function Footer() {
  return (
    <footer className="bg-card shadow-sm py-8 mt-auto border-t">
      <div className="container mx-auto px-4 grid md:grid-cols-3 gap-8">
        
        {/* Brand */}
        <div>
          <h3 className="text-lg font-semibold text-primary mb-2">TalentHop</h3>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} TalentHop. All rights reserved.
            <br />
            Bringing talent to your doorstep.
          </p>
        </div>

        {/* Questions Section */}
        <div>
          <h3 className="text-lg font-semibold text-primary mb-2">
            Have a Question?
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Ask the community! Post your questions and get answers.
          </p>
          <QuestionsSection />
        </div>

        {/* Legal Links */}
        <div>
          <h3 className="text-lg font-semibold text-primary mb-2">
            Legal
          </h3>

          <ul className="text-sm space-y-2 text-muted-foreground">
            <li>
              <Link href="/terms" className="hover:underline">
                Terms of Service
              </Link>
            </li>

            <li>
              <Link href="/privacy" className="hover:underline">
                Privacy Policy
              </Link>
            </li>

            <li>
              <Link href="/refunds" className="hover:underline">
                Refund Policy
              </Link>
            </li>
          </ul>
        </div>

      </div>
    </footer>
  );
}
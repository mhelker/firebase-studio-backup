import { QuestionsSection } from "@/components/questions-section";

export function Footer() {
  return (
    <footer className="bg-card shadow-sm py-8 mt-auto border-t">
      <div className="container mx-auto px-4 grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold text-primary mb-2">TalentHop</h3>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} TalentHop. All rights reserved.
            <br />
            Bringing talent to your doorstep.
          </p>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-primary mb-2">Have a Question?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Ask the community! Post your questions and get answers.
          </p>
          <QuestionsSection />
        </div>
      </div>
    </footer>
  );
}

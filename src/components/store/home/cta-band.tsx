import { PageContainer } from "@/components/store/common/section-heading";
import { NewsletterForm } from "@/components/store/home/newsletter-form";

/** The Figma newsletter band: "Craving the Spice? Join the Pickle Club!" */
export function CtaBand() {
  return (
    <section aria-labelledby="cta-title" className="bg-banner">
      <PageContainer className="reveal flex flex-col items-center gap-6 py-14 text-center sm:py-20">
        <h2 id="cta-title" className="max-w-2xl font-display text-3xl font-black text-white sm:text-4xl">
          Craving the Spice? Join the Pickle Club!
        </h2>
        <p className="max-w-xl text-white/80">Subscribe to get notified about our fresh weekly batch listings, secret family recipes, and exclusive flash sales.</p>
        <NewsletterForm />
      </PageContainer>
    </section>
  );
}

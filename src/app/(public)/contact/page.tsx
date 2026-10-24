import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/store/common/section-heading";
import { StoreProviders } from "@/components/store/providers";
import { ContactForm } from "@/components/store/forms/contact-form";
import { getPublicBusiness } from "@/server/store/catalog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Questions about an order or our pickles? Get in touch with Sindhu's Pickles.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const b = await getPublicBusiness();
  return (
    <PageContainer className="py-10 sm:py-14">
      <header className="mb-10 max-w-2xl space-y-2">
        <h1 className="font-display text-3xl font-black sm:text-4xl">Get in Touch</h1>
        <p className="text-muted">Questions about an order or our pickles? Send us a message and we&apos;ll reply as soon as we can.</p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <Card className="p-5 sm:p-8">
          <StoreProviders>
            <ContactForm />
          </StoreProviders>
        </Card>
        <Card className="h-fit space-y-5 p-5 sm:p-8">
          <h2 className="font-display text-xl font-bold">{b.name}</h2>
          <ul className="space-y-4 text-sm">
            <li className="flex gap-3"><MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /><address className="not-italic text-muted">{b.address}</address></li>
            <li className="flex gap-3"><Phone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /><a href={`tel:${b.phone.replace(/[^+\d]/g, "")}`} className="text-muted hover:text-accent">{b.phone}</a></li>
            <li className="flex gap-3"><Mail className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /><a href={`mailto:${b.email}`} className="break-all text-muted hover:text-accent">{b.email}</a></li>
          </ul>
        </Card>
      </div>
    </PageContainer>
  );
}

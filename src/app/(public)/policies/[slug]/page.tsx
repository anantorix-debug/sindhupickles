import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { policies } from "@/content/policies";

export const revalidate = 3600;

export function generateStaticParams() {
  return Object.keys(policies).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const doc = policies[slug];
  if (!doc) return {};
  const first = doc.blocks.find((b) => b.kind === "p" && b.text.length > 60)?.text ?? doc.title;
  return { title: doc.title, description: first.slice(0, 155), alternates: { canonical: `/policies/${slug}` } };
}

/** Renders the owner's original policy text as typed blocks (no raw HTML), grouped into lists. */
export default async function PolicyPage({ params }: PageProps<"/policies/[slug]">) {
  const doc = policies[(await params).slug];
  if (!doc) notFound();

  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < doc.blocks.length; i++) {
    const b = doc.blocks[i];
    if (b.kind === "li") {
      const items = [b.text];
      while (doc.blocks[i + 1]?.kind === "li") items.push(doc.blocks[++i].text);
      nodes.push(
        <ul key={i} className="list-disc space-y-1.5 pl-6 text-muted">
          {items.map((t, j) => (
            <li key={j}>{t}</li>
          ))}
        </ul>,
      );
    } else if (b.kind === "h") {
      nodes.push(
        <h2 key={i} className="pt-4 font-display text-xl font-bold">
          {b.text}
        </h2>,
      );
    } else {
      nodes.push(
        <p key={i} className="leading-relaxed text-muted">
          {b.text}
        </p>,
      );
    }
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="font-display text-3xl font-black sm:text-4xl">{doc.title}</h1>
      <div className="mt-8 space-y-4">{nodes}</div>
    </article>
  );
}

/**
 * Static brand imagery exported from the Figma file (`public/assets/images`). Product photos are NOT
 * here — they come from the database (uploaded through Admin → Products).
 */
export const siteImages = {
  hero: "/assets/images/hero.webp",
  brandStory: "/assets/images/brand-story-jars.webp",
  whyUs: "/assets/images/why-us.webp",
} as const;

const categoryArt: { match: RegExp; src: string }[] = [
  { match: /chicken/i, src: "/assets/images/categories/chicken.webp" },
  { match: /mutton/i, src: "/assets/images/categories/mutton.webp" },
  { match: /fish/i, src: "/assets/images/categories/fish.webp" },
  { match: /prawn/i, src: "/assets/images/categories/prawn.webp" },
];

/** Figma category artwork for the well-known categories; others fall back to a product photo. */
export const categoryImage = (slug: string, fallback: string | null) => categoryArt.find((c) => c.match.test(slug))?.src ?? fallback;

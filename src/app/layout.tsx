import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sindhu's Pickles — Authentic Homemade Non-Veg Pickles",
    template: "%s | Sindhu's Pickles",
  },
  description:
    "Authentic homemade non-veg pickles — chicken, mutton, fish and prawn — slow-cooked in cold-pressed gingelly oil with freshly ground spices. No artificial preservatives. Delivered across India.",
  applicationName: "Sindhu's Pickles",
  openGraph: { type: "website", siteName: "Sindhu's Pickles", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
  // Staging safety: NEXT_PUBLIC_NOINDEX=true keeps every page out of search engines.
  ...(process.env.NEXT_PUBLIC_NOINDEX === "true" ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = {
  themeColor: "#12100e",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        {/* Google Tag Manager (the previous site used one). Loads only when NEXT_PUBLIC_GTM_ID is set, after the page is interactive. */}
        {process.env.NEXT_PUBLIC_GTM_ID && (
          <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${process.env.NEXT_PUBLIC_GTM_ID.replace(/[^A-Za-z0-9-]/g, "")}');`}</Script>
        )}
      </body>
    </html>
  );
}

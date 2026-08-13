import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import AtmosphericBackground from "@/components/providers/AtmosphericBackground";
import CtaSpotlight from "@/components/providers/CtaSpotlight";
import "./globals.css";

/* TYPEFACES
   Plus Jakarta Sans for display, Inter for body copy — replacing Space Grotesk, whose quirky
   single-storey 'a' and wide spacing read more "techy" than the clean, premium UI look wanted here.
   Jakarta is geometric and slightly humanist, so large headings feel designed rather than default,
   while Inter is the workhorse UI face that stays legible at 13-15px where Jakarta gets a little
   loose.

   Loaded through next/font instead of the @import that used to sit at the top of globals.css. That
   @import was a render-blocking request to fonts.googleapis.com on every page load, and swapped the
   face in only after it resolved. next/font self-hosts the files at build time, so there is no
   third-party request at all and it generates a metric-matched fallback, which removes the layout
   shift as the real face arrives.

   The CSS variables are suffixed -src because globals.css already owns --font-display/--font-body;
   those tokens now point at these, so every existing font-family rule keeps working untouched. */
/* Weights are limited to the ones the stylesheet actually renders (500/600/700 for display,
   400/500/600 for body). next/font downloads a separate file per weight, so listing an unused
   weight is pure download cost for something that never appears on screen. */
const displayFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-src",
  display: "swap",
});
const bodyFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mohammad Faisal, Video Editor",
  description:
    "Mohammad Faisal: freelance video editor and agency owner. I edit videos that hook viewers fast, boost retention, and drive 10x better sales results.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <AtmosphericBackground />
        <CtaSpotlight />
        {children}
        <div className="edge-accent" aria-hidden="true" />
        {/* Tawk.to live chat, site-wide. afterInteractive: loads once the page is interactive,
            after hydration, same real Property/Widget ID as the account's generated script.
            Default bubble renders bottom-right at a lower stacking context than the fixed nav
            (nav z-index:100) and the Short Form hover z-index:500, so it never gets covered by
            them; it only overlaps empty page corner space. */}
        <Script id="tawkto" strategy="afterInteractive">
          {`
            var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();
            (function () {
              var s1 = document.createElement("script"), s0 = document.getElementsByTagName("script")[0];
              s1.async = true;
              s1.src = 'https://embed.tawk.to/6104f4c0d6e7610a49addd71/1fbtlo540';
              s1.charset = 'UTF-8';
              s1.setAttribute('crossorigin', '*');
              s0.parentNode.insertBefore(s1, s0);
            })();
          `}
        </Script>
      </body>
    </html>
  );
}

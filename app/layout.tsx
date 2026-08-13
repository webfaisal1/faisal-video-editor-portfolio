import type { Metadata, Viewport } from "next";
import Script from "next/script";
import AtmosphericBackground from "@/components/providers/AtmosphericBackground";
import CtaSpotlight from "@/components/providers/CtaSpotlight";
import "./globals.css";

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
    <html lang="en">
      <body>
        <AtmosphericBackground />
        <CtaSpotlight />
        {children}
        <div className="edge-accent" aria-hidden="true" />
        <div className="scroll-progress" aria-hidden="true">
          <div className="scroll-progress-bar" id="scrollProgressBar" />
        </div>
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

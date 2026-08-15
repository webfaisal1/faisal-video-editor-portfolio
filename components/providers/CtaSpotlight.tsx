"use client";

import { useEffect } from "react";

// Site-wide "spotlight" for the Book a Call CTAs: hovering one darkens the whole page except a soft
// circular hole around it, so the eye is pulled straight to it.
//
// Matched by Calendly href rather than by .btn-primary. Every Book a Call entry point (nav, mobile
// menu, About, and the Contact section's card) is an anchor to Calendly, while the contact form's
// "Send Message" submit is also a .btn-primary but is a different action — keying off the class
// caught that button and missed the Contact section's actual Book a Call card entirely.
//
// Why a radial-gradient hole driven by CSS vars rather than the obvious "dim overlay + raise the
// hovered button above it with z-index": several CTAs live inside elements that carry a transform
// (every .reveal now animates transform for its 3D entrance, and .nav is its own fixed layer).
// A transform creates a stacking context, so a child can NEVER paint above an overlay that sits
// outside it, no matter how large its z-index — the button would get dimmed along with everything
// else. Punching a transparent hole in the overlay at the button's viewport position sidesteps
// stacking entirely: whatever is under the hole shows through untouched.
//
// The overlay itself is pointer-events:none and only reacts to hover, so it can never intercept a
// click or interfere with scrolling. Skipped on touch/coarse pointers, where there is no hover.
export default function CtaSpotlight() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const overlay = document.createElement("div");
    overlay.className = "cta-spotlight";
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);

    const CTA = 'a[href*="calendly.com"]';
    let active: HTMLElement | null = null;

    const place = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const s = document.body.style;
      s.setProperty("--spot-x", `${r.left + r.width / 2}px`);
      s.setProperty("--spot-y", `${r.top + r.height / 2}px`);
      // An ELLIPSE matched to the button's own box, not a circle. A circle has to use the box's
      // half-diagonal as its radius to contain a wide button, which on a typical 150x48 CTA meant a
      // ~104px radius — more than twice the button's height, so a wide ring of the page around it
      // stayed lit. Separate x/y radii hug the actual shape, so only the button clears the dim.
      s.setProperty("--spot-rx", `${r.width / 2 + 12}px`);
      s.setProperty("--spot-ry", `${r.height / 2 + 10}px`);
    };

    const clear = () => {
      active = null;
      document.body.classList.remove("cta-focus");
    };

    const onOver = (e: Event) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(CTA);
      if (!el) return;
      active = el;
      place(el);
      document.body.classList.add("cta-focus");
    };

    const onOut = (e: Event) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(CTA);
      if (el && el === active) clear();
    };

    // The hole is positioned in viewport coordinates, so it has to follow the button when the page
    // moves under the cursor.
    const onScroll = () => {
      if (active) place(active);
    };

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.body.classList.remove("cta-focus");
      overlay.remove();
    };
  }, []);

  return null;
}

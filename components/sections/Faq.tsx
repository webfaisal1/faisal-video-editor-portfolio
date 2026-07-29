"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import html from "@/content/faq";

/**
 * FAQ: single-column, centered, divided-row accordion (redesigned to match
 * scalewithcam.com/#reviews's style). The previous sticky side-image swap mechanism (a stacked
 * <img> cross-fade driven by click/hover on each question) has been removed entirely along with
 * its image references; only the expand/collapse accordion behavior remains. How I Work's
 * separate image-swap mechanism is untouched.
 *
 * PREMIUM PASS: individual questions previously had no reveal at all (the section header does,
 * every other section's cards do). Added a GSAP ScrollTrigger stagger, since 7 items exceed the
 * site's fixed .d1-.d5 CSS delay classes, a small per-item JS stagger is cleaner than reusing
 * .d5 for the tail items. Same restrained translateY+fade language as .reveal, eased with
 * power3.out (GSAP's closest built-in match to the site's cubic-bezier(.16,1,.3,1)), fires once.
 */
export default function Faq() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>(".faq-item"));
    const cleanups: Array<() => void> = [];
    items.forEach((item) => {
      const q = item.querySelector<HTMLButtonElement>(".faq-q")!;
      const onClick = () => {
        const isOpen = item.classList.contains("open");
        items.forEach((i) => i.classList.remove("open"));
        if (!isOpen) item.classList.add("open");
      };
      q.addEventListener("click", onClick);
      cleanups.push(() => q.removeEventListener("click", onClick));
    });

    gsap.registerPlugin(ScrollTrigger);
    const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
    let trigger: ScrollTrigger | undefined;
    if (items.length && !reduce) {
      gsap.set(items, { opacity: 0, y: 22 });
      trigger = ScrollTrigger.create({
        trigger: root.querySelector(".faq-list") || items[0],
        start: "top 85%",
        once: true,
        onEnter: () =>
          gsap.to(items, {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            stagger: 0.08,
          }),
      });
    } else {
      gsap.set(items, { opacity: 1, y: 0 });
    }

    return () => {
      cleanups.forEach((fn) => fn());
      trigger?.kill();
    };
  }, []);

  return (
    <div style={{ display: "contents" }} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

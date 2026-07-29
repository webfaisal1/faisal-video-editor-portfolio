"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import html from "@/content/hiw";

/**
 * How I Work: the image column is PINNED in the viewport with GSAP ScrollTrigger while the 4
 * stage cards scroll past one at a time; the pinned image cross-fades to match the active stage;
 * after the 4th card the pin releases and the page continues into Services.
 *
 * Why GSAP pin instead of the previous `position: sticky`: the shared `.sec` wrapper sets
 * `overflow: hidden` (to clip the diagonal accent shapes), which makes `.sec` the sticky scroll
 * container and silently breaks `position: sticky` (a classic sticky killer). A GSAP pin uses
 * `position: fixed`, which is not affected by that ancestor (`.sec` has no transform, so a fixed
 * child escapes its overflow), so the image now actually holds.
 *
 * Pieces:
 *  - PIN: ScrollTrigger `pin` on `.hiw-media-wrap`, from when the grid reaches the top of the
 *    viewport until the grid's bottom, with `pinSpacing:false` (the taller left card column
 *    already supplies the scroll length). Desktop only, via `gsap.matchMedia("(min-width:901px)")`
 *    so it auto-reverts below 900px where the layout stacks (image sits above the cards).
 *  - SWAP: one ScrollTrigger per stage card marks it active while it crosses the viewport centre
 *    and cross-fades the matching stacked <img> (only the active one is opaque). Runs at every
 *    width, so mobile still swaps as each card scrolls in.
 *  - HOVER: hovering a card also swaps the image, independent of scroll position.
 */
export default function HowIWork() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const root = ref.current;
    if (!root) return;

    const media = root.querySelector("#hiwMedia");
    const layers = media
      ? Array.from(media.querySelectorAll<HTMLImageElement>("img"))
      : [];
    let current = -1;
    const setActive = (i: number) => {
      if (i === current || i == null) return;
      current = i;
      layers.forEach((img) =>
        img.classList.toggle("active", +img.dataset.hiwIndex! === i)
      );
    };

    const cards = Array.from(root.querySelectorAll<HTMLElement>(".stage-card"));
    const triggers: ScrollTrigger[] = [];
    const hoverCleanups: Array<() => void> = [];

    // HOVER swap (always on, both breakpoints): hovering a card shows its image immediately,
    // independent of scroll position. RESPONSIVE FIX: also swap on click/tap, since touch
    // devices don't reliably fire mouseenter, this gives mobile/tablet users an explicit
    // tap-to-swap in addition to the scroll-driven swap that already runs on every width.
    cards.forEach((card) => {
      const idx = +card.dataset.hiwIndex!;
      const onEnter = () => setActive(idx);
      card.addEventListener("mouseenter", onEnter);
      card.addEventListener("click", onEnter);
      hoverCleanups.push(() => {
        card.removeEventListener("mouseenter", onEnter);
        card.removeEventListener("click", onEnter);
      });
    });

    const grid = root.querySelector<HTMLElement>(".hiw-grid");
    const mediaWrap = root.querySelector<HTMLElement>(".hiw-media-wrap");
    const mm = gsap.matchMedia();

    if (grid && mediaWrap) {
      // DESKTOP (>=901px): pin the image while the cards scroll, and drive the active stage from
      // the pin's own scroll progress so the swap is perfectly in sync with the pin (progress
      // 0..1 maps to stage 0..3 in equal quarters). gsap.matchMedia auto-reverts below 901px,
      // killing the pin + removing the pin-spacer, so the mobile stacked layout is untouched.
      mm.add("(min-width: 901px)", () => {
        const n = cards.length;
        const pin = ScrollTrigger.create({
          trigger: grid,
          start: "top 110px", // pin once the grid top clears the fixed nav
          end: "bottom bottom", // release when the grid bottom reaches the viewport bottom (after stage 4)
          pin: mediaWrap,
          pinSpacing: false,
          invalidateOnRefresh: true,
          onUpdate: (self) =>
            setActive(Math.min(n - 1, Math.floor(self.progress * n))),
          onRefresh: () => setActive(current < 0 ? 0 : current),
        });
        return () => pin.kill();
      });

      // MOBILE (<=900px): no pin; swap as each card crosses the viewport centre while stacked.
      mm.add("(max-width: 900px)", () => {
        const mobileTriggers = cards.map((card) =>
          ScrollTrigger.create({
            trigger: card,
            start: "top center",
            end: "bottom center",
            onToggle: (self) => {
              if (self.isActive) setActive(+card.dataset.hiwIndex!);
            },
          })
        );
        return () => mobileTriggers.forEach((t) => t.kill());
      });
    }

    // Recompute trigger positions once the layout truly settles. In Next.js the window `load`
    // event has usually ALREADY fired by the time this client effect runs, so a load-only
    // refresh would leave start/end measured before the tall hero-docking section and these
    // images finished affecting layout. Instead: refresh on the next frame, again shortly
    // after, when each stage image finishes loading, on window `load` (if still pending), and
    // on resize. ScrollTrigger.refresh() recomputes every trigger, so extra calls are safe.
    const refresh = () => ScrollTrigger.refresh();
    const raf1 = requestAnimationFrame(refresh);
    const t1 = window.setTimeout(refresh, 300);
    const t2 = window.setTimeout(refresh, 1200);
    layers.forEach((img) => {
      if (!img.complete) img.addEventListener("load", refresh, { once: true });
    });
    if (document.readyState !== "complete") addEventListener("load", refresh);
    addEventListener("resize", refresh);

    return () => {
      triggers.forEach((t) => t.kill());
      hoverCleanups.forEach((fn) => fn());
      mm.revert();
      cancelAnimationFrame(raf1);
      clearTimeout(t1);
      clearTimeout(t2);
      removeEventListener("load", refresh);
      removeEventListener("resize", refresh);
    };
  }, []);

  return (
    <div style={{ display: "contents" }} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

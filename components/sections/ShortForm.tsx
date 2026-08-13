"use client";

import { useEffect, useRef } from "react";
import html from "@/content/short";

/**
 * Short Form fanned card stack (znaac mechanism), re-homed verbatim from the single-file build.
 * Preserves: fan/hover transform math and hovered-card z-index above the nav (Fix 2b). Cards are
 * poster images now (playback moved to YouTube), so the per-card audio ramp that used to live
 * here on hover no longer applies — see the comment above `cleanups` in setupFan. Click still
 * opens the shared popup (window.__openVideoPopup), now with a YouTube id + aspect ratio instead
 * of a local file path. Mobile carousel taps open the same popup.
 */
export default function ShortForm() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // Scope to this component's injected subtree (robust against document-level timing) and, if
    // the fan stage isn't measurable yet, retry on the next frame before giving up.
    let frame = 0;
    let disposed = false;
    let teardown: (() => void) | null = null;

    const init = (): boolean => {
      const stage = root!.querySelector<HTMLElement>("#sfStage");
      if (!stage) return false;
      teardown = setupFan(stage);
      return true;
    };

    if (!init()) {
      const retry = () => {
        if (disposed) return;
        if (!init()) frame = requestAnimationFrame(retry);
      };
      frame = requestAnimationFrame(retry);
    }

    function setupFan(stage: HTMLElement): () => void {
    const outers = Array.from(stage.querySelectorAll<HTMLElement>(".sf-card-outer"));
    const N = outers.length,
      center = (N - 1) / 2;
    const HOVER_Z = 500;
    let activeIndex: number | null = null;

    function apply() {
      outers.forEach((outer) => {
        const n = +outer.dataset.index!;
        const inner = outer.querySelector<HTMLElement>(".sf-card-inner")!;
        const d = (n - center) * 9,
          u = (n - center) * 206,
          h = 26 * Math.abs(n - center);
        outer.style.transform = `translateX(${u}px) rotate(${d}deg)`;
        outer.style.zIndex = String(activeIndex === n ? HOVER_Z : n);
        outer.classList.toggle("is-hover", activeIndex === n);

        let x = 0,
          rot = 0,
          y = h,
          scale = 1,
          filter = "none";
        if (activeIndex === n) {
          rot = -(0.78 * d);
          y = -117;
          scale = 1.12;
        } else if (activeIndex !== null) {
          const e = n - activeIndex,
            t = e < 0 ? -1 : 1,
            r = Math.pow(0.62, Math.abs(e) - 1);
          x = 70 * t * r;
          rot = 2.4 * t * r;
          y = h + 8 * r;
          scale = 0.97;
          filter = "brightness(0.5) saturate(0.7)";
        }
        inner.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
        inner.style.filter = filter;
      });
    }
    apply();

    // The per-card audio ramp that used to live here is gone with the local <video> elements.
    // Cards are poster images now, and a muted-to-0.5 volume fade has no equivalent on a
    // cross-origin YouTube iframe — pre-loading four iframes just to enable a hover preview would
    // also undo the load-time saving this swap was made for. The fan's transform math, hover
    // z-index and click-to-open are all untouched.
    const cleanups: Array<() => void> = [];
    outers.forEach((outer) => {
      const onEnter = () => {
        activeIndex = +outer.dataset.index!;
        apply();
      };
      const onClick = () => {
        const face = outer.querySelector(".sf-card-face");
        window.__openVideoPopup?.(outer.dataset.yt || "", face, outer.dataset.ar);
      };
      outer.addEventListener("mouseenter", onEnter);
      outer.addEventListener("click", onClick);
      cleanups.push(() => {
        outer.removeEventListener("mouseenter", onEnter);
        outer.removeEventListener("click", onClick);
      });
    });
    const onStageLeave = () => {
      activeIndex = null;
      apply();
    };
    stage.addEventListener("mouseleave", onStageLeave);

    const mobileCards = Array.from(root!.querySelectorAll<HTMLElement>(".sf-m-card"));
    mobileCards.forEach((card) => {
      const onClick = () => {
        if (card.dataset.yt) window.__openVideoPopup?.(card.dataset.yt, card, card.dataset.ar);
      };
      card.addEventListener("click", onClick);
      cleanups.push(() => card.removeEventListener("click", onClick));
    });

      return () => {
        stage.removeEventListener("mouseleave", onStageLeave);
        cleanups.forEach((fn) => fn());
      };
    } // end setupFan

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      teardown?.();
    };
  }, []);

  return (
    <div style={{ display: "contents" }} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

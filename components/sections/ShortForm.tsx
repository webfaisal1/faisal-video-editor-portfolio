"use client";

import { useEffect, useRef } from "react";
import html from "@/content/short";

/**
 * Short Form fanned card stack (znaac mechanism), re-homed verbatim from the single-file build.
 * Preserves: fan/hover transform math, per-card unmuted audio ramp with a muted fallback for the
 * first-hover-before-gesture case (Fix 2c), hovered-card z-index above the nav (Fix 2b), and
 * click -> shared popup (window.__openVideoPopup, unmuted). Mobile carousel taps open the popup.
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

    function makeAudio(video: HTMLVideoElement) {
      let raf: number | null = null;
      const cancel = () => {
        if (raf !== null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
      };
      const rampFrom = (vol0: number) => {
        const t0 = performance.now();
        const stepFn = (now: number) => {
          if (video.muted) {
            raf = null;
            return;
          }
          const r = Math.max(0, Math.min(1, (now - t0) / 500));
          video.volume = vol0 + (0.5 - vol0) * r;
          raf = r < 1 ? requestAnimationFrame(stepFn) : null;
        };
        raf = requestAnimationFrame(stepFn);
      };
      const play = () => {
        cancel();
        video.muted = false;
        video.volume = 0;
        const p = video.play();
        if (p && p.catch) {
          p.catch(() => {
            video.muted = true;
            video.volume = 1;
            const p2 = video.play();
            if (p2 && p2.catch) p2.catch(() => {});
          });
        }
        rampFrom(0);
      };
      const stop = () => {
        cancel();
        video.pause();
        video.muted = true;
        video.volume = 1;
        try {
          video.currentTime = 0.01;
        } catch {}
      };
      return { play, stop };
    }

    const cleanups: Array<() => void> = [];
    outers.forEach((outer) => {
      const video = outer.querySelector<HTMLVideoElement>("video")!;
      const audio = makeAudio(video);
      const onEnter = () => {
        activeIndex = +outer.dataset.index!;
        apply();
        audio.play();
      };
      const onLeave = () => audio.stop();
      const onClick = () => {
        audio.stop();
        const src =
          outer.querySelector("source")?.getAttribute("src") || video.currentSrc;
        const face = outer.querySelector(".sf-card-face");
        window.__openVideoPopup?.(src, face, true);
      };
      outer.addEventListener("mouseenter", onEnter);
      outer.addEventListener("mouseleave", onLeave);
      outer.addEventListener("click", onClick);
      cleanups.push(() => {
        outer.removeEventListener("mouseenter", onEnter);
        outer.removeEventListener("mouseleave", onLeave);
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
        const src = card.querySelector("source")?.getAttribute("src");
        if (src) window.__openVideoPopup?.(src, card, true);
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

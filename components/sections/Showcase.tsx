"use client";

import { useEffect, useRef } from "react";
import html from "@/content/showcase";

/**
 * Hero + After Effects editor mockup (the single video that "docks" into the editor).
 * The scroll-driven docking transform + nav reveal are handled centrally in SmoothScroll
 * (it owns Lenis/ScrollTrigger). This component owns the editor's own imperative touches:
 * the seeded audio waveforms, the animated playhead/timecodes, and the play/pause button.
 * Logic re-homed verbatim from the original single-file build.
 */
export default function Showcase() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ed = document.getElementById("editorSec");
    if (!ed) return;
    const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

    function fillWave(
      el: Element | null,
      count: number,
      seed: number,
      base: number,
      range: number
    ) {
      if (!el) return;
      let s = seed,
        out = "";
      const rnd = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
      for (let i = 0; i < count; i++) {
        const env = 0.55 + 0.45 * Math.abs(Math.sin(i * 0.35));
        const h = Math.max(8, Math.min(96, (base + rnd() * range) * env));
        out += '<i style="height:' + h.toFixed(1) + '%"></i>';
      }
      el.innerHTML = out;
    }
    fillWave(ed.querySelector(".wave"), 96, 7, 30, 70);
    fillWave(ed.querySelector(".wave2"), 80, 23, 18, 52);

    const ph = ed.querySelector<HTMLElement>(".e-playhead");
    const tl = ed.querySelector<HTMLElement>(".e-timeline");
    const rulerEl = ed.querySelector<HTMLElement>(".ae-ruler");
    const topTc = ed.querySelector<HTMLElement>("#eTopTc");
    const scrubTc = ed.querySelector<HTMLElement>("#eScrubTc");
    const DUR = 30,
      FPS = 24;
    const p2 = (n: number) => String(n).padStart(2, "0");
    const fmt = (t: number) => {
      const f = Math.floor((t * FPS) % FPS),
        s = Math.floor(t % 60),
        m = Math.floor(t / 60) % 60,
        h = Math.floor(t / 3600);
      return p2(h) + ":" + p2(m) + ":" + p2(s) + ":" + p2(f);
    };
    let start: number | null = null;
    let raf = 0;
    function frame(ts: number) {
      if (start == null) start = ts;
      const el = ((ts - start) / 1000) % DUR,
        prog = el / DUR;
      const GUT = rulerEl ? rulerEl.offsetLeft : 300;
      if (ph && tl) ph.style.left = GUT + prog * (tl.clientWidth - GUT) + "px";
      if (topTc) topTc.textContent = fmt(el);
      if (scrubTc) scrubTc.textContent = fmt(el);
      raf = requestAnimationFrame(frame);
    }
    if (reduce) {
      if (topTc) topTc.textContent = "00:00:00:00";
      if (ph && tl) ph.style.left = (rulerEl ? rulerEl.offsetLeft : 300) + "px";
    } else {
      raf = requestAnimationFrame(frame);
    }

    const vid = document.querySelector<HTMLVideoElement>(".dock-video video");
    const playBtn = ed.querySelector<HTMLButtonElement>(".e-ctrls .play");
    const onPlay = () => {
      if (vid) vid.paused ? vid.play() : vid.pause();
    };
    if (vid && playBtn) playBtn.addEventListener("click", onPlay);

    /* ---- clean truncation for the side panels ----
       The editor is a fixed-height flex column, so on short viewports the Project and Layer
       Transform panels get less room than their content needs and the last rows render as
       half-cut slivers. Measured at 1366x640: the Project list overflowed by 45px (Precomps 77%
       visible, Lower3rd.png fully hidden) and the properties panel by 123px (Create Null 48%
       visible, the other three Layer Tools buttons entirely out of view).
       Rather than shrink the video to make room, drop whole rows that cannot render in full, so
       each list simply ends on a complete row. All bounds are read BEFORE anything is hidden —
       hiding a row shifts the ones below it, so measuring as we go would let already-doomed rows
       creep back into view and flicker. */
    function trimPanel(container: Element | null, itemSel: string) {
      if (!container) return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(itemSel));
      items.forEach((el) => el.style.removeProperty("display"));
      const cb = container.getBoundingClientRect();
      const overflowing = items.filter((el) => el.getBoundingClientRect().bottom > cb.bottom + 0.5);
      overflowing.forEach((el) => (el.style.display = "none"));
      // A group heading whose rows all just disappeared would otherwise sit there labelling
      // nothing, which looks more broken than the truncation did.
      Array.from(container.querySelectorAll<HTMLElement>(".ae-prop-grp")).forEach((grp) => {
        let n = grp.nextElementSibling as HTMLElement | null;
        let hasVisibleContent = false;
        while (n && !n.classList.contains("ae-prop-grp")) {
          // offsetHeight, not the display flag: the Layer Tools rows live inside an .ae-ltools
          // wrapper, so hiding every button leaves that wrapper still "displayed" but collapsed to
          // zero height — checking display alone kept the heading above an empty group.
          if (n.offsetHeight > 0) hasVisibleContent = true;
          n = n.nextElementSibling as HTMLElement | null;
        }
        grp.style.display = hasVisibleContent ? "" : "none";
      });
    }
    function trimPanels() {
      trimPanel(ed!.querySelector(".ae-assets"), ".ae-asset");
      trimPanel(ed!.querySelector(".ae-props"), ".ae-prop, .ae-align, .ae-ltools button");
    }

    // Same settling caveat as the dock geometry: panel heights are not final on the first frame
    // (svh, webfonts, flex resolution), so trim across a few frames and once fonts land.
    let trimFrames = 0;
    let trimRaf = 0;
    const settleTrim = () => {
      trimPanels();
      if (++trimFrames < 6) trimRaf = requestAnimationFrame(settleTrim);
    };
    trimRaf = requestAnimationFrame(settleTrim);
    if (document.fonts?.ready) document.fonts.ready.then(trimPanels).catch(() => {});
    // On resize the panels may regain height, so re-run from scratch (trimPanel resets first).
    const onTrimResize = () => trimPanels();
    addEventListener("resize", onTrimResize);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(trimRaf);
      removeEventListener("resize", onTrimResize);
      if (vid && playBtn) playBtn.removeEventListener("click", onPlay);
    };
  }, []);

  return (
    <div style={{ display: "contents" }} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import html from "@/content/popup";

/**
 * Shared FLIP-style video popup (one instance, reused by Long Form tiles and Short Form cards).
 * Renders the overlay markup and re-homes the original single-file popup IIFE:
 *  - wires each .lf-tile (cursor-following play icon + click-to-open)
 *  - exposes window.__openVideoPopup so Short Form can open the same modal
 *
 * PLAYBACK IS NOW A YOUTUBE IFRAME, not a local <video>. What that changes:
 *  - openSource takes a YouTube video id plus an aspect ratio, instead of a file path. Aspect can
 *    no longer be read back from the media (a cross-origin iframe exposes no intrinsic size), so
 *    each card declares its own via data-ar — 16/9 for long form, 9/16 for short form.
 *  - The muted/unmuted autoplay fallback is gone. It existed because browsers block unmuted
 *    autoplay without a gesture; here the iframe is only ever created by a click, which IS the
 *    gesture, so YouTube starts with sound on its own.
 *  - Closing clears the iframe's src. That is what actually stops playback and tears down the
 *    player — merely hiding the overlay would leave audio running underneath.
 */

// Privacy-enhanced host: no YouTube cookie is set unless the video actually plays.
const YT_HOST = "https://www.youtube-nocookie.com/embed/";
// NOTE ON modestbranding: it is NOT in this list because it does nothing. YouTube deprecated the
// parameter — it is accepted and ignored, and there is no replacement. The title, channel avatar,
// uploader name and YouTube wordmark cannot be removed from a standard embed by any parameter, and
// they live in a cross-origin document so CSS cannot reach them either. They are suppressed
// structurally instead: controls=0 removes the bottom bar outright, and .lf-shield stops the
// hover/pause events that would paint the rest (see content/popup.ts).
//   controls=0        no progress bar, no buttons, no wordmark row
//   enablejsapi=1     lets the shield drive play/pause over postMessage, so losing YouTube's own
//                     controls costs the viewer nothing
//   disablekb=1       no keyboard shortcuts leaking to the player (Escape stays ours)
//   fs=0              no fullscreen affordance, which would re-expose YouTube chrome
//   rel=0             end-cards stay on the same channel
//   iv_load_policy=3  no annotation cards
//   playsinline=1     iOS plays in place instead of hijacking to native fullscreen
// autoplay=1 is safe because the iframe only ever exists as the result of a real click.
const YT_PARAMS =
  "autoplay=1&controls=0&enablejsapi=1&disablekb=1&fs=0&rel=0&iv_load_policy=3&playsinline=1";

export default function VideoPopup() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tiles = Array.from(document.querySelectorAll<HTMLElement>(".lf-tile"));

    const overlay = document.getElementById("lfOverlay")!;
    const backdrop = document.getElementById("lfBackdrop")!;
    const modal = document.getElementById("lfModal") as HTMLElement;
    const frameEl = document.getElementById("lfFrame") as HTMLIFrameElement;
    const coverEl = document.getElementById("lfCover") as HTMLElement | null;
    const shieldEl = document.getElementById("lfShield") as HTMLElement | null;
    const closeBtn = document.getElementById("lfClose")!;
    if (!overlay || !modal || !frameEl) return;
    const hasGsap = true;
    const canHover = matchMedia("(hover:hover)").matches;

    let activeTile: HTMLElement | null = null;
    let isOpen = false;
    // Declared by the opening card; a cross-origin iframe cannot report its own intrinsic size.
    let activeAspect = 16 / 9;
    let isPlaying = true;
    let coverTimer: number | null = null;

    /**
     * Drives the player without loading YouTube's IFrame API script. With enablejsapi=1 the embed
     * listens for these postMessage commands directly, which is all that is needed here — pulling
     * in their ~80KB library to call two functions would be a poor trade, and it also injects its
     * own globals.
     */
    function ytCommand(func: "playVideo" | "pauseVideo") {
      frameEl.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args: [] }),
        "*"
      );
    }

    function targetRect() {
      const vw = innerWidth,
        vh = innerHeight;
      const maxW = vw * 0.86,
        maxH = vh * 0.82;
      const ar = activeAspect;
      let w = maxW,
        h = w / ar;
      if (h > maxH) {
        h = maxH;
        w = h * ar;
      }
      return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
    }
    function applyRect(r: { left: number; top: number; width: number; height: number }, animate: boolean) {
      if (hasGsap && animate)
        gsap.to(modal, { left: r.left, top: r.top, width: r.width, height: r.height, duration: 0.55, ease: "power3.out" });
      else {
        modal.style.left = r.left + "px";
        modal.style.top = r.top + "px";
        modal.style.width = r.width + "px";
        modal.style.height = r.height + "px";
      }
    }

    /** Accepts "16/9" | "9/16" | a number; falls back to 16:9 on anything unparseable. */
    function parseAspect(raw: string | undefined | null): number {
      if (!raw) return 16 / 9;
      const m = raw.split("/");
      if (m.length === 2) {
        const w = parseFloat(m[0]),
          h = parseFloat(m[1]);
        if (w > 0 && h > 0) return w / h;
      }
      const n = parseFloat(raw);
      return n > 0 ? n : 16 / 9;
    }

    function openSource(ytId: string, originEl: Element | null, aspect?: string | number) {
      if (isOpen || !ytId) return;
      isOpen = true;
      activeTile = originEl as HTMLElement | null;
      if (originEl) originEl.classList.add("is-active");
      activeAspect = typeof aspect === "number" ? aspect : parseAspect(aspect);
      isPlaying = true;

      // Hold the originating card's own poster over the player while it boots. YouTube paints its
      // title for roughly a second before auto-hiding it, and that one is not hover-triggered so
      // the shield cannot prevent it — covering it is the only way. Reusing the card's poster
      // (rather than a black fill) also means the modal opens on the exact frame the card showed.
      if (coverEl) {
        const poster = originEl?.querySelector("img")?.getAttribute("src");
        coverEl.style.backgroundImage = poster ? `url("${poster}")` : "none";
        coverEl.classList.remove("is-hidden");
        if (coverTimer !== null) clearTimeout(coverTimer);
        coverTimer = window.setTimeout(() => {
          coverEl.classList.add("is-hidden");
          coverTimer = null;
        }, 1400);
      }

      const rect = originEl ? originEl.getBoundingClientRect() : targetRect();
      modal.style.left = rect.left + "px";
      modal.style.top = rect.top + "px";
      modal.style.width = rect.width + "px";
      modal.style.height = rect.height + "px";
      overlay.classList.add("open");

      frameEl.src = YT_HOST + encodeURIComponent(ytId) + "?" + YT_PARAMS;

      applyRect(targetRect(), true);

      document.documentElement.classList.add("lf-lock");
      window.__lenis?.stop();
    }
    window.__openVideoPopup = openSource;

    function closeOverlay() {
      if (!isOpen) return;
      isOpen = false;
      // Silence immediately rather than waiting out the 450ms close tween — the src is not cleared
      // until finishClose, so without this the audio keeps playing over the closing animation.
      ytCommand("pauseVideo");
      if (coverTimer !== null) {
        clearTimeout(coverTimer);
        coverTimer = null;
      }
      const tile = activeTile;
      const rect = tile ? tile.getBoundingClientRect() : targetRect();
      overlay.classList.remove("open");
      gsap.to(modal, {
        left: rect.left,
        top: rect.top,
        width: (rect as DOMRect).width,
        height: (rect as DOMRect).height,
        duration: 0.45,
        ease: "power3.inOut",
        onComplete: finishClose,
      });
    }
    function finishClose() {
      // Clearing src destroys the player. Without this the video keeps playing (with audio)
      // behind the closed overlay.
      frameEl.removeAttribute("src");
      if (activeTile) activeTile.classList.remove("is-active");
      activeTile = null;
      document.documentElement.classList.remove("lf-lock");
      window.__lenis?.start();
    }

    const perTileCleanups: Array<() => void> = [];
    tiles.forEach((tile) => {
      const play = tile.querySelector<HTMLElement>(".lf-play");
      const mag = { tx: 0, ty: 0, cx: 0, cy: 0, raf: 0 as number | 0 };
      let rafId: number | null = null;
      function magTick() {
        mag.cx += (mag.tx - mag.cx) * 0.18;
        mag.cy += (mag.ty - mag.cy) * 0.18;
        play?.style.setProperty("--px", mag.cx.toFixed(2) + "px");
        play?.style.setProperty("--py", mag.cy.toFixed(2) + "px");
        if (Math.abs(mag.tx - mag.cx) > 0.4 || Math.abs(mag.ty - mag.cy) > 0.4)
          rafId = requestAnimationFrame(magTick);
        else rafId = null;
      }
      function magEnsureLoop() {
        if (rafId == null) rafId = requestAnimationFrame(magTick);
      }

      // The hover handlers used to also play/pause an inline <video> preview. With a poster image
      // there is nothing to play, so only the cursor-following play icon remains — every visual
      // hover effect (scale, border, icon travel) is unchanged.
      const onMove = (e: MouseEvent) => {
        const r = tile.getBoundingClientRect();
        const margin = (play?.offsetWidth || 58) / 2 + 6;
        const maxX = r.width / 2 - margin,
          maxY = r.height / 2 - margin;
        mag.tx = Math.max(-maxX, Math.min(maxX, e.clientX - r.left - r.width / 2));
        mag.ty = Math.max(-maxY, Math.min(maxY, e.clientY - r.top - r.height / 2));
        magEnsureLoop();
      };
      const onLeave = () => {
        mag.tx = 0;
        mag.ty = 0;
        magEnsureLoop();
      };
      if (canHover) {
        tile.addEventListener("mousemove", onMove);
        tile.addEventListener("mouseleave", onLeave);
      }
      const onClick = (e: Event) => {
        e.preventDefault();
        const el = tile as HTMLElement;
        openSource(el.dataset.yt || "", tile, el.dataset.ar);
      };
      tile.addEventListener("click", onClick);
      perTileCleanups.push(() => {
        if (canHover) {
          tile.removeEventListener("mousemove", onMove);
          tile.removeEventListener("mouseleave", onLeave);
        }
        tile.removeEventListener("click", onClick);
        if (rafId != null) cancelAnimationFrame(rafId);
      });
    });

    const onBackdrop = () => closeOverlay();
    const onClose = () => closeOverlay();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOverlay();
    };
    const onResize = () => {
      if (isOpen) applyRect(targetRect(), false);
    };
    // The shield swallows pointer events so YouTube never paints its title/avatar overlay; this
    // hands play/pause back to the viewer through it, so nothing is lost by hiding that chrome.
    const onShield = () => {
      if (!isOpen) return;
      isPlaying = !isPlaying;
      ytCommand(isPlaying ? "playVideo" : "pauseVideo");
      // Keep the poster from reappearing over a video the viewer just un-paused.
      if (coverEl) coverEl.classList.add("is-hidden");
    };
    const onShieldKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        onShield();
      }
    };
    backdrop.addEventListener("click", onBackdrop);
    closeBtn.addEventListener("click", onClose);
    document.addEventListener("keydown", onKey);
    shieldEl?.addEventListener("click", onShield);
    shieldEl?.addEventListener("keydown", onShieldKey);
    addEventListener("resize", onResize);

    return () => {
      perTileCleanups.forEach((fn) => fn());
      backdrop.removeEventListener("click", onBackdrop);
      closeBtn.removeEventListener("click", onClose);
      document.removeEventListener("keydown", onKey);
      shieldEl?.removeEventListener("click", onShield);
      shieldEl?.removeEventListener("keydown", onShieldKey);
      if (coverTimer !== null) clearTimeout(coverTimer);
      removeEventListener("resize", onResize);
      if (window.__openVideoPopup === openSource) window.__openVideoPopup = undefined;
    };
  }, []);

  return (
    <div style={{ display: "contents" }} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

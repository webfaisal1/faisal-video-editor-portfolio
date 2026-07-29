"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import html from "@/content/popup";

/**
 * Shared FLIP-style video popup (one instance, reused by Long Form tiles and Short Form cards).
 * Renders the overlay markup and re-homes the original single-file popup IIFE:
 *  - wires each .lf-tile (hover inline preview + cursor-following play icon + click-to-open)
 *  - exposes window.__openVideoPopup so Short Form can open the same modal unmuted on click
 * Preserves the muted/unmuted autoplay fallback exactly.
 */
export default function VideoPopup() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tiles = Array.from(document.querySelectorAll<HTMLElement>(".lf-tile"));

    const overlay = document.getElementById("lfOverlay")!;
    const backdrop = document.getElementById("lfBackdrop")!;
    const modal = document.getElementById("lfModal") as HTMLElement;
    const videoEl = document.getElementById("lfVideo") as HTMLVideoElement;
    const closeBtn = document.getElementById("lfClose")!;
    const unmuteBtn = document.getElementById("lfUnmute")!;
    if (!overlay || !modal || !videoEl) return;
    const hasGsap = true;
    const canHover = matchMedia("(hover:hover)").matches;

    let activeTile: HTMLElement | null = null;
    let isOpen = false;

    function targetRect() {
      const vw = innerWidth,
        vh = innerHeight;
      const maxW = vw * 0.86,
        maxH = vh * 0.82;
      const ar =
        videoEl.videoWidth && videoEl.videoHeight
          ? videoEl.videoWidth / videoEl.videoHeight
          : 16 / 9;
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

    function openSource(src: string, originEl: Element | null, startUnmuted: boolean) {
      if (isOpen) return;
      isOpen = true;
      activeTile = originEl as HTMLElement | null;
      if (originEl) originEl.classList.add("is-active");

      const rect = originEl ? originEl.getBoundingClientRect() : targetRect();
      modal.style.left = rect.left + "px";
      modal.style.top = rect.top + "px";
      modal.style.width = rect.width + "px";
      modal.style.height = rect.height + "px";
      overlay.classList.add("open");

      const startMuted = !startUnmuted;
      videoEl.muted = startMuted;
      if (startMuted) videoEl.setAttribute("muted", "");
      else videoEl.removeAttribute("muted");
      unmuteBtn.classList.toggle("is-unmuted", !!startUnmuted);
      videoEl.src = src;
      videoEl.preload = "auto";
      videoEl.load();

      applyRect(targetRect(), true);
      videoEl.addEventListener("loadedmetadata", function onMeta() {
        videoEl.removeEventListener("loadedmetadata", onMeta);
        applyRect(targetRect(), true);
      });
      videoEl.addEventListener(
        "canplay",
        () => {
          videoEl.play().catch(() => {
            if (!videoEl.muted) {
              videoEl.muted = true;
              unmuteBtn.classList.remove("is-unmuted");
              videoEl.play().catch(() => {});
            }
          });
        },
        { once: true }
      );

      document.documentElement.classList.add("lf-lock");
      window.__lenis?.stop();
    }
    window.__openVideoPopup = openSource;

    function closeOverlay() {
      if (!isOpen) return;
      isOpen = false;
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
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
      if (activeTile) activeTile.classList.remove("is-active");
      activeTile = null;
      document.documentElement.classList.remove("lf-lock");
      window.__lenis?.start();
    }

    const perTileCleanups: Array<() => void> = [];
    tiles.forEach((tile) => {
      const thumb = tile.querySelector<HTMLVideoElement>(".lf-thumb");
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

      const onEnter = () => thumb?.play().catch(() => {});
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
        thumb?.pause();
        try {
          if (thumb) thumb.currentTime = 0.08;
        } catch {}
        mag.tx = 0;
        mag.ty = 0;
        magEnsureLoop();
      };
      if (canHover) {
        tile.addEventListener("mouseenter", onEnter);
        tile.addEventListener("mousemove", onMove);
        tile.addEventListener("mouseleave", onLeave);
      }
      const onClick = (e: Event) => {
        e.preventDefault();
        openSource((tile as HTMLElement).dataset.src || "", tile, false);
      };
      tile.addEventListener("click", onClick);
      perTileCleanups.push(() => {
        if (canHover) {
          tile.removeEventListener("mouseenter", onEnter);
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
    const onUnmute = () => {
      videoEl.muted = !videoEl.muted;
      unmuteBtn.classList.toggle("is-unmuted", !videoEl.muted);
    };
    const onResize = () => {
      if (isOpen) applyRect(targetRect(), false);
    };
    backdrop.addEventListener("click", onBackdrop);
    closeBtn.addEventListener("click", onClose);
    document.addEventListener("keydown", onKey);
    unmuteBtn.addEventListener("click", onUnmute);
    addEventListener("resize", onResize);

    return () => {
      perTileCleanups.forEach((fn) => fn());
      backdrop.removeEventListener("click", onBackdrop);
      closeBtn.removeEventListener("click", onClose);
      document.removeEventListener("keydown", onKey);
      unmuteBtn.removeEventListener("click", onUnmute);
      removeEventListener("resize", onResize);
      if (window.__openVideoPopup === openSource) window.__openVideoPopup = undefined;
    };
  }, []);

  return (
    <div style={{ display: "contents" }} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

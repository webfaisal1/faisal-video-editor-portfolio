"use client";

import { useEffect, useRef } from "react";

/**
 * Small glowing cursor dot with a single continuous fading streak behind it (styles in
 * globals.css under .cursor-trail): exactly two elements, a small bright dot and one thin
 * elongated streak, not a cluster of several overlapping blurred circles. On every mousemove
 * the dot is translated to the pointer directly; the streak is translated to the pointer too,
 * then rotated to point back toward the previous position and stretched to a length based on
 * how far the pointer moved since the last event, so it reads as one tapering trail whose
 * length reacts to how fast the mouse is moving, not a fixed row of dots. Length is capped so
 * a fast flick never produces an oversized bar.
 *
 * Movement is deliberately direct style writes + compositor-driven CSS transitions, not a
 * rAF/GSAP ticker loop: this project's rAF loop can stall independently of input (see the
 * SmoothScroll/Lenis notes), which is what silently killed an earlier GSAP-driven cursor
 * attempt. Direct writes have no such dependency. Guarded off for touch devices and
 * reduced-motion users.
 *
 * The 900ms idle-fade alone only covers the mouse stopping while still over the page. If the
 * cursor instead leaves the document entirely (dragged off the browser window edge onto
 * another app, or the tab loses focus while the trail is visible), no further mousemove ever
 * fires to start that timer, and a still-pending setTimeout can also get throttled for a long
 * stretch by Chrome's background-tab timer clamping, both of which read as the dot/streak
 * staying frozen on screen. mouseleave/blur below fade it out immediately in either case,
 * independent of the idle timer.
 */
const MAX_STREAK = 60;

export default function CursorTrail() {
  const wrap = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = wrap.current;
    const dot = dotRef.current;
    const streak = streakRef.current;
    if (!root || !dot || !streak) return;

    const canHover = matchMedia("(hover:hover) and (pointer:fine)").matches;
    const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
    if (!canHover || reduce) return;

    let idleTimer: number | undefined;
    let lastX: number | null = null;
    let lastY: number | null = null;

    const hide = () => {
      window.clearTimeout(idleTimer);
      root.style.opacity = "0";
      streak.style.width = "0px";
    };

    const onMove = (e: MouseEvent) => {
      const { clientX: x, clientY: y } = e;
      dot.style.transform = `translate(${x}px, ${y}px)`;

      if (lastX !== null && lastY !== null) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.min(Math.hypot(dx, dy), MAX_STREAK);
        const angle = Math.atan2(dy, dx) + Math.PI; // point back toward where the pointer came from
        streak.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;
        streak.style.width = `${dist}px`;
      }
      lastX = x;
      lastY = y;

      root.style.opacity = "1";
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(hide, 900);
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", hide);
    window.addEventListener("blur", hide);
    return () => {
      window.clearTimeout(idleTimer);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);

  return (
    <div ref={wrap} className="cursor-trail" aria-hidden="true">
      <div ref={streakRef} className="cursor-streak" />
      <div ref={dotRef} className="cursor-dot" />
    </div>
  );
}

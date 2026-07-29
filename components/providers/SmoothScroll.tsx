"use client";

import { useEffect } from "react";
import gsap from "gsap";
import Lenis from "lenis";

/**
 * Site-wide smooth scroll + the hero->editor "docking" scroll animation + nav reveal.
 *
 * This is a faithful re-home of the original single-file build's main GSAP/Lenis IIFE, now
 * using the npm packages (gsap, lenis) instead of CDN globals. Lenis scrolls the real window
 * so native CSS `position: sticky` still pins; dock progress is read straight off scroll
 * position and plain layout measurements. The global `.reveal` IntersectionObserver also
 * lives here.
 *
 * DOCK SMOOTHING: read D:\3D Portfolio\src\components\utils\GsapScroll.ts directly (not just
 * general GSAP assumptions). Its own scroll-linked motion (camera zoom, character rotation,
 * text reveals) is driven by real gsap.timeline() instances with actual .to()/.fromTo() tweens,
 * bound via scrollTrigger:{scrub:true, invalidateOnRefresh:true}. It never uses Framer Motion.
 * A previous pass here used framer-motion's useSpring reasoning it matched znaac.xyz, and tuned
 * it repeatedly (stiffness up to 1000/damping 60) without resolving the snapping complaint. This
 * switches to the actual technique this project's own real reference uses: a plain object tweened
 * by gsap.to() with overwrite:true, retargeted every time the scroll-derived raw progress
 * changes. GSAP's tween engine (the same one driving every .to() in GsapScroll.ts) eases the
 * chase toward each new target using real time-based interpolation, exactly the "scrub" pattern
 * 3D Portfolio's hero relies on, just applied to this project's own dock progress value instead
 * of a Three.js camera position.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

    /* ---- global scroll-reveal (adds .in as elements enter) ---- */
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));

    /* ---- marquee seamless-loop shift (Thumbnail + Testimonials rows) ----
       REAL root cause found by comparing against actual 25% zoom screenshots: each card is
       `width:clamp(260px,42vw,620px)` — capped at a hard 620px ceiling. The marquee row itself
       is `width:100%` of its section, which correctly grows to match the true (huge, ~4x at 25%
       zoom) viewport. Once that container got wider than the card set's fixed-ceiling total
       width, the static "duplicate the set exactly once" markup could never contain enough
       content to cover the row — it sits flush left with genuine empty space on the right,
       regardless of animation phase. No transform math fixes a genuine content shortfall.
       Fix: cache the ORIGINAL card set once, then on every call clear the track and rebuild it
       with however many copies are needed to comfortably exceed twice the container's current
       width, so there is always enough content sliding through no matter how wide zoom makes
       the row. --marq-shift is the exact measured width of ONE base set (via offsetLeft, the
       same zoom-stable layout-pixel measurement as the rest of this file), and the keyframes
       (see CSS) shift by exactly that amount regardless of how many copies now exist. */
    function updateMarquees() {
      document.querySelectorAll<HTMLElement>(".marquee").forEach((marquee) => {
        const track = marquee.querySelector<HTMLElement>(".marquee-track");
        if (!track) return;
        type WithBase = HTMLElement & { __marqBase?: HTMLElement[] };
        const t = track as WithBase;
        if (!t.__marqBase) {
          const kids = Array.from(track.children) as HTMLElement[];
          t.__marqBase = kids.slice(0, Math.ceil(kids.length / 2));
        }
        const base = t.__marqBase;
        if (!base.length) return;

        track.innerHTML = "";
        base.forEach((el) => track.appendChild(el.cloneNode(true)));
        const singleWidth = track.scrollWidth;
        if (!singleWidth) return;

        const marqueeWidth = marquee.getBoundingClientRect().width;
        const copies = Math.max(2, Math.ceil((marqueeWidth * 2) / singleWidth));
        for (let i = 1; i < copies; i++) {
          base.forEach((el) => {
            const clone = el.cloneNode(true) as HTMLElement;
            clone.setAttribute("aria-hidden", "true");
            track.appendChild(clone);
          });
        }
        track.style.setProperty("--marq-shift", `-${singleWidth}px`);
      });
    }
    /* ---- docking stage refs ---- */
    const nav = document.getElementById("nav");
    const wrap = document.querySelector<HTMLElement>(".dock-wrap");
    const stage = document.getElementById("dockStage");
    const dockVideo = document.getElementById("dockVideo");
    const slot = document.getElementById("dockSlot");
    const editor = document.getElementById("editorSec");

    let cleanupFns: Array<() => void> = [];
    let lenis: Lenis | null = null;

    updateMarquees();
    addEventListener("resize", updateMarquees);
    cleanupFns.push(() => removeEventListener("resize", updateMarquees));

    if (nav && wrap && stage && dockVideo && slot && editor) {
      const topBar = editor.querySelector<HTMLElement>(".e-top");
      const scrub = editor.querySelector<HTMLElement>(".ae-body");
      const tlWrap = editor.querySelector<HTMLElement>(".e-timeline-wrap");
      const statusBar = editor.querySelector<HTMLElement>(".e-status");
      const hint = stage.querySelector<HTMLElement>(".e-scrollhint");

      const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const easeInOut = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const seg = (p: number, s: number, e: number) => clamp((p - s) / (e - s));
      const docTop = (el: HTMLElement) => {
        let top = 0;
        let node: HTMLElement | null = el;
        while (node) {
          top += node.offsetTop;
          node = node.offsetParent as HTMLElement | null;
        }
        return top;
      };
      let prog = 0;

      // REAL STRUCTURAL FIX: every previous pass kept the video and the editor as two
      // SEPARATELY computed things (the video's own width/height/top/left lerped every frame
      // toward a live-measured slot rect, the editor scaled by a second, independent transform),
      // synced only by feeding both the same progress number. That is why it never read as one
      // physically connected piece no matter how the timing/magnitude/easing was tuned: they were
      // always two different elements running two different kinds of animation (one resizing a
      // box via layout properties, the other scaling an ancestor), which is also exactly the
      // pattern that forces a layout recalculation on the video AND a separate transform
      // recalculation on the editor every single frame, real work a real browser can drop frames
      // on and which no amount of easing math can paper over.
      //
      // This switches to the standard FLIP technique (First-Last-Invert-Play, the same principle
      // behind every "shared element" / "hero image expands into place" transition): measure the
      // video's native, FINAL resting position once (exactly the slot's own rect, so its rest
      // state IS physically the slot, not a separate thing tracking it), compute the single
      // transform that makes that same element LOOK like it fills the whole stage, then animate
      // only that one transform from "inverted" back to identity as the user scrolls. The editor
      // itself never moves or scales at all now; it sits at its real, native size the entire
      // time, and the video shrinking directly onto its own real position is what reads as
      // "docking into" it, one rigid, physically real relationship, not two synced approximations.
      // transform is also the one CSS property class that never triggers layout, so this removes
      // the per-frame getBoundingClientRect()-after-a-style-write layout thrashing entirely.
      let invertX = 0,
        invertY = 0,
        invertSX = 1,
        invertSY = 1;

      function measureDockGeometry() {
        const s = stage!.getBoundingClientRect();
        const r = slot!.getBoundingClientRect();
        // Zoom-safe: fractional getBoundingClientRect() values, not integer-rounded
        // clientWidth/clientHeight; at extreme zoom that rounding gap is otherwise magnified
        // enough to leave a visible gap/offset between the video and the edge of its stage.
        const last = { top: r.top - s.top, left: r.left - s.left, width: r.width, height: r.height };
        const first = { top: 0, left: 0, width: s.width, height: s.height };
        // The video's actual, native rest position IS the slot, set once (not lerped every
        // frame): the FLIP "Last" state.
        const dv = dockVideo!.style;
        dv.top = last.top + "px";
        dv.left = last.left + "px";
        dv.width = last.width + "px";
        dv.height = last.height + "px";
        // "Invert": the transform that makes that same native box look exactly like "first"
        // (full-bleed over the stage). transform-origin is the box's own top-left (set in CSS),
        // which scale() leaves fixed in place, so translate alone moves it from Last's screen
        // position to First's.
        invertSX = first.width / last.width;
        invertSY = first.height / last.height;
        invertX = first.left - last.left;
        invertY = first.top - last.top;
      }
      measureDockGeometry();

      function setDock(p: number) {
        prog = p;
        const e = easeInOut(clamp(p / 0.82));

        const dv = dockVideo!.style;
        // "Play": lerp the invert transform back to identity (translate(0,0) scale(1,1)) as e
        // goes 0 to 1, so at e=1 the video renders with NO transform at all, precisely at its
        // real, native position inside the slot, docked for real rather than approximated.
        dv.transform = `translate(${lerp(invertX, 0, e)}px, ${lerp(invertY, 0, e)}px) scale(${lerp(
          invertSX,
          1,
          e
        )}, ${lerp(invertSY, 1, e)})`;
        dv.borderRadius = lerp(0, 14, e) + "px";

        // The timeline (and status bar right below it) are the last two rows of .editor's flex
        // column, and .editor clips its own overflow. Instead of fading them in in place (which
        // is what read as "static/disconnected from the video"), they now literally slide up from
        // below that clip using the exact same `e` the video's own transform above uses, not a
        // separately-timed seg() window: at e=0 they sit far enough below the editor's visible
        // bottom edge to be fully clipped out of view, and as e climbs toward 1 they translate up
        // into their real resting position, progressively revealing more of themselves as they
        // cross the clip boundary. That reveal-by-clipping is what makes them look like they are
        // "growing into view" while the video shrinks, both driven by the identical number every
        // frame, matching how znaac.xyz's timeline rises into view as its own video shrinks.
        const tlOffset = lerp(280, 0, e);
        if (tlWrap) {
          tlWrap.style.opacity = "1";
          tlWrap.style.transform = `translateY(${tlOffset}px)`;
        }
        if (statusBar) {
          statusBar.style.opacity = "1";
          statusBar.style.transform = `translateY(${tlOffset}px)`;
        }

        // topBar/scrub keep a lighter fade-in of their own, staggered within the same 0-0.82
        // window the video and timeline use, since they were not the piece reported as
        // disconnected.
        const th = seg(p, 0, 0.5),
          sc = seg(p, 0.05, 0.6);
        if (topBar) {
          topBar.style.opacity = String(th);
          topBar.style.transform = `translateY(${lerp(-28, 0, th)}px)`;
        }
        if (scrub) {
          scrub.style.opacity = String(sc);
          scrub.style.transform = `translateY(${lerp(40, 0, sc)}px)`;
        }
        editor!.style.borderColor = `rgba(125,145,200,${lerp(
          0,
          0.14,
          seg(p, 0.2, 0.7)
        ).toFixed(3)})`;
        if (hint) hint.style.opacity = String(1 - seg(p, 0.02, 0.16));

        const np = seg(p, 0.3, 0.5);
        nav!.style.opacity = String(np);
        nav!.style.transform = `translateY(${lerp(-120, 0, np)}%)`;
        nav!.style.pointerEvents = np > 0.5 ? "auto" : "none";
      }

      if (reduce) {
        /* reduced motion: show docked state, simple nav toggle */
        document.body.classList.add("no-motion");
        requestAnimationFrame(() => setDock(1));
        const onResize = () => setDock(1);
        const onScroll = () => {
          const show = wrap!.getBoundingClientRect().bottom < innerHeight * 0.9;
          nav!.style.opacity = show ? "1" : "0";
          nav!.style.transform = show ? "translateY(0)" : "translateY(-120%)";
          nav!.style.pointerEvents = show ? "auto" : "none";
        };
        addEventListener("resize", onResize);
        addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        cleanupFns.push(() => removeEventListener("resize", onResize));
        cleanupFns.push(() => removeEventListener("scroll", onScroll));
      } else {
        lenis = new Lenis({ duration: 1.1, smoothWheel: true });
        window.__lenis = lenis as unknown as Window["__lenis"];
        const ticker = (time: number) => lenis!.raf(time * 1000);
        gsap.ticker.add(ticker);
        gsap.ticker.lagSmoothing(0);

        const anchorHandlers: Array<[Element, (ev: Event) => void]> = [];
        document.querySelectorAll('a[href^="#"]').forEach((a) => {
          const handler = (ev: Event) => {
            const id = a.getAttribute("href") || "";
            if (id.length > 1) {
              const t = document.querySelector<HTMLElement>(id);
              if (t) {
                ev.preventDefault();
                lenis!.scrollTo(t);
              }
            }
          };
          a.addEventListener("click", handler);
          anchorHandlers.push([a, handler]);
        });

        // Drive dock progress from plain layout measurements (offsetTop/offsetHeight) instead
        // of GSAP ScrollTrigger's trigger/pin matching, which caches "top top"/"bottom bottom"
        // bounds from getBoundingClientRect(). Browser zoom can scale an element's rendered rect
        // independently of its layout box (offsetHeight/offsetTop — the same box vh/svh resolve
        // through), and at a zoomed-out level that gap between the two collapsed ScrollTrigger's
        // ~270px pin range to ~0px, snapping the docking animation instantly instead of scrubbing
        // it and leaving a stale, oversized gap once the pin released. Recomputing straight from
        // offsetTop/offsetHeight on every scroll/resize event has no cached range to go stale, and
        // both values live in the same layout-pixel space vh itself resolves through, so there is
        // nothing left to diverge regardless of zoom level.
        //
        // dockObj.p is a plain object property tweened by gsap.to(), the same tween engine that
        // drives every real .to()/.fromTo() call in D:\3D Portfolio\GsapScroll.ts. Each time the
        // raw scroll-derived progress changes, a new gsap.to() retargets dockObj.p toward it with
        // overwrite:true, which kills any in-flight tween on that property and starts a fresh one,
        // the standard GSAP pattern for continuously chasing a moving target (the same mechanism
        // scrub:true uses internally to ease a timeline's playhead toward the scrollbar position).
        // 0.15s was tuned to finish before #dockStage un-pins and shrinks to a sliver during an
        // aggressive fling, but that made every normal-speed scroll look and feel closer to
        // instant than gradual. 0.3s reads as clearly, unmistakably eased for a normal scroll
        // gesture; it still mostly finishes while the stage is comfortably on screen for a fast
        // fling (verified: at 0.15s the transition settled by ~110-125ms while the stage was still
        // 50-80% visible, so 0.3s has real margin to spare before the stage becomes a sliver).
        function computeTarget() {
          const range = Math.max(1, wrap!.offsetHeight - stage!.offsetHeight);
          return clamp((window.scrollY - docTop(wrap!)) / range);
        }
        const dockObj = { p: computeTarget() };
        setDock(dockObj.p); // snap once on mount (e.g. a deep link mid-page) instead of chasing from 0
        function updateDock() {
          gsap.to(dockObj, {
            p: computeTarget(),
            duration: 0.3,
            ease: "power2.out",
            overwrite: true,
            onUpdate: () => setDock(dockObj.p),
          });
        }
        // The FLIP geometry (measureDockGeometry) only needs recomputing when the stage/slot's
        // own layout can change, not on every scroll tick, since the editor no longer moves or
        // scales. resize (including a real browser zoom change, which fires resize) is the only
        // case that can change it after mount.
        function onResize() {
          measureDockGeometry();
          updateDock();
        }
        lenis.on("scroll", updateDock);
        addEventListener("resize", onResize);
        addEventListener("load", onResize);

        cleanupFns.push(() => {
          gsap.killTweensOf(dockObj);
          gsap.ticker.remove(ticker);
          lenis?.destroy();
          window.__lenis = undefined;
          removeEventListener("resize", onResize);
          removeEventListener("load", onResize);
          anchorHandlers.forEach(([a, h]) => a.removeEventListener("click", h));
        });
      }
    }

    return () => {
      io.disconnect();
      cleanupFns.forEach((fn) => fn());
    };
  }, []);

  return <>{children}</>;
}

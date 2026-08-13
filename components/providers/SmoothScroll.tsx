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

    /* The Hero must always open on the full-bleed video, never part-way through the docking
       scrub. Browsers restore the previous scroll offset on reload by default, and because the
       whole hero animation is driven off scroll position, a restored offset renders the editor
       already docked (timeline and panels visible) the instant the page appears — which reads as
       the intro being broken rather than as a restored position. Opting out of restoration and
       resetting to 0 before first paint guarantees the intro always starts from the top.
       Deep links to #anchors are unaffected: those are handled by the anchor click handler and by
       Lenis' own scrollTo, both of which run after this. */
    const atTopHandlers: Array<() => void> = [];
    if (!location.hash) {
      if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
        // Next's App Router re-asserts 'auto' after hydration, so claim it again on the next frame
        // — otherwise the setting is silently reverted before the following reload.
        requestAnimationFrame(() => {
          try {
            history.scrollRestoration = "manual";
          } catch {}
        });
      }
      window.scrollTo(0, 0);
      // The browser's own restore can land AFTER hydration, so re-assert once on load too.
      const toTop = () => window.scrollTo(0, 0);
      addEventListener("load", toTop);
      atTopHandlers.push(() => removeEventListener("load", toTop));
    }

    /* ---- global scroll-reveal (adds .in as elements enter) ----
       Each .reveal is observed on its own, but with the default root every element that happens to
       be on screen when a section scrolls up crosses the threshold in the same frame, so a whole
       section popped in as one block. The negative bottom rootMargin shrinks the observer's root
       to the top ~78% of the viewport, which means an element only counts as "entered" once it has
       actually travelled up into the reading area — cards further down the section keep waiting
       until they individually reach that line, giving the one-at-a-time reveal.

       revealAll() is the safety net that shrunk root requires: content sitting inside that bottom
       22% when the page can scroll no further would otherwise never intersect and would stay
       permanently invisible. Anything still hidden once we are at (or within a hair of) the very
       bottom is revealed outright. */
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -22% 0px" }
    );

    /* The markup puts .reveal on the LIST CONTAINER for these three, not on the cards inside it —
       one observed element covering a whole grid/list, so its entire contents faded in together no
       matter how the observer is tuned (the FAQ was the worst case: all seven questions on a single
       .reveal). Hand the class down to the children so each card is observed, and therefore
       revealed, on its own as it reaches the trigger line.

       Only genuinely stacked lists are split. .sf-stage and .marquee are deliberately excluded:
       their children are laid out horizontally and driven by their own GSAP/CSS animations, so
       per-child reveals would both fight those animations and fire simultaneously anyway. */
    [".lf-grid", ".faq-list", ".about-points"].forEach((sel) => {
      document.querySelectorAll(`${sel}.reveal`).forEach((box) => {
        box.classList.remove("reveal", "d1", "d2", "d3", "d4", "d5");
        Array.from(box.children).forEach((child) => child.classList.add("reveal"));
      });
    });

    document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));

    const revealAll = () => {
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) return;
      document.querySelectorAll(".reveal:not(.in)").forEach((el) => {
        el.classList.add("in");
        io.unobserve(el);
      });
    };
    window.addEventListener("scroll", revealAll, { passive: true });
    window.addEventListener("resize", revealAll);
    atTopHandlers.push(() => {
      window.removeEventListener("scroll", revealAll);
      window.removeEventListener("resize", revealAll);
    });

    /* ---- marquee seamless-loop shift (Thumbnails row; generic over every .marquee) ----
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

    /* ---- top-of-page scroll progress bar ----
       Deliberately standalone (own listeners, not nested in the hero/reduce branches below): it
       has to work regardless of whether the hero refs above resolve and regardless of the
       prefers-reduced-motion path, so it gets a single native `scroll`/`resize` binding here
       rather than being threaded through updateDock/updateNav's two different call sites. Lenis
       in this project scrolls the real window (see file header comment), so plain native scroll
       events fire correctly during Lenis-driven scrolling too — no need to hook lenis.on('scroll')
       specifically. resize is also listened for since it can change scrollHeight/innerHeight
       (e.g. a stage card's content reflowing), which changes the percentage even if scrollY hasn't
       moved. */
    const progressBar = document.getElementById("scrollProgressBar");
    function updateProgress() {
      if (!progressBar) return;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const pct = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) * 100 : 0;
      progressBar.style.width = pct + "%";
    }
    updateProgress();
    addEventListener("scroll", updateProgress, { passive: true });
    addEventListener("resize", updateProgress);
    cleanupFns.push(() => {
      removeEventListener("scroll", updateProgress);
      removeEventListener("resize", updateProgress);
    });

    if (nav && wrap && stage && dockVideo && slot && editor) {
      const topBar = editor.querySelector<HTMLElement>(".e-top");
      const scrub = editor.querySelector<HTMLElement>(".ae-body");
      const tlWrap = editor.querySelector<HTMLElement>(".e-timeline-wrap");
      const statusBar = editor.querySelector<HTMLElement>(".e-status");
      const hint = stage.querySelector<HTMLElement>(".e-scrollhint");
      // Needed by measureDockGeometry to know the real frame aspect under object-fit:contain.
      const vidEl = dockVideo.querySelector<HTMLVideoElement>("video");

      // On-screen corner radius for the docking video, held constant across the whole scrub
      // (see setDock). Matches the reference site's `rounded-lg`-scale framing.
      const ROUNDED_PX = 14;

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
      // The slot rect the current invert* numbers were measured against. setDock compares the live
      // rect to these and re-measures on any drift, which makes the geometry self-healing: the
      // ResizeObserver below is the fast path, this is the guarantee. Without it, anything that
      // moves the slot without firing that observer leaves the box sized for the OLD layout —
      // exactly the reported symptom, where the video kept a taller box than its slot and so hung
      // down over the transport bar with a matching gap above it. In dev this is easy to hit,
      // because a CSS edit hot-reloads the stylesheet without re-running this effect.
      let measuredW = -1,
        measuredH = -1,
        measuredT = -1;
      // Declared up here, not beside setDock: measureDockGeometry() runs before that point and
      // calls setDock, which reads this flag — a `let` declared later would be in its temporal
      // dead zone at that moment and throw.
      let remeasuring = false;

      // The editor mockup is fixed-pixel sized (max-width 1180px, max-height 864px) because its
      // rows, labels and toolbars are all fixed-px — that cap is what stops .ae-viewer absorbing
      // surplus height and stretching the video. But on a zoomed-out or very tall screen the stage
      // is the whole viewport, so that cap left the mockup marooned in the middle with a big equal
      // band above and below it (measured 968px each at 5000x2800).
      //
      // Scaling the whole editor is the only way to fill that space without distorting anything:
      // every internal proportion is preserved, and at low browser zoom the scale-up is exactly
      // what makes the mockup read at its normal physical size again.
      //
      // Scales in BOTH directions. The editor now has one fixed design size (1180x864, see its CSS)
      // at every viewport, so this is the only thing that varies with zoom — which is exactly what
      // makes the mockup's proportions identical everywhere instead of the layout itself changing
      // shape. An earlier version only scaled up, gated on the editor being height-capped; that
      // left 100% zoom laying out at 744px tall rather than 864px, and the 120px difference went
      // straight into .ae-viewer and changed the video's proportions between zoom levels.
      //
      // STAGE_INSET keeps the 12px-per-side breathing room the old padding provided, so the mockup
      // never sits flush against the edges of the stage.
      // offsetWidth/offsetHeight are read deliberately — unlike getBoundingClientRect they ignore
      // this very transform, so k cannot feed back on itself and oscillate.
      const STAGE_INSET = 24;
      function fitEditorToStage(stageRect: DOMRect) {
        const ew = editor!.offsetWidth;
        const eh = editor!.offsetHeight;
        if (!ew || !eh) return;
        // Fits in BOTH directions — shrinks on small viewports, enlarges on large ones.
        //
        // The enlarging half is deliberate and load-bearing. Three requirements collide at low
        // browser zoom and only two can hold at once:
        //   1. the mockup scales with zoom (shrinks like ordinary page content),
        //   2. no empty space above/below it inside the Hero,
        //   3. the full-bleed hero video is uncropped.
        // (3) forces .dock-stage to be the full viewport height, because the stage's aspect ratio is
        // literally what the covering video gets cropped to — a stage sized to the mockup instead
        // becomes an ~833x7680 band, aspect 9.2, which mangles the frame. So with the stage pinned
        // at full height, a mockup that shrank with zoom would leave ~995px of dead space per edge
        // (measured at 5000x2800). Scaling it up to fill the stage is what satisfies (2) and (3);
        // (1) is the one dropped, by explicit choice.
        // Proportions stay identical at every zoom because the design size is fixed (1180x809) and
        // only this factor varies.
        const k = Math.min(
          (stageRect.width - STAGE_INSET) / ew,
          (stageRect.height - STAGE_INSET) / eh
        );
        if (k > 0 && Math.abs(k - 1) > 0.001) {
          editor!.style.transformOrigin = "center center";
          editor!.style.transform = `scale(${k})`;
        } else {
          editor!.style.removeProperty("transform");
          editor!.style.removeProperty("transform-origin");
        }
      }

      function measureDockGeometry() {
        const s = stage!.getBoundingClientRect();
        // Size the mockup BEFORE measuring: the scale moves the slot, and every rect below must
        // describe the post-scale layout or the video would dock to the wrong place.
        fitEditorToStage(s);
        const r = slot!.getBoundingClientRect();
        // Cache what this measurement was taken against, so setDock can notice the layout moving
        // underneath it and re-measure (see the guard in setDock). Deliberately cached in the SAME
        // units the guard reads (integer offset*, not fractional getBoundingClientRect) — mixing
        // the two would register a permanent false mismatch and re-measure on every frame.
        measuredW = slot!.offsetWidth;
        measuredH = slot!.offsetHeight;
        measuredT = slot!.offsetTop - stage!.offsetTop;

        // The box is the slot's FULL rect. The video is object-fit:cover inside it, so the painted
        // frame and the box are the same rectangle — which is what keeps border-radius rounding the
        // video's own corners rather than empty margin around it.
        //
        // This used to compute a contained sub-rect instead (the frame object-fit:contain would
        // paint). That was needed while the slot's aspect was far from 16:9, but now the slot is
        // 735x414 by design — 16:9 to within 0.15% — and the contained rect came out 0.6px shorter
        // than the slot, leaving a 0.28px letterbox per edge that the dock's scale-up magnified
        // into a visible hairline strip. Using the slot itself removes that residue exactly.
        // Zoom-safe: fractional getBoundingClientRect() values, not integer-rounded
        // clientWidth/clientHeight; at extreme zoom that rounding gap is otherwise magnified
        // enough to leave a visible gap/offset between the video and the edge of its stage.
        const containW = r.width;
        const containH = r.height;
        const last = {
          // exactly the slot, so the video rests flush inside the composition viewer
          top: r.top - s.top + (r.height - containH) / 2,
          left: r.left - s.left + (r.width - containW) / 2,
          width: containW,
          height: containH,
        };
        const first = { top: 0, left: 0, width: s.width, height: s.height };
        // The video's actual, native rest position IS the slot, set once (not lerped every
        // frame): the FLIP "Last" state.
        const dv = dockVideo!.style;
        dv.top = last.top + "px";
        dv.left = last.left + "px";
        dv.width = last.width + "px";
        dv.height = last.height + "px";
        // "Invert": the transform that makes that same native box look like "first"
        // (full-bleed over the stage). transform-origin is the box's own top-left (set in CSS),
        // which scale() leaves fixed in place, so translate alone moves it from Last's screen
        // position to First's.
        // Scale must be uniform (same factor on both axes) or the video distorts; independent
        // X/Y factors were the original squash bug.
        //
        // `last` IS the painted frame now, so scaling it to cover the stage keeps the hero
        // genuinely full-bleed (before, scaling the wider box left the frame short of the edges —
        // measured 1365.3px of video across a 1366px viewport, a visible hairline seam).
        const scale = Math.max(first.width / last.width, first.height / last.height);
        invertSX = scale;
        invertSY = scale;
        const renderedWidth = last.width * scale;
        const renderedHeight = last.height * scale;
        invertX = first.left - last.left - (renderedWidth - first.width) / 2;
        invertY = first.top - last.top - (renderedHeight - first.height) / 2;
        // Re-apply immediately with the fresh numbers. Recomputing invert* alone is not enough:
        // setDock is what actually writes the transform, and the usual trigger (updateDock) tweens
        // toward computeTarget() — when scroll progress is unchanged (e.g. resizing while parked at
        // the top) that tween has no delta to animate and never writes, leaving the DOM on the
        // previous viewport's scale. Measured symptom: scale stayed 2.5443 after resizing from
        // 1366x768 to 1280x800 where 2.3952 was correct, overshooting the stage by 230.7px.
        setDock(prog);
      }
      measureDockGeometry();

      // Mount-time measurement is routinely taken BEFORE the layout has settled: `svh` resolves
      // against provisional browser chrome, webfonts swap and reflow the fixed-height editor rows,
      // and the flex chain feeding .ae-viewer only reaches its final size a frame or two later.
      // Measured here: the slot was 649x300.6 when the effect ran but 735x349 once settled, so the
      // box kept the smaller geometry and no longer lined up with its slot — the reported overlap.
      //
      // The ResizeObserver below was supposed to absorb exactly this, but it cannot be relied on:
      // its delivery is tied to the rendering lifecycle, and in a tab that is not compositing it
      // never fires at all (verified — a fresh observer on #dockSlot reported 0 callbacks across a
      // real 40px size change). These triggers are lifecycle-independent, so they hold regardless.
      let settleFrames = 0;
      function settlePass() {
        measureDockGeometry();
        if (++settleFrames < 6) requestAnimationFrame(settlePass);
      }
      const settleRaf = requestAnimationFrame(settlePass);
      cleanupFns.push(() => cancelAnimationFrame(settleRaf));

      if (document.fonts?.ready) {
        document.fonts.ready.then(() => measureDockGeometry()).catch(() => {});
      }
      // videoWidth/Height are 0 until metadata arrives, so the first measurement uses the 16/9
      // fallback for VIDEO_AR; re-measure once the real intrinsic ratio is known.
      if (vidEl) {
        const onMeta = () => measureDockGeometry();
        vidEl.addEventListener("loadedmetadata", onMeta);
        cleanupFns.push(() => vidEl.removeEventListener("loadedmetadata", onMeta));
      }

      function setDock(p: number) {
        prog = p;
        const e = easeInOut(clamp(p / 0.82));

        // Cheap drift check (integer offsets, no forced style recalc beyond a layout read the
        // frame already needs). If the slot has moved or resized since the last measurement, the
        // baked invert* numbers describe a layout that no longer exists — re-measure first.
        if (!remeasuring && slot && stage) {
          const w = slot.offsetWidth;
          const h = slot.offsetHeight;
          const t = slot.offsetTop - stage.offsetTop;
          if (
            measuredW >= 0 &&
            (Math.abs(w - measuredW) > 1 ||
              Math.abs(h - measuredH) > 1 ||
              Math.abs(t - measuredT) > 1)
          ) {
            remeasuring = true;
            measureDockGeometry();
            remeasuring = false;
          }
        }

        const dv = dockVideo!.style;
        // "Play": lerp the invert transform back to identity (translate(0,0) scale(1,1)) as e
        // goes 0 to 1, so at e=1 the video renders with NO transform at all, precisely at its
        // real, native position inside the slot, docked for real rather than approximated.
        dv.transform = `translate(${lerp(invertX, 0, e)}px, ${lerp(invertY, 0, e)}px) scale(${lerp(
          invertSX,
          1,
          e
        )}, ${lerp(invertSY, 1, e)})`;
        // Rounded corners at EVERY point of the scrub, at a constant on-screen radius.
        // border-radius is specified in the element's own pre-transform coordinate space, so a
        // literal value gets multiplied by whatever scale is currently applied. The old
        // `lerp(0, 14, e)` therefore did two wrong things at once: it started at 0 (square corners
        // at full bleed) and, had it not, a flat 14px would have rendered at ~31px mid-scrub where
        // the scale is ~2.2x and only settled to 14px once docked — corners that visibly swell and
        // shrink. Dividing the target by the live scale cancels the transform exactly, so the
        // radius reads as the same ROUNDED_PX on screen from full bleed through to docked.
        const scaleNow = lerp(invertSX, 1, e);
        dv.borderRadius = ROUNDED_PX / (scaleNow || 1) + "px";

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
        // Offset is MEASURED, not the old hardcoded 280px. It has to be at least the distance from
        // the timeline's own top to the editor's bottom edge, otherwise the row is not pushed far
        // enough past the clip and a sliver stays on screen at scroll-top — which is exactly what
        // regressed when the editor's design height changed (timeline top sits at 522px inside an
        // 809px editor, so 287px is now required and the old 280px left ~9px of it showing).
        // Falls back to 280 only if the measurement is unavailable.
        const tlHide =
          tlWrap && editor
            ? Math.max(0, editor.offsetHeight - tlWrap.offsetTop) + 2
            : 280;
        const tlOffset = lerp(tlHide, 0, e);
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
        // Theme-tinted, not a hardcoded hue: this is written as an INLINE style during the dock
        // scrub, so it is invisible to any find-and-replace over globals.css and was the single
        // stray off-theme colour left after the palette swap (it survived as a blue-grey
        // rgba(125,145,200) through the green->blue->neo-green rebrands). Kept as a literal rather
        // than reading the CSS var because this runs every scroll frame and getComputedStyle()
        // there would force a style recalc per frame.
        editor!.style.borderColor = `rgba(140,150,180,${lerp(
          0,
          0.14,
          seg(p, 0.2, 0.7)
        ).toFixed(3)})`;
        if (hint) hint.style.opacity = String(1 - seg(p, 0.02, 0.16));
        // NOTE: the navbar is deliberately NOT driven from dock progress any more. Doing so
        // revealed it partway through the Hero (at 30-50% of the docking scrub). It is now tied to
        // the Hero actually leaving the viewport — see updateNav below.
      }

      /* Navbar visibility: hidden for the whole Hero, revealed only once the section AFTER it
         (About) has scrolled meaningfully into view. .dock-wrap is the Hero's full scroll runway,
         so its bottom edge crossing up past 60% of the viewport height means About now occupies the
         lower ~40% of the screen — the point at which the user has genuinely left the Hero. Using
         the wrap's own rect (rather than dock progress) keeps this correct regardless of how long
         the runway is or how fast the user flings. */
      function updateNav() {
        // Scrubbed, not toggled. A boolean flip produced a hard cut the moment the threshold was
        // crossed; this maps the Hero's exit to a continuous 0..1 the same way setDock maps scroll
        // to the video's scale, so the bar fades and slides in progressively as About rises.
        // Reveal window: starts when .dock-wrap's bottom edge reaches 90% of the viewport height
        // (About just appearing) and completes at 45% (About clearly on screen).
        const b = wrap!.getBoundingClientRect().bottom;
        const from = innerHeight * 0.9;
        const to = innerHeight * 0.45;
        const t = clamp((from - b) / (from - to));
        nav!.style.opacity = String(t);
        nav!.style.transform = `translateY(${lerp(-120, 0, t)}%)`;
        // only clickable once it is mostly opaque, so a half-faded bar can't swallow clicks
        nav!.style.pointerEvents = t > 0.6 ? "auto" : "none";
      }

      if (reduce) {
        /* reduced motion: show docked state, simple nav toggle */
        document.body.classList.add("no-motion");
        requestAnimationFrame(() => setDock(1));
        const onResize = () => {
          setDock(1);
          updateNav();
        };
        // same rule as the motion path, so the navbar's reveal point is identical either way
        const onScroll = () => updateNav();
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
          updateNav();
        }
        // The FLIP numbers are only valid for the slot/stage sizes they were measured against.
        // Firing solely on window resize/load left them stale whenever the slot's box changed for
        // any other reason — late font/layout settling after mount, or svh resolving differently
        // once chrome settles. Measured symptom: an applied scale of 2.3952 where 2.5443 was
        // required, i.e. a 1286x723 video inside a 1366x768 stage — visible gaps at the hero edges.
        // A ResizeObserver ties re-measurement to the thing that actually invalidates it.
        const ro = new ResizeObserver(() => {
          measureDockGeometry();
          updateDock();
        });
        ro.observe(slot!);
        ro.observe(stage!);
        cleanupFns.push(() => ro.disconnect());

        lenis.on("scroll", () => {
          updateDock();
          updateNav();
        });
        updateNav(); // hidden on first paint at scroll-top, instead of flashing in
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
      atTopHandlers.forEach((fn) => fn());
      cleanupFns.forEach((fn) => fn());
    };
  }, []);

  return <>{children}</>;
}

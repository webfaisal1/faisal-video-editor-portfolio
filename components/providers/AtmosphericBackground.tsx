"use client";

import { useEffect, useRef } from "react";

/**
 * ATMOSPHERIC BACKGROUND — full-viewport volumetric cloud/mist field, cursor-reactive.
 *
 * WHY RAW WEBGL AND NOT THREE.JS / R3F:
 * This effect is a single full-screen fragment shader. It needs exactly one triangle, no camera,
 * no scene graph, no lights, no materials, no raycaster — i.e. essentially none of what three.js
 * exists to provide. Adding three (~150KB gz) + @react-three/fiber to this project would be pure
 * payload for an abstraction we'd bypass anyway, on a site whose whole hero already hinges on
 * scroll smoothness. Hand-written WebGL1 keeps this at a few KB, compiles one program once, and
 * leaves the per-frame cost as literally one drawArrays of 3 vertices. WebGL1 (not 2) is
 * deliberate: universal support incl. older iOS Safari, and nothing here needs GLSL 3.
 *
 * VISUAL TECHNIQUE — CINEMATIC KEY LIGHT: volumetric shafts raking down from an off-screen source.
 * The full rationale, including a table of exactly how this differs from every previous version,
 * sits directly above main() in the fragment shader. In short: the shafts are ANALYTIC (a gaussian
 * across each beam's own axis, all sharing one rake angle), and noise now only dims them slightly
 * to suggest dust in the air. It never generates shape.
 *
 * WHY THE REWRITE: the fluid warp, the cloud strata and the corner bleeds were all the same visual
 * vocabulary underneath — soft rounded organic masses, shape derived FROM a noise field, scattered
 * isotropically across the frame. Only the hue and the falloff mask ever changed between them,
 * which is why each attempt read as the previous one repainted. Isotropy was the real culprit: a
 * field with no preferred direction reads as weather/atmosphere no matter how it is tuned. Beams
 * are strongly directional and share a single axis, so the eye infers a light SOURCE above the
 * frame instead of a texture laid over it. That is a different thing, not a different colour.
 *
 * CURSOR INTERACTION — the light leans, nothing is displaced:
 *  1. The cursor's horizontal position tilts the shared rake angle very slightly, so moving the
 *     mouse feels like nudging the lamp rather than pushing a substance around.
 *  2. A soft local lift where the cursor sits — it "catches" a little of the light.
 *  3. NO SPRING (explicitly requested): the pointer is smoothed by pure exponential easing with no
 *     velocity term, so overshoot is impossible by construction. Strength rises gently and decays
 *     over several seconds, so the rig settles back rather than snapping.
 *
 * PERFORMANCE:
 *  - Renders to a downscaled buffer (see RENDER_SCALE) and lets the compositor upscale. The effect
 *    is extremely low frequency, so this is visually free and quadratically cheaper in fragments.
 *  - Adaptive degradation: sustained slow frames step the resolution down, so a weak GPU loses
 *    sharpness nobody can perceive here instead of losing frame rate everyone can.
 *  - rAF is fully stopped while the tab is hidden (visibilitychange).
 *  - The GPU draw is skipped entirely while the opaque hero covers the viewport — see the occlusion
 *    check in frame(). Do NOT reach for an IntersectionObserver on the canvas here: it is
 *    position:fixed inset:0 and therefore always intersects, so an observer can never fire a stop
 *    (an earlier version of this file shipped exactly that dead code).
 *  - dt is clamped so a backgrounded tab returning doesn't integrate one enormous physics step.
 *  - prefers-reduced-motion renders exactly one static frame and never starts a loop or listeners.
 *
 * THEME: colours are read from the site's own CSS custom properties (--bg/--accent/--accent-bright/
 * --sage) at mount, so this tracks the palette automatically and never hardcodes the brand.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uAspect;
uniform vec2  uMouse;      // 0..1, y already flipped to match vUv
uniform float uStrength;   // 0..1 push strength, speed-driven, decays slowly
uniform float uPresence;   // 0..1 pointer "is here at all", decays over ~2s after leave
uniform vec3  uBg;
uniform vec3  uAccent;
uniform vec3  uAccentBright;
uniform vec3  uSage;

/* --- simplex noise (Ashima / Gustavson), the standard compact 2D implementation --- */
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
                          + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x   + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

/* fBm with a STEEP amplitude falloff (gain 0.40, not the conventional 0.50) and few octaves, then
   normalised by the amplitude sum to keep a consistent range.

   THE GAIN IS THE ANTI-STRINGINESS LEVER, and it is the whole reason the previous version showed
   thin, thread-like wisps. Shaping a field that still carries strong high-frequency octaves makes
   its level sets FRAGMENT: near the shaping band the contour breaks into filaments and detached
   worms, which is precisely the hairline artefact that read as fluid. Starving the high octaves
   leaves a field dominated by its lowest frequency, whose iso-surfaces are large, smooth and
   rounded — puffy masses instead of threads. At gain 0.40 the third octave contributes 0.16 of the
   first, versus 0.25 at gain 0.50, and there is no fourth octave at all on the shaped layers.

   The inter-octave rotation only decorrelates octaves so the sum shows no grid alignment — it is
   NOT a domain warp: every octave still samples the same undistorted point set. */
#define FBM_BODY(N) \
  float amp = 1.0; \
  float sum = 0.0; \
  float norm = 0.0; \
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80); \
  for(int i = 0; i < N; i++){ \
    sum += amp * snoise(p); \
    norm += amp; \
    p = rot * p * 2.0; \
    amp *= 0.40; \
  } \
  return sum / norm;

float fbm2(vec2 p){ FBM_BODY(2) }
float fbm3(vec2 p){ FBM_BODY(3) }

/* Dust/haze density riding inside the beams. One cheap fBm, remapped to 0..1. This is the ONLY
   remaining use of noise here: it is a subtle intensity modulation along each shaft, never a shape
   generator. Volumetric light is uneven because the air it crosses is uneven — that is all this is. */
float haze(vec2 p){ return DUST_FBM(p) * 0.5 + 0.5; }

/* One light shaft: a gaussian across its own axis.
   Gaussian and not smoothstep on purpose — a real beam in haze has no boundary at all, and any
   smoothstep leaves a faint edge where its falloff starts. exp(-d*d) never reaches zero, so the
   shaft dissolves into the black with nothing to catch the eye. */
float shaft(float x, float centre, float halfWidth){
  float d = (x - centre) / halfWidth;
  return exp(-d * d);
}

/* =========================================================================================
   CINEMATIC KEY LIGHT — volumetric shafts raking down from an off-screen source.

   THIS IS A DELIBERATE STRUCTURAL REPLACEMENT, not a recolour. Every previous version of this
   file — the fluid warp, the cloud strata, the corner bleeds — was the same visual vocabulary:
   soft rounded organic masses scattered across the frame, generated by shaping a noise field, and
   distributed by radial falloffs. Only the hue and the falloff mask ever changed, which is exactly
   why each attempt read as the previous one repainted. So the generator is different this time:

     PREVIOUS                             THIS
     rounded organic blobs                long straight-edged beams
     shape comes FROM noise               shape is analytic; noise only dims it
     scattered across the whole frame     parallel, all sharing one rake angle
     anchored to corners / centre         anchored to the TOP EDGE, entering from off-screen
     isotropic (no direction)             strongly directional
     "weather"                            "lighting"

   Anisotropy is the point. Everything before was isotropic — no preferred direction — which is
   what made it read as atmosphere/cloud however it was tuned. Beams have a single shared axis, so
   the eye reads a light SOURCE somewhere above the frame rather than a texture laid over it.

   It also suits the site: this is a video editor's portfolio, so a key light raking through haze
   is on-theme in a way that drifting weather never was.
   ========================================================================================= */
void main(){
  vec2  uv = vUv;              // NOTE uv.y == 1 is the TOP of the screen (vUv comes from clip space)
  float t  = uTime;

  /* ---- rake angle ----
     One angle shared by every shaft: that is what makes them read as one source. A very slow sway
     keeps it alive, and the cursor leans the whole rig a little — the interaction is now a shift in
     the LIGHTING, not something pushing a substance around. */
  float ang = 0.34 + 0.020 * sin(t * 0.043);
  ang += (uMouse.x - 0.5) * 0.10 * uStrength;
  float ca = cos(ang), sa = sin(ang);

  // Pivot at top-centre. x is aspect-scaled so shaft widths hold on any screen.
  vec2 rel = vec2((uv.x - 0.5) * uAspect, uv.y - 1.0);
  vec2 q   = vec2(rel.x * ca - rel.y * sa, rel.x * sa + rel.y * ca);

  /* ---- the shafts ----
     Four, deliberately UNEVEN in width, brightness and drift rate. Evenly spaced equal beams would
     read as a pattern or a texture; irregular spacing reads as physical light. Each drifts on its
     own slow sine with an offset phase so they never line up into a visible rhythm. */
  float s = 0.0;
  s += 1.00 * shaft(q.x, -0.68 + 0.030 * sin(t * 0.037       ), 0.120);
  s += 0.62 * shaft(q.x, -0.22 + 0.024 * sin(t * 0.029 + 1.70), 0.055);
  s += 0.86 * shaft(q.x,  0.24 + 0.028 * sin(t * 0.033 + 3.10), 0.165);
  s += 0.44 * shaft(q.x,  0.74 + 0.022 * sin(t * 0.041 + 5.20), 0.085);

  /* ---- along-shaft falloff ----
     Full strength where the light enters at the top, gone before the lower third. This is what
     keeps the body copy — which lives in the middle and lower part of the page — on clean black. */
  float along = pow(smoothstep(-0.90, -0.02, q.y), 1.9);

  // Haze drifting slowly UP the beams, so the movement is along the light rather than across it.
  float dust = 0.66 + 0.50 * haze(vec2(q.x * 2.6, q.y * 1.15 - t * 0.016));

  float beams = s * along * dust;

  /* ---- spill where the shafts originate ----
     A soft bloom hugging the very top edge, so the beams look like they are entering the frame from
     a source just above it rather than being clipped off by it. */
  float spill = exp(-pow((1.0 - uv.y) / 0.17, 2.0));

  /* ---- cursor catch ----
     A soft local lift only. Nothing is displaced, nothing is carved: the cursor simply catches a
     little of the light, which suits a beam far better than pushing a medium around. */
  vec2  md = vec2((uv.x - uMouse.x) * uAspect, uv.y - uMouse.y);
  float catchLight = exp(-dot(md, md) * 6.0);

  /* ---- intensity ----
     Master gain kept low on purpose: the page must still read black, with the shafts as light in
     the room rather than a surface colour. Measured after tuning, not guessed. */
  float I = beams * 0.100
          + spill * 0.045
          + catchLight * (uStrength * 0.020 + uPresence * 0.010);
  I = clamp(I, 0.0, 1.0);

  /* ---- colour ----
     Base accent for the body of the light, lifting toward the brighter tint only in the hottest
     cores, with a whisper of the warm off-white right at the peak so the brightest points read as
     light rather than as blue paint. */
  vec3 col = uBg;
  col = mix(col, uAccent, I);
  col = mix(col, uAccentBright, clamp(pow(I, 1.9) * 2.1, 0.0, 1.0) * 0.55);
  col += uSage * pow(I, 4.5) * 0.10;

  // Ordered-ish dither. Gradients this smooth and this dark WILL band on 8-bit displays without it.
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (dither - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
`;

/** #rgb / #rrggbb -> linear-ish 0..1 triple. Returns null on anything unparseable. */
function hexToRgb(input: string): [number, number, number] | null {
  const s = input.trim().replace(/^#/, "");
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16);
    const g = parseInt(s[1] + s[1], 16);
    const b = parseInt(s[2] + s[2], 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return [r / 255, g / 255, b / 255];
  }
  if (s.length === 6) {
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return [r / 255, g / 255, b / 255];
  }
  return null;
}

function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: [number, number, number]) =>
    hexToRgb(cs.getPropertyValue(name)) ?? fallback;
  return {
    // Mirrors the :root tokens: #0f0f0f / #2e6f52 / #3fa37a / #d8e3d9 (the site's emerald theme,
    // restored after a since-reverted blue rebrand).
    // NOTE these are NORMALISED FLOATS, so a grep for hex or rgb() triplets will not find them —
    // they were missed by exactly such a search during the earlier palette swap, which is why this
    // fallback still described blue for a while even after the CSS tokens themselves were fixed.
    // Only reached if a CSS var is missing or unparseable; live values are read from CSS so the
    // theme tracks itself under normal operation.
    bg: pick("--bg", [0.059, 0.059, 0.059]),
    accent: pick("--accent", [0.18, 0.435, 0.322]),
    accentBright: pick("--accent-bright", [0.247, 0.639, 0.478]),
    sage: pick("--sage", [0.847, 0.89, 0.851]),
  };
}

export default function AtmosphericBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    /* DISABLED — the WebGL shader is switched off here, before touching the canvas at all, rather
       than deleted, so the elaborate cursor-reactive effect it implements stays available to
       re-enable later if wanted; the reasoning below is why it isn't being relied on right now.
       (`as boolean` widens the literal so this reads as a genuine runtime check rather than
       `if (false)`, which keeps every line below it exactly as type-checkable as it was before —
       bailing out any later, after canvas had already been narrowed non-null, broke that narrowing
       for the closures defined further down and produced real compile errors.)

       Root cause of "the two glows aren't there": the canvas was stuck at the browser's literal
       default backing-store size (300x150) instead of filling the viewport, because the only thing
       resizing it (a ResizeObserver) can fail to deliver a callback — confirmed directly earlier in
       this project (0 callbacks across a real, live layout change). A load-listener + settle-frame
       fallback were added to close that gap, and after that fix the canvas DID correctly fill the
       real viewport (measured: 864x540 backing store for a 1440x900 window, matching the 0.6 render
       scale exactly) with its render loop confirmed running.

       But sampling actual rendered pixels at that point (gl.readPixels, not a guess) showed the
       shader's own light intensity is close to imperceptible against the page's near-black
       background — brightest sampled pixel vs. darkest differed by only a handful of RGB units
       (e.g. rgb(17,20,19) vs rgb(15,15,15)). The canvas's own output is fully opaque
       (gl_FragColor's alpha is always 1.0), so once it is correctly sized it unavoidably paints
       over — and hides — the .atmos CSS gradient sitting underneath it, subtle or not: there was no
       way to make the visible result brighter without re-tuning constants buried in ~250 lines of
       GLSL, which cannot be verified without eyes on a real screen.
       The dependable fix is the opposite move: stop the canvas from painting at all (bailing here
       creates no WebGL context, starts no render loop — zero GPU/CPU cost, not just an invisible
       one), which lets the .atmos div's own CSS background — a plain, directly-verifiable
       radial-gradient — be the thing actually on screen, retuned to the position and intensity
       actually being asked for (see the .atmos rule in globals.css). */
    const ATMOS_SHADER_ENABLED = false as boolean;
    if (!ATMOS_SHADER_ENABLED) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = matchMedia("(pointer: coarse)").matches;
    const theme = readTheme();
    /* Octave budget for the in-beam haze — the shafts themselves are analytic and cost nothing, so
       this single fBm is now the shader's ONLY noise evaluation (down from up to 16 per fragment in
       the cloud version). Touch devices drop to 2 octaves; at phone pixel density that third octave
       is invisible inside a light beam. */
    const defines = coarse
      ? "#define DUST_FBM fbm2\n"
      : "#define DUST_FBM fbm3\n";

    /* GPU resources are rebuildable, not created once inline, because a WebGL context is not a
       guaranteed-permanent thing: driver resets, GPU process crashes, and (especially) mobile
       memory pressure all fire `webglcontextlost` in the wild. Without a restore path the canvas
       would stay dead for the rest of the session. Everything the GPU owns therefore lives in
       these mutable slots and is recreated by buildGL() on `webglcontextrestored`. */
    type Uniforms = Record<string, WebGLUniformLocation | null>;
    let gl: WebGLRenderingContext | null = null;
    let prog: WebGLProgram | null = null;
    let buf: WebGLBuffer | null = null;
    let U: Uniforms = {};
    let disposed = false;

    gl =
      (canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
        // The effect degrades gracefully to the CSS fallback gradient rather than forcing a
        // software rasteriser, which would be far worse than no effect at all.
        failIfMajorPerformanceCaveat: false,
      }) as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    // No WebGL (or context blocked): leave the CSS fallback gradient on the host element visible.
    if (!gl) return;

    function buildGL(): boolean {
      const g = gl;
      if (!g) return false;

      const compile = (type: number, src: string) => {
        const sh = g.createShader(type);
        if (!sh) return null;
        g.shaderSource(sh, src);
        g.compileShader(sh);
        if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) {
          console.error("[atmos] shader compile failed:", g.getShaderInfoLog(sh));
          g.deleteShader(sh);
          return null;
        }
        return sh;
      };

      const vs = compile(g.VERTEX_SHADER, VERT);
      const fs = compile(g.FRAGMENT_SHADER, defines + FRAG);
      if (!vs || !fs) return false;

      const p = g.createProgram();
      if (!p) return false;
      g.attachShader(p, vs);
      g.attachShader(p, fs);
      g.linkProgram(p);
      if (!g.getProgramParameter(p, g.LINK_STATUS)) {
        console.error("[atmos] program link failed:", g.getProgramInfoLog(p));
        return false;
      }
      g.useProgram(p);
      // Shaders are linked into the program; the objects themselves are no longer needed.
      g.deleteShader(vs);
      g.deleteShader(fs);
      prog = p;

      /* geometry: one oversized triangle covering the viewport.
         A triangle, not a quad: no diagonal seam, one fewer vertex, and no index buffer. */
      buf = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, buf);
      g.bufferData(
        g.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        g.STATIC_DRAW
      );
      const aPos = g.getAttribLocation(p, "aPos");
      g.enableVertexAttribArray(aPos);
      g.vertexAttribPointer(aPos, 2, g.FLOAT, false, 0, 0);

      U = {
        time: g.getUniformLocation(p, "uTime"),
        aspect: g.getUniformLocation(p, "uAspect"),
        mouse: g.getUniformLocation(p, "uMouse"),
        strength: g.getUniformLocation(p, "uStrength"),
        presence: g.getUniformLocation(p, "uPresence"),
        bg: g.getUniformLocation(p, "uBg"),
        accent: g.getUniformLocation(p, "uAccent"),
        accentBright: g.getUniformLocation(p, "uAccentBright"),
        sage: g.getUniformLocation(p, "uSage"),
      };

      g.uniform3fv(U.bg, theme.bg);
      g.uniform3fv(U.accent, theme.accent);
      g.uniform3fv(U.accentBright, theme.accentBright);
      g.uniform3fv(U.sage, theme.sage);
      /* SEED THE ASPECT IMMEDIATELY, from the drawing buffer rather than from layout.
         uAspect must never be left at its default of 0: the shaft geometry multiplies the across-
         beam coordinate by it, so an aspect of 0 collapses that axis entirely and the whole effect
         degenerates into a purely vertical gradient — flat across the screen, no beams at all.
         resize() legitimately declines to run when the element measures 0 (see its guard), so
         relying on resize alone to supply this leaves a window where it is still 0. The canvas
         always has a non-zero drawing buffer (300x150 by default), so this is always safe and is
         corrected the moment a real measurement arrives. */
      const cv = canvasRef.current;
      if (cv) g.uniform1f(U.aspect, cv.width / Math.max(1, cv.height));
      return true;
    }

    if (!buildGL()) return;

    /* ---- sizing ----
       Render below CSS resolution: this field has no high-frequency detail whatsoever, so the
       upscale is imperceptible while fragment cost falls with the SQUARE of the scale.
       0.60 rather than 0.70 on desktop: measured (amortized GPU-bound timing, 400 queued draws
       with a single sync) this shader costs ~2.9ms/frame at 0.70 on a mid desktop Radeon — 17% of
       a 60fps budget, and integrated graphics run several times slower than that. 0.60 takes ~27%
       straight off for detail that is genuinely invisible at this opacity and softness. */
    let renderScale = coarse ? 0.45 : 0.6;
    let cssW = 0;
    let cssH = 0;

    function resize() {
      if (!gl || !canvas) return;
      // Prefer the canvas's own laid-out box and fall back to the window. Either can legitimately
      // report 0 before first layout.
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width) || window.innerWidth;
      const h = Math.round(rect.height) || window.innerHeight;
      /* BAIL ON A ZERO-SIZED VIEWPORT — do not bake it in.
         Without this the Math.max(1, ...) clamps below silently produced a 1x1 drawing buffer and
         an aspect of 0, i.e. the whole effect collapsed to ONE flat colour stretched across the
         screen, and it stayed that way because nothing re-ran resize afterwards. That is not
         hypothetical: it is exactly what happened when the component mounted while the viewport
         still measured 0 (a tab/pane that had not been laid out yet). Returning early leaves the
         previous good size in place and lets the ResizeObserver below fix it once layout lands. */
      if (w < 2 || h < 2) return;
      cssW = w;
      cssH = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.max(2, Math.round(w * dpr * renderScale));
      const bh = Math.max(2, Math.round(h * dpr * renderScale));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, bw, bh);
      gl.uniform1f(U.aspect, w / h);
    }
    resize();

    /* A window `resize` event is NOT sufficient on its own: if the element is laid out late (hidden
       tab, deferred pane, late font/layout settle) no resize event ever fires and the canvas keeps
       whatever size it had at mount. Observing the element itself catches that. */
    const sizeObserver = new ResizeObserver(() => {
      resize();
      drawStill();
    });
    sizeObserver.observe(canvas);

    /* ResizeObserver is NOT sufficient on its own — measured directly: in at least one real
       environment it delivered ZERO callbacks across a genuine, confirmed layout change (the same
       failure this project already hit and fixed for the Hero's own dock-geometry measurement, see
       SmoothScroll.tsx). resize()'s zero-size guard above means a delivery gap here doesn't just
       leave the canvas stale — it leaves it at the browser's literal default backing-store size
       (300x150), which is what was actually reported as "the glow isn't there any more": at that
       size the shader still renders, just compressed into a tiny fraction of the screen instead of
       filling it. These two triggers are redundant with the observer by design, not a replacement
       for it — cheap, idempotent (resize() no-ops if the size hasn't actually changed), and each
       catches a different gap:
         - "load" — fonts/images finishing after the observer's first callback can still shift
           layout once more.
         - a short rAF settle loop — covers the same "measured 0 at mount, no observer callback
           ever arrives to correct it" case the zero-size guard above documents, without waiting on
           any observer to eventually deliver one. */
    const onLoadResize = () => {
      resize();
      drawStill();
    };
    window.addEventListener("load", onLoadResize);
    let settleFrames = 0;
    let settleRaf = 0;
    const settleResize = () => {
      resize();
      drawStill();
      if (++settleFrames < 10) settleRaf = requestAnimationFrame(settleResize);
    };
    settleRaf = requestAnimationFrame(settleResize);

    /* ---- pointer state ----
       target = raw pointer. pos = exponentially eased follower (no velocity/spring — see frame()).
       strength = travel-derived push that fades over several seconds, so the deck drifts back. */
    const target = { x: 0.5, y: 0.5 };
    const pos = { x: 0.5, y: 0.5 };
    let strength = 0;
    let presence = 0;
    let pointerInside = false;
    let lastMoveT = 0;

    function onPointerMove(e: PointerEvent) {
      target.x = e.clientX / Math.max(1, cssW);
      // GL's y runs bottom-up; vUv is derived from clip space, so flip to match.
      target.y = 1 - e.clientY / Math.max(1, cssH);
      pointerInside = true;
      lastMoveT = performance.now();
    }
    function onPointerLeave() {
      pointerInside = false;
    }

    /* ---- frame loop ---- */
    // Queried once: the opaque hero the draw is skipped behind (see the occlusion skip in frame()).
    const heroEl = document.querySelector<HTMLElement>(".dock-wrap");
    let raf = 0;
    let running = false;
    let prevT = performance.now();
    let startT = prevT;

    // Adaptive quality: count sustained slow frames and step resolution down rather than drop FPS.
    let slowFrames = 0;
    let degraded = false;

    function frame(now: number) {
      if (!gl || gl.isContextLost()) {
        running = false;
        return;
      }
      // Clamp: a tab returning from background must not integrate one giant physics step.
      const dt = Math.min((now - prevT) / 1000, 1 / 30);
      prevT = now;

      if (!degraded && dt > 0.024) {
        if (++slowFrames > 45) {
          renderScale = Math.max(0.4, renderScale - 0.2);
          degraded = true; // step down once; never thrash back and forth
          resize();
        }
      } else if (dt <= 0.024) {
        slowFrames = Math.max(0, slowFrames - 1);
      }

      /* NO SPRING. A spring carries momentum, which means overshoot and a springy settle — the
         opposite of the requested "soft fog reacting to air movement". This is pure exponential
         easing with no velocity term whatsoever, so the position can never overshoot the pointer:
         it approaches asymptotically and stops. Frame-rate independent via the exp() form, so the
         feel is identical at 60Hz and 144Hz. */
      const prevX = pos.x;
      const prevY = pos.y;
      const ease = 1 - Math.exp(-dt * 3.2);
      pos.x += (target.x - pos.x) * ease;
      pos.y += (target.y - pos.y) * ease;

      // Strength from how far the SMOOTHED point actually travelled, so it inherits that smoothing.
      const moved = Math.hypot(pos.x - prevX, pos.y - prevY) / Math.max(dt, 1e-4);
      const wanted = Math.min(1, moved * 1.15);
      // Gentle rise, very slow fade (~6s) so the deck drifts back instead of snapping.
      const rate = wanted > strength ? 2.2 : 0.55;
      strength += (wanted - strength) * (1 - Math.exp(-dt * rate));

      const idle = now - lastMoveT > 120;
      const wantPresence = pointerInside && !idle ? 1 : pointerInside ? 0.55 : 0;
      presence += (wantPresence - presence) * (1 - Math.exp(-dt * 1.6));

      /* OCCLUSION SKIP — do not pay for a frame nobody can see.
         The site's hero (.dock-wrap) is a fully opaque, ~260vh pinned block; while it covers the
         viewport this canvas is completely hidden behind it. That stretch is also the single most
         performance-sensitive part of the page (the scroll-scrubbed video docking), so spending
         ~2.9ms of GPU there is the worst possible place to spend it.
         NOTE this replaces an IntersectionObserver on the canvas that could never work: the canvas
         is position:fixed inset:0, so it ALWAYS intersects the viewport and the observer could
         never fire a stop. Verified directly in-page before removing it.
         The physics above still integrates, so the field is already in the right state on exit. */
      if (heroEl) {
        const r = heroEl.getBoundingClientRect();
        if (r.top <= 0 && r.bottom >= window.innerHeight) {
          raf = requestAnimationFrame(frame);
          return;
        }
      }

      gl.uniform1f(U.time, (now - startT) / 1000);
      gl.uniform2f(U.mouse, pos.x, pos.y);
      gl.uniform1f(U.strength, strength);
      gl.uniform1f(U.presence, presence);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduce || disposed) return;
      if (!gl || gl.isContextLost()) return;
      running = true;
      prevT = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    }

    function drawStill() {
      if (!gl || gl.isContextLost()) return;
      gl.uniform1f(U.time, 0);
      gl.uniform2f(U.mouse, 0.5, 0.5);
      gl.uniform1f(U.strength, 0);
      gl.uniform1f(U.presence, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // Draw one frame immediately so first paint is never an empty canvas — this also means a
    // reduced-motion visitor gets the full composition, just held still.
    drawStill();

    /* Context loss/restore. preventDefault() on the lost event is REQUIRED — without it the
       browser will never fire `webglcontextrestored`, and the canvas stays permanently blank.
       While lost, the CSS fallback gradient on .atmos shows through (the canvas renders nothing),
       so the page degrades to the site's established static glow rather than to a flat void. */
    function onContextLost(e: Event) {
      e.preventDefault();
      stop();
      prog = null;
      buf = null;
      U = {};
    }
    function onContextRestored() {
      if (disposed) return;
      if (buildGL()) {
        resize();
        drawStill();
        start();
      }
    }
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    const onVisibility = () => (document.hidden ? stop() : start());

    if (!reduce) {
      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("pointerleave", onPointerLeave);
      document.addEventListener("visibilitychange", onVisibility);
      start();
    }

    // Small debug/verification handle, mirroring the existing `window.__lenis` convention.
    const handle = {
      get gl() {
        return gl;
      },
      canvas,
      isRunning: () => running,
      renderScale: () => renderScale,
      program: () => prog,
      state: () => ({ pos: { ...pos }, strength, presence }),
    };
    (window as unknown as Record<string, unknown>).__atmos = handle;

    return () => {
      disposed = true;
      stop();
      sizeObserver.disconnect();
      window.removeEventListener("load", onLoadResize);
      cancelAnimationFrame(settleRaf);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      if (gl) {
        gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
        // Free the drawing buffer immediately rather than waiting on GC — browsers cap the number
        // of live WebGL contexts, and dev hot-reload remounts this effect repeatedly. The listener
        // is removed just above, so this cannot re-enter onContextLost.
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
      gl = null;
      // Only clear the global if it is still OURS. Under React StrictMode / Fast Refresh a newer
      // instance can mount before this cleanup runs; deleting unconditionally would strip the live
      // instance's handle and leave the page pointing at nothing.
      const w = window as unknown as Record<string, unknown>;
      if (w.__atmos === handle) delete w.__atmos;
    };
  }, []);

  return (
    <div className="atmos" aria-hidden="true">
      <canvas ref={canvasRef} className="atmos-canvas" />
    </div>
  );
}

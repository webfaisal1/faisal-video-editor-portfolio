// Auto-extracted faithful markup for the "popup" section from the original single-file build.
// Injected via dangerouslySetInnerHTML so the production-tuned DOM/CSS is preserved exactly;
// interactive behavior is re-homed into the matching React component's effect.
//
// PLAYBACK IS A YOUTUBE IFRAME (moved off local .mp4 files), and the surrounding markup exists to
// hide YouTube's own UI completely. Why it takes three elements instead of just an <iframe>:
//
//   modestbranding=1 DOES NOT WORK. YouTube deprecated it — it is parsed and ignored. There is no
//   embed parameter that removes the title, channel avatar, uploader name, or the YouTube wordmark
//   from a standard embed. Those overlays are rendered inside YouTube's own cross-origin document,
//   so CSS here cannot touch them either. They can only be prevented from ever being triggered:
//
//   .lf-shield  a transparent layer over the iframe. YouTube only paints the title/avatar overlay
//               on hover or pause, so intercepting every pointer event before it reaches the
//               iframe means that overlay never appears at all. The shield is also what gives the
//               viewer play/pause back (it messages the player directly — see VideoPopup.tsx),
//               so removing YouTube's chrome does not cost any control.
//   .lf-cover   the card's own poster image, shown on top while the player boots and faded out
//               once it is running. This covers the one moment the shield cannot: the ~1s at
//               startup where YouTube shows the title before it auto-hides.
//
// The iframe carries no src until a card is clicked, so no YouTube request (and no cookie) is made
// on page load.
// The close button is deliberately the LAST child of .lf-modal, after .lf-frame-wrap. It has a
// higher z-index than .lf-shield (5 vs 3) which alone should be enough, but painting order is the
// tie-breaker at equal z-index and the shield deliberately covers the entire modal — putting the
// button last means it wins on BOTH axes, so a click on ✕ can never be swallowed by the shield.
const html = "<div class=\"lf-overlay\" id=\"lfOverlay\" aria-hidden=\"true\">\n  <div class=\"lf-backdrop\" id=\"lfBackdrop\"></div>\n  <div class=\"lf-modal\" id=\"lfModal\">\n    <div class=\"lf-frame-wrap\">\n      <iframe id=\"lfFrame\" title=\"Video player\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>\n      <div class=\"lf-cover\" id=\"lfCover\"></div>\n      <div class=\"lf-shield\" id=\"lfShield\" role=\"button\" tabindex=\"0\" aria-label=\"Play or pause\"></div>\n    </div>\n    <button type=\"button\" class=\"lf-close\" id=\"lfClose\" aria-label=\"Close video\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M6 6l12 12M18 6L6 18\"/></svg></button>\n  </div>\n</div>";
export default html;

// Auto-extracted faithful markup for the "faq" section from the original single-file build.
// Injected via dangerouslySetInnerHTML so the production-tuned DOM/CSS is preserved exactly;
// interactive behavior is re-homed into the matching React component's effect.
//
// REDESIGN: the side image column (sticky box + 7 cross-faded <img> layers, swapped on
// click/hover) is removed entirely, matching scalewithcam.com/#reviews's single-column,
// full-width divided-row FAQ style. Header, question/answer copy, and accordion behavior are
// unchanged; .faq-list is now the layout container itself (centered, narrower than the site's
// full container width), each .faq-item is a plain full-width row with a bottom divider instead
// of a boxed card.
const html = `<section class="sec" id="faq">
  <div class="container">
    <div class="sec-head">
      <span class="eyebrow reveal">FAQ</span>
      <h2 class="reveal d1">Frequently<br /><span class="m">Asked Questions</span></h2>
      <p class="sec-sub reveal d2">Have questions? This FAQ section covers everything you need to know about my video editing services and process.</p>
    </div>

    <div class="faq-list reveal d3">
      <div class="faq-item" data-faq-index="0">
        <button type="button" class="faq-q">What types of real estate videos do you edit?<span class="faq-icon"></span></button>
        <div class="faq-a"><div class="faq-a-inner">Listing walkthroughs, neighborhood and community tours, agent brand and documentary content for YouTube, and short-form Reels, TikToks, and Shorts. Whether it's a single property or an ongoing content series, I tailor the edit to your market and audience.</div></div>
      </div>
      <div class="faq-item" data-faq-index="1">
        <button type="button" class="faq-q">How long does it take to complete a project?<span class="faq-icon"></span></button>
        <div class="faq-a"><div class="faq-a-inner">Most short-form videos are delivered within 24 to 48 hours, and long-form projects typically take 3 to 5 days depending on length and complexity. Rush delivery is available when you're on a tight listing deadline.</div></div>
      </div>
      <div class="faq-item" data-faq-index="2">
        <button type="button" class="faq-q">Do you offer revisions?<span class="faq-icon"></span></button>
        <div class="faq-a"><div class="faq-a-inner">Yes, free revisions until you're 100% happy. I'd rather get it exactly right than call it "done" too early. Clear feedback keeps the rounds fast and painless.</div></div>
      </div>
      <div class="faq-item" data-faq-index="3">
        <button type="button" class="faq-q">What footage do I need to provide?<span class="faq-icon"></span></button>
        <div class="faq-a"><div class="faq-a-inner">Whatever you've got: phone clips, drone shots, DSLR footage, or a mix of all three. Send it over via Google Drive, Dropbox, or Frame.io along with any brand assets, and I'll handle the rest.</div></div>
      </div>
      <div class="faq-item" data-faq-index="4">
        <button type="button" class="faq-q">What software do you use?<span class="faq-icon"></span></button>
        <div class="faq-a"><div class="faq-a-inner">Mainly Adobe Premiere Pro and After Effects for motion graphics, with DaVinci Resolve for color grading. The tools are just there to serve the story, you just get a polished final video.</div></div>
      </div>
      <div class="faq-item" data-faq-index="5">
        <button type="button" class="faq-q">What are your rates?<span class="faq-icon"></span></button>
        <div class="faq-a"><div class="faq-a-inner">Pricing depends on scope, length, and turnaround. I offer per-project rates and monthly retainers for agents who need consistent content. Book a quick call and I'll send over a tailored quote.</div></div>
      </div>
      <div class="faq-item" data-faq-index="6">
        <button type="button" class="faq-q">Can you match my brand's style?<span class="faq-icon"></span></button>
        <div class="faq-a"><div class="faq-a-inner">Absolutely. Share your colors, fonts, logo, and a few reference videos you love, and I'll build a consistent look that carries across every video so your brand stays instantly recognizable.</div></div>
      </div>
    </div>
  </div>
</section>

<!-- ===================== SECTION — CONTACT (Part 7) ===================== -->
<!-- Structure modeled on montagemotion.com's contact block, rendered in this site's dark theme
     (chosen over a light card so it stays consistent with every section above/below). -->`;
export default html;

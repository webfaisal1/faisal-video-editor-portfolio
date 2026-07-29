// Auto-extracted faithful markup for the "contact" section from the original single-file build.
// Injected via dangerouslySetInnerHTML so the production-tuned DOM/CSS is preserved exactly;
// interactive behavior is re-homed into the matching React component's effect.
//
// PREMIUM PASS: the 3 contact-method rows previously had no individual reveal (only the whole
// .contact-card faded in as one block). Added reveal/d1/d2/d3 directly to each row, matching
// the exact same CSS-class stagger pattern Services' 3 cards already use, rather than a
// redundant JS watcher for a group this small.
const html = `<section class="sec" id="contact">
  <div class="container">
    <div class="sec-head">
      <span class="eyebrow reveal">Contact Us</span>
      <h2 class="reveal d1">Have a Project?<br /><span class="m">Let's Talk</span></h2>
      <p class="sec-sub reveal d2">Tell me about your footage and your goals. I'll get back to you fast with the best way to move forward.</p>
    </div>

    <div class="contact-card reveal d3">
      <div class="contact-methods">
        <a class="contact-item reveal" href="mailto:realtor.editor.faisal@gmail.com">
          <span class="contact-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></span>
          <span class="contact-item-label">Email Us</span>
        </a>
        <!-- Verified Simple Icons WhatsApp glyph. Its path bbox centre is (11.996, 12) of the
             0 0 24 24 viewBox, i.e. already dead centre; it is sized down via svg.ic-whatsapp
             (width/height only, see globals.css) to match ink weight, never nudged. -->
        <a class="contact-item reveal d1" href="https://wa.me/8801619816171" target="_blank" rel="noopener">
          <span class="contact-item-icon"><svg viewBox="0 0 24 24" fill="currentColor" class="ic-whatsapp"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.298-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .16 5.304.16 11.887c0 2.096.548 4.142 1.588 5.945L.057 24l6.305-1.654a11.89 11.89 0 0 0 5.683 1.448h.005c6.582 0 11.885-5.304 11.885-11.887 0-3.176-1.24-6.163-3.415-8.458"/></svg></span>
          <span class="contact-item-label">WhatsApp Us</span>
        </a>
        <a class="contact-item reveal d2" href="https://t.me/itsmemohammadfaisal" target="_blank" rel="noopener">
          <span class="contact-item-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.94 4.6 18.9 19.2c-.23 1.02-.84 1.27-1.7.79l-4.7-3.46-2.27 2.18c-.25.25-.46.46-.94.46l.33-4.78 8.7-7.86c.38-.34-.08-.53-.59-.19L6.98 13.2l-4.63-1.45c-1.01-.32-1.03-1.01.21-1.5l18.1-6.98c.84-.31 1.57.2 1.28 1.33z"/></svg></span>
          <span class="contact-item-label">Telegram</span>
        </a>
        <a class="contact-item reveal d3" href="https://calendly.com/editor-faisal/video-strategy-editing-consultant" target="_blank" rel="noopener">
          <span class="contact-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></span>
          <span class="contact-item-label">Book a Call</span>
        </a>
      </div>

      <!-- Message form. DELIVERY: Formspree (free tier). Replace the form ID in the action URL
           with your own after creating a free account, see the note printed below + chat. -->
      <form class="cform" id="contactForm" action="https://formspree.io/f/mwvgvykl" method="POST">
        <div class="field">
          <label for="cf-name">Full Name</label>
          <input id="cf-name" type="text" name="name" placeholder="Your name" required />
        </div>
        <div class="field">
          <label for="cf-email">Email</label>
          <input id="cf-email" type="email" name="email" placeholder="you@example.com" required />
        </div>
        <div class="field">
          <label for="cf-msg">Message</label>
          <textarea id="cf-msg" name="message" placeholder="Tell me about your project…" required></textarea>
        </div>
        <input type="hidden" name="_subject" value="New project enquiry from portfolio site" />
        <button type="submit" class="btn btn-primary">Send Message
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"/></svg>
        </button>
        <p class="cform-note" id="cfNote">Messages are delivered to realtor.editor.faisal@gmail.com.</p>
      </form>
    </div>
  </div>
</section>

<!-- FIX 10: Book a Call / Calendly section removed entirely (its embed rendered with its own
     light theme that broke the site's dark aesthetic). All internal links/CTAs that used to
     point at #book now go to #contact instead; the external Calendly link itself was only ever
     used by the About section's "Book A Call" button, which still opens Calendly directly in a
     new tab (a plain external link isn't themed by this page, so it doesn't have the same
     jarring-embed problem the inline widget did). -->

<!-- ===================== FOOTER (Part 9, rebuilt Fix 11) ===================== -->
<!-- FIX 11: rebuilt footer. Centered brand mark, centered headline, one centered row of 8
     platform icons (Email / WhatsApp / Telegram / LinkedIn / Facebook / X / TikTok / YouTube,
     in that order), centered copyright. The old Explore/Connect two-column links are gone. -->`;
export default html;

"use client";

import { useEffect, useRef } from "react";
import html from "@/content/contact";

/**
 * Contact: centered method rows (no raw contact values printed) + Formspree AJAX form.
 * Wired to the real Formspree endpoint (https://formspree.io/f/mwvgvykl, set in content/contact.ts).
 * The form submits async, no page reload, name/email/message fields POST as FormData.
 */
export default function Contact() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const form = root.querySelector<HTMLFormElement>("#contactForm");
    if (!form) return;
    const note = root.querySelector<HTMLElement>("#cfNote");

    const onSubmit = async (e: Event) => {
      e.preventDefault();
      if (!note) return;
      const btn = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = "Sending…";
      try {
        const res = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          form.reset();
          note.textContent = "✓ Thanks! Your message has been sent, I'll reply shortly.";
          note.style.color = "var(--accent)";
        } else {
          note.textContent =
            "Something went wrong. Please email realtor.editor.faisal@gmail.com directly.";
          note.style.color = "#ff8080";
        }
      } catch {
        note.textContent =
          "Network error. Please email realtor.editor.faisal@gmail.com directly.";
        note.style.color = "#ff8080";
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    };

    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  return (
    <div style={{ display: "contents" }} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

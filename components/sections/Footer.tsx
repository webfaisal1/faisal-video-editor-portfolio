"use client";

import { useEffect, useRef } from "react";
import html from "@/content/footer";

// Footer: top row (brand + "for queries" email + LinkedIn/X/YouTube), full-width "Ready When
// You Are." headline, bottom divider row (rights + tagline). Animated hover background is pure
// CSS. This component only fills in the live copyright year.
export default function Footer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const y = ref.current?.querySelector("#footYear");
    if (y) y.textContent = String(new Date().getFullYear());
  }, []);

  return (
    <div style={{ display: "contents" }} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

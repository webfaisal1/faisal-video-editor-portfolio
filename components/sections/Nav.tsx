"use client";

import { useEffect, useRef } from "react";
import html from "@/content/nav";

// Fixed nav + mobile menu. The nav's scroll-reveal (opacity/transform) is driven by the
// docking ScrollTrigger in SmoothScroll; this component only wires the burger menu toggle.
export default function Nav() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const burger = root.querySelector<HTMLButtonElement>("#burger");
    const mm = document.getElementById("mobileMenu");
    if (!burger || !mm) return;

    const toggle = () => {
      mm.classList.toggle("open");
      burger.classList.toggle("active");
      document.body.style.overflow = mm.classList.contains("open") ? "hidden" : "";
    };
    burger.addEventListener("click", toggle);

    const links = Array.from(mm.querySelectorAll("a"));
    const closeMenu = () => {
      mm.classList.remove("open");
      document.body.style.overflow = "";
    };
    links.forEach((a) => a.addEventListener("click", closeMenu));

    return () => {
      burger.removeEventListener("click", toggle);
      links.forEach((a) => a.removeEventListener("click", closeMenu));
    };
  }, []);

  return (
    <div style={{ display: "contents" }} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

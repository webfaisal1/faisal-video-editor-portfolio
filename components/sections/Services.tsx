import Raw from "@/components/Raw";
import html from "@/content/serv";

// Static section (no interactive behavior of its own): the global .reveal observer in
// SmoothScroll animates it in, and any marquees are pure CSS. Markup preserved verbatim.
export default function Services() {
  return <Raw html={html} />;
}

// Static section renderer.
// Renders faithful, production-tuned markup migrated from the original single-file build.
// The wrapper uses `display:contents` so it generates no box of its own: the injected
// <section> behaves exactly as a direct child of the page, preserving all layout/spacing.
export default function Raw({ html }: { html: string }) {
  return (
    <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

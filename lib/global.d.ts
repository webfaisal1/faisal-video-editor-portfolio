// Cross-section imperative bridge, kept from the original single-file build:
//  - __lenis lets any section stop/start smooth scroll (e.g. when the video popup is open)
//  - __openVideoPopup is the shared Long Form popup opener that Short Form also calls
export {};

declare global {
  interface Window {
    __lenis?: {
      stop: () => void;
      start: () => void;
      scrollTo: (target: Element | number | string, opts?: unknown) => void;
    };
    // Takes a YouTube video id (playback moved from local .mp4 files to YouTube embeds) and the
    // aspect ratio the modal should open at — "16/9" for long form, "9/16" for short form. Aspect
    // has to be passed in because a cross-origin iframe exposes no intrinsic dimensions, unlike
    // the <video> element this replaced.
    __openVideoPopup?: (
      ytId: string,
      originEl: Element | null,
      aspect?: string | number
    ) => void;
  }
}

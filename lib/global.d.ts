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
    __openVideoPopup?: (
      src: string,
      originEl: Element | null,
      startUnmuted: boolean
    ) => void;
  }
}

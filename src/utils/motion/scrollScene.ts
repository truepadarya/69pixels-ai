import { ScrollTrigger } from "gsap/ScrollTrigger";

let refreshFrame = 0;

export const refreshScrollLayout = () => {
  cancelAnimationFrame(refreshFrame);
  refreshFrame = requestAnimationFrame(() => {
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  });
};

export const mountScrollScene = (
  selector: string,
  initialize: (root: HTMLElement) => (() => void) | undefined,
) => {
  const instances = new Map<HTMLElement, () => void>();
  let generation = 0;
  const start = async () => {
    const current = ++generation;
    await document.fonts.ready;
    if (current !== generation) return;
    document.querySelectorAll<HTMLElement>(selector).forEach((root) => {
      if (instances.has(root)) return;
      const cleanup = initialize(root);
      if (cleanup) instances.set(root, cleanup);
    });
    refreshScrollLayout();
  };
  const stop = () => {
    generation++;
    instances.forEach((cleanup) => cleanup());
    instances.clear();
  };
  start();
  window.addEventListener("load", refreshScrollLayout, { once: true });
  document.addEventListener("astro:page-load", start);
  document.addEventListener("astro:before-swap", stop);
};

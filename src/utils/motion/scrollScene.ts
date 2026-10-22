import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let refreshFrame = 0;
let pageActive = true;
const scenes = new Set<{ start: () => void; stop: () => void }>();

export const refreshScrollLayout = () => {
  cancelAnimationFrame(refreshFrame);
  if (!pageActive) return;
  refreshFrame = requestAnimationFrame(() => {
    if (!pageActive || ScrollTrigger.getAll().length === 0) return;
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  });
};

const stopScenes = () => {
  pageActive = false;
  cancelAnimationFrame(refreshFrame);
  scenes.forEach((scene) => scene.stop());
};
const startScenes = () => {
  pageActive = true;
  scenes.forEach((scene) => scene.start());
};
const restoreScenes = (event: PageTransitionEvent) => {
  if (event.persisted) startScenes();
};

window.addEventListener("pagehide", stopScenes);
window.addEventListener("pageshow", restoreScenes);
window.addEventListener("load", refreshScrollLayout, { once: true });
document.addEventListener("astro:page-load", startScenes);
document.addEventListener("astro:before-swap", stopScenes);

if (import.meta.hot) {
  import.meta.hot.on("vite:beforeFullReload", stopScenes);
  import.meta.hot.dispose(() => {
    stopScenes();
    scenes.clear();
    window.removeEventListener("pagehide", stopScenes);
    window.removeEventListener("pageshow", restoreScenes);
    window.removeEventListener("load", refreshScrollLayout);
    document.removeEventListener("astro:page-load", startScenes);
    document.removeEventListener("astro:before-swap", stopScenes);
    import.meta.hot?.off("vite:beforeFullReload", stopScenes);
  });
}

export const mountScrollScene = (
  selector: string,
  initialize: (root: HTMLElement) => (() => void) | undefined,
) => {
  const instances = new Map<HTMLElement, () => void>();
  let generation = 0;
  const start = async () => {
    if (!pageActive) return;
    const current = ++generation;
    await document.fonts.ready;
    if (current !== generation || !pageActive) return;
    document.querySelectorAll<HTMLElement>(selector).forEach((root) => {
      if (instances.has(root)) return;
      let cleanup: (() => void) | undefined;
      const context = gsap.context(() => {
        cleanup = initialize(root);
      }, root);
      instances.set(root, () => {
        cleanup?.();
        context.revert();
      });
    });
    refreshScrollLayout();
  };
  const stop = () => {
    generation++;
    instances.forEach((cleanup) => cleanup());
    instances.clear();
  };
  const scene = { start, stop };
  scenes.add(scene);
  start();
  return () => {
    stop();
    scenes.delete(scene);
  };
};

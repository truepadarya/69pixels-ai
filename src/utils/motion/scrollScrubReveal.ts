import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "./preferences";

gsap.registerPlugin(ScrollTrigger);

const createScrollScrubReveal = (root: HTMLElement) => {
  const items = [
    ...(root.matches("[data-scroll-reveal]") ? [root] : []),
    ...gsap.utils.toArray<HTMLElement>("[data-scroll-reveal]", root),
  ];
  const trigger =
    root.querySelector<HTMLElement>("[data-scroll-reveal-trigger]") ?? root;

  if (items.length === 0 || prefersReducedMotion()) return;

  gsap.set(items, {
    autoAlpha: 0,
    y: "var(--reveal-distance-main)",
    filter: "blur(0.25rem)",
  });

  const timeline = gsap.timeline({
    defaults: { ease: "power2.out" },
    scrollTrigger: {
      trigger,
      start: "top 88%",
      end: "top 30%",
      scrub: 0.35,
      invalidateOnRefresh: true,
    },
  });

  timeline.to(items, {
    autoAlpha: 1,
    y: 0,
    filter: "blur(0rem)",
    duration: 1,
    stagger: 0.35,
  });

  return () => {
    timeline.scrollTrigger?.kill();
    timeline.kill();
    gsap.set(items, { clearProps: "opacity,visibility,transform,filter" });
  };
};

export const initScrollScrubReveals = (scope: ParentNode = document) => {
  const roots = [
    ...scope.querySelectorAll<HTMLElement>("[data-scroll-reveal-group]"),
    ...Array.from(
      scope.querySelectorAll<HTMLElement>("[data-scroll-reveal]"),
    ).filter((item) => !item.closest("[data-scroll-reveal-group]")),
  ];
  const cleanups = roots.map(createScrollScrubReveal).filter(Boolean);

  return () => cleanups.forEach((cleanup) => cleanup?.());
};

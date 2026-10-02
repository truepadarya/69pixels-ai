const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

export const prefersReducedMotion = () =>
  window.matchMedia(reducedMotionQuery).matches;

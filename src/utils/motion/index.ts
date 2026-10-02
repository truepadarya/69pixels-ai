import { initReveals } from "./reveal";
import { initScrollScrubReveals } from "./scrollScrubReveal";

export const initMotion = (scope: ParentNode = document) => {
  const cleanups = [initReveals(scope), initScrollScrubReveals(scope)];

  return () => cleanups.forEach((cleanup) => cleanup());
};

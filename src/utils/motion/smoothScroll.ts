import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";

export const initSmoothScroll = () => {
  const lenis = new Lenis({ autoRaf: true, anchors: false });
  lenis.on("scroll", ScrollTrigger.update);
  let frame = 0;

  const getTarget = (hash: string) => {
    try {
      return document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch {
      return null;
    }
  };

  const navigate = (target: HTMLElement, immediate = false) => {
    ScrollTrigger.refresh();
    lenis.resize();
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const padding =
      parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) ||
      0;
    const destination =
      target.getBoundingClientRect().top + window.scrollY - margin - padding;
    lenis.scrollTo(destination, {
      immediate,
      duration: 0.9,
      force: true,
      onComplete: () => ScrollTrigger.update(),
    });
  };

  const onClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = event
      .composedPath()
      .find(
        (node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement,
      );
    if (
      !link ||
      link.hasAttribute("download") ||
      (link.target && link.target !== "_self")
    )
      return;
    const url = new URL(link.href);
    if (
      url.origin !== location.origin ||
      url.pathname !== location.pathname ||
      url.search !== location.search ||
      !url.hash
    )
      return;
    const target = getTarget(url.hash);
    if (!target) return;
    event.preventDefault();
    if (location.hash !== url.hash) history.pushState(null, "", url.hash);
    navigate(target);
  };

  const alignHash = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const target = getTarget(location.hash);
      if (target) navigate(target, true);
    });
  };

  document.addEventListener("click", onClick);
  window.addEventListener("hashchange", alignHash);
  if (document.readyState === "complete") alignHash();
  else window.addEventListener("load", alignHash, { once: true });

  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("click", onClick);
    window.removeEventListener("hashchange", alignHash);
    window.removeEventListener("load", alignHash);
    lenis.destroy();
  };
};

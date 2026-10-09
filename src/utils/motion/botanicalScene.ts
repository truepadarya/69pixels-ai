import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { mountScrollScene } from "@/utils/motion/scrollScene";

gsap.registerPlugin(ScrollTrigger);

mountScrollScene("[data-botanical-scene]", (root) => {
  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    const decoration = root.querySelectorAll("[data-botanical-reveal]");
    const leaves = root.querySelectorAll("[data-botanical-leaves]");
    const shadow = root.querySelector("[data-botanical-shadow]");
    gsap.from(decoration, {
      opacity: 0,
      duration: 0.8,
      ease: "power2.out",
      scrollTrigger: { trigger: root, start: "top 90%", once: true },
    });
    gsap.fromTo(
      leaves,
      { y: "0rem" },
      {
        y: "-1.5rem",
        ease: "none",
        scrollTrigger: {
          trigger: root,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      },
    );
    gsap.fromTo(
      shadow,
      { y: "0rem" },
      {
        y: "-0.5rem",
        ease: "none",
        scrollTrigger: {
          trigger: root,
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
          invalidateOnRefresh: true,
        },
      },
    );
  });
  return () => media.revert();
});

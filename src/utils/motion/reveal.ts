import { prefersReducedMotion } from "./preferences";

type RevealElement = HTMLElement & {
  dataset: DOMStringMap & {
    revealStagger?: "fast" | "main";
  };
};

const staggerDuration = {
  fast: "var(--motion-stagger-fast)",
  main: "var(--motion-stagger-main)",
} as const;

const prepareItems = (items: RevealElement[], stagger?: "fast" | "main") => {
  items.forEach((item, index) => {
    item.dataset.motionReady = "";

    if (stagger) {
      item.style.setProperty(
        "--_reveal-delay",
        `calc(${index} * ${staggerDuration[stagger]})`,
      );
    }
  });
};

const completeReveal = (item: RevealElement) => {
  delete item.dataset.motionReady;
  item.classList.remove("is-revealed");
  item.style.removeProperty("--_reveal-delay");
};

const revealItems = (items: RevealElement[]) => {
  requestAnimationFrame(() => {
    items.forEach((item) => {
      const onAnimationEnd = (event: AnimationEvent) => {
        if (
          event.animationName !== "reveal-in" &&
          event.animationName !== "reveal-clip-in"
        )
          return;

        completeReveal(item);
        item.removeEventListener("animationend", onAnimationEnd);
      };

      item.addEventListener("animationend", onAnimationEnd);
      item.classList.add("is-revealed");
    });
  });
};

export const initReveals = (scope: ParentNode = document) => {
  const groups = Array.from(
    scope.querySelectorAll<RevealElement>("[data-reveal-group]"),
  );
  const standaloneItems = Array.from(
    scope.querySelectorAll<RevealElement>("[data-reveal]"),
  ).filter((item) => !item.closest("[data-reveal-group]"));
  const observed = new Map<Element, RevealElement[]>();
  const pageReadyItems: RevealElement[] = [];

  groups.forEach((group) => {
    const items = Array.from(
      group.querySelectorAll<RevealElement>("[data-reveal]"),
    ).filter((item) => item.closest("[data-reveal-group]") === group);
    const stagger = group.dataset.revealStagger;

    prepareItems(
      items,
      stagger === "fast" || stagger === "main" ? stagger : undefined,
    );
    if (group.dataset.revealTrigger === "page-ready") {
      pageReadyItems.push(...items);
    } else {
      observed.set(group, items);
    }
  });

  standaloneItems.forEach((item) => {
    prepareItems([item]);
    observed.set(item, [item]);
  });

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    observed.forEach((items) => items.forEach(completeReveal));
    pageReadyItems.forEach(completeReveal);
    return () => {};
  }

  const revealPageReadyItems = () => revealItems(pageReadyItems);

  if (document.documentElement.classList.contains("is-page-reveal-ready")) {
    revealPageReadyItems();
  } else {
    document.addEventListener("page:ready", revealPageReadyItems, {
      once: true,
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        revealItems(observed.get(entry.target) ?? []);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12%", threshold: 0.05 },
  );

  observed.forEach((_items, trigger) => observer.observe(trigger));

  return () => {
    observer.disconnect();
    document.removeEventListener("page:ready", revealPageReadyItems);
  };
};

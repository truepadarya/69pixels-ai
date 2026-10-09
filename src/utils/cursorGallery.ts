import { gsap } from "gsap";

type GalleryImage = { src: string };

export const initCursorGallery = (
  preview: HTMLElement,
  image: HTMLImageElement,
  setMode: (enabled: boolean) => void,
  dotSize: () => number,
) => {
  let target: HTMLElement | null = null;
  let images: GalleryImage[] = [];
  let index = 0;
  let timer = 0;
  let generation = 0;
  let animation: gsap.core.Tween | undefined;
  let imageAnimation: gsap.core.Tween | undefined;
  let x = 0;
  let y = 0;
  const reveal = { progress: 0 };
  const ready = new Map<string, Promise<boolean>>();

  const load = (src: string) => {
    let promise = ready.get(src);
    if (!promise) {
      const loader = new Image();
      loader.src = src;
      promise = loader.decode().then(
        () => true,
        () => false,
      );
      ready.set(src, promise);
    }
    return promise;
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement))
          return;
        try {
          const assets = JSON.parse(
            entry.target.dataset.cursorGallery ?? "[]",
          ) as GalleryImage[];
          assets.slice(0, 2).forEach((asset) => {
            void load(asset.src);
          });
        } catch {}
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "100% 0px" },
  );
  document
    .querySelectorAll<HTMLElement>("[data-cursor-gallery]")
    .forEach((element) => observer.observe(element));

  const place = () => {
    const left = Math.max(
      0,
      Math.min(x, window.innerWidth - preview.offsetWidth - 4),
    );
    const top = Math.max(
      0,
      Math.min(y, window.innerHeight - preview.offsetHeight - 4),
    );
    preview.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  };

  const renderReveal = () => {
    const inset =
      Math.max(0, preview.offsetHeight - dotSize()) * (1 - reveal.progress);
    preview.style.clipPath = `inset(0 ${inset}px ${inset}px 0)`;
  };

  const hide = () => {
    generation++;
    target = null;
    window.clearInterval(timer);
    timer = 0;
    animation?.kill();
    imageAnimation?.kill();
    preview.classList.remove("is-visible");
    setMode(false);
  };

  const setTarget = (next: HTMLElement | null) => {
    if (next === target) return;
    generation++;
    const current = generation;
    const wasVisible = preview.classList.contains("is-visible");
    target = next;
    window.clearInterval(timer);
    timer = 0;
    animation?.kill();
    imageAnimation?.kill();

    if (!next) {
      if (!wasVisible) return;
      imageAnimation = gsap.to(image, { opacity: 0, duration: 0.08 });
      animation = gsap.to(reveal, {
        progress: 0,
        duration: 0.16,
        ease: "power2.out",
        onUpdate: renderReveal,
        onComplete: () => {
          preview.classList.remove("is-visible");
          setMode(false);
        },
      });
      return;
    }

    try {
      images = JSON.parse(next.dataset.cursorGallery ?? "[]") as GalleryImage[];
    } catch {
      hide();
      return;
    }
    if (!images.length) {
      hide();
      return;
    }
    index = 0;
    image.src = images[0].src;
    place();
    if (!wasVisible) reveal.progress = 0;
    renderReveal();
    gsap.set(image, { opacity: 0 });
    preview.classList.add("is-visible");
    setMode(true);
    images.forEach((asset) => {
      void load(asset.src);
    });
    animation = gsap.to(reveal, {
      progress: 1,
      duration: 0.42,
      ease: "power2.out",
      onUpdate: renderReveal,
    });
    void load(images[0].src).then((loaded) => {
      if (current !== generation) return;
      if (!loaded) {
        hide();
        return;
      }
      imageAnimation = gsap.to(image, {
        opacity: 1,
        duration: 0.1,
      });
      timer = window.setInterval(() => {
        const nextIndex = (index + 1) % images.length;
        const asset = images[nextIndex];
        void load(asset.src).then((loaded) => {
          if (current !== generation || !loaded) return;
          index = nextIndex;
          image.src = asset.src;
          imageAnimation?.kill();
          imageAnimation = gsap.fromTo(
            image,
            { opacity: 0.7 },
            { opacity: 1, duration: 0.08, ease: "power2.out" },
          );
        });
      }, 550);
    });
  };

  return {
    get active() {
      return target !== null;
    },
    setTarget,
    move(left: number, top: number) {
      x = left;
      y = top;
      place();
    },
    resize() {
      place();
      renderReveal();
    },
    hide,
    destroy() {
      hide();
      observer.disconnect();
    },
  };
};

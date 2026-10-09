/** Keep offscreen decorative videos out of the initial download and decoding work. */
export function initializeLazyVideos() {
  const videos = Array.from(
    document.querySelectorAll<HTMLVideoElement>(
      "video[data-video-deferred]:not([data-video-ready])",
    ),
  );
  if (!videos.length) return;
  const visible = new Set<HTMLVideoElement>();
  const loaded = new Set<HTMLVideoElement>();
  let disposed = false;

  function synchronize(video: HTMLVideoElement) {
    if (!video.hasAttribute("data-video-autoplay")) return;
    if (disposed || document.hidden || !visible.has(video)) video.pause();
    else if (loaded.has(video)) {
      if (video.hasAttribute("muted")) video.muted = true;
      void video
        .play()
        .then(() => {
          if (disposed || document.hidden || !visible.has(video)) video.pause();
        })
        .catch(() => {});
    }
  }

  const proximity = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const video = entry.target as HTMLVideoElement;
        loaded.add(video);
        video.preload = "auto";
        video.load();
        proximity.unobserve(video);
        synchronize(video);
      }
    },
    { rootMargin: "1000px 0px" },
  );
  const visibility = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const video = entry.target as HTMLVideoElement;
      if (entry.isIntersecting) visible.add(video);
      else visible.delete(video);
      synchronize(video);
    }
  });
  const onVisibilityChange = () => videos.forEach(synchronize);
  document.addEventListener("visibilitychange", onVisibilityChange);
  for (const video of videos) {
    video.dataset.videoReady = "true";
  }
  let frame = 0;
  const observe = () => {
    void document.fonts.ready.then(() => {
      if (disposed) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (disposed) return;
          for (const video of videos) {
            proximity.observe(video);
            visibility.observe(video);
          }
        });
      });
    });
  };
  if (document.readyState === "complete") observe();
  else window.addEventListener("load", observe, { once: true });
  document.addEventListener(
    "astro:before-swap",
    () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("load", observe);
      proximity.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      videos.forEach(synchronize);
    },
    { once: true },
  );
}

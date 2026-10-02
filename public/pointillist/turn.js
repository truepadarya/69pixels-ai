(() => {
  const surface = document.querySelector(".pointillist-composition");
  if (!surface || surface.dataset.lightingReady) return;
  surface.dataset.lightingReady = "true";
  const original = surface.querySelector(".pointillist-original");
  const interaction = surface.parentElement;
  const coveringSection = interaction.nextElementSibling;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = matchMedia("(max-width: 767px)");
  const touchLayout = matchMedia("(width < 64rem)");
  const width = 342;
  let height, count, sourceHeight, maps, pixels, grid, gridContext;
  let target = 0,
    current = 0,
    targetY = 0.5,
    currentY = 0.5,
    raf = 0,
    lastTime = 0,
    requestId = 0;
  let autoRaf = 0,
    autoElapsed = 0,
    autoLastTime = 0,
    autoLastDraw = 0;
  const autoDuration = 10000;
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.className = "composition__light";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  async function loadLighting() {
    const id = ++requestId;
    maps = undefined;
    stopAuto();
    canvas.style.visibility = "hidden";
    original.style.visibility = "visible";
    try {
      const portrait = mobile.matches;
      const response = await fetch(
        portrait
          ? "/69pixels-ai/pointillist/relight-mobile.bin"
          : "/69pixels-ai/pointillist/relight.bin",
      );
      if (!response.ok) throw new Error("Lighting data unavailable");
      const buffer = await response.arrayBuffer();
      if (id !== requestId) return;
      const data = new Float32Array(buffer);
      height = portrait ? 366 : 206;
      count = width * height;
      sourceHeight = portrait ? 2191 : 1231;
      if (data.length !== count * 3) throw new Error("Lighting data mismatch");
      maps = [
        data.subarray(0, count),
        data.subarray(count, count * 2),
        data.subarray(count * 2),
      ];
      canvas.height = sourceHeight;
      context.imageSmoothingEnabled = false;
      grid = document.createElement("canvas");
      grid.width = width;
      grid.height = height;
      gridContext = grid.getContext("2d");
      pixels = gridContext.createImageData(width, height);
      if (!canvas.isConnected) surface.append(canvas);
      draw();
      canvas.style.visibility = "visible";
      original.style.visibility = "hidden";
      syncAuto();
    } catch (error) {
      if (id === requestId) {
        original.style.visibility = "visible";
        canvas.style.visibility = "hidden";
      }
      console.warn("Keeping original silhouette:", error.message);
    }
  }

  function draw() {
    if (!maps || !pixels) return;
    const t = current * current * (3 - 2 * current);
    const vertical = (currentY - 0.5) * Math.sin(Math.PI * current);
    const bytes = pixels.data;
    for (let i = 0; i < count; i++) {
      const shade = Math.max(
        0,
        Math.min(
          0.97,
          maps[0][i] * (1 - t) + maps[1][i] * t + maps[2][i] * vertical,
        ),
      );
      bytes[i * 4 + 3] = Math.round(shade * 255);
    }
    gridContext.putImageData(pixels, 0, 0);
    context.clearRect(0, 0, 2048, sourceHeight);
    context.drawImage(grid, 0, 0, width * 6, height * 6);
  }

  function tick(time) {
    const seconds = Math.min(0.05, Math.max(0.001, (time - lastTime) / 1000));
    lastTime = time;
    const blend =
      reduced.matches || touchLayout.matches ? 1 : 1 - Math.exp(-5.5 * seconds);
    current += (target - current) * blend;
    currentY += (targetY - currentY) * blend;
    draw();
    if (
      Math.abs(target - current) > 0.0003 ||
      Math.abs(targetY - currentY) > 0.0003
    )
      raf = requestAnimationFrame(tick);
    else raf = 0;
  }

  function animate() {
    if (!raf) {
      lastTime = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

  function stopAuto() {
    if (autoRaf) cancelAnimationFrame(autoRaf);
    autoRaf = 0;
    autoLastTime = 0;
    autoLastDraw = 0;
  }

  function autoTick(time) {
    if (autoLastTime) autoElapsed += Math.min(time - autoLastTime, 100);
    autoLastTime = time;
    if (time - autoLastDraw >= 1000 / 30) {
      current = (1 - Math.cos((2 * Math.PI * autoElapsed) / autoDuration)) / 2;
      currentY = 0.5;
      draw();
      autoLastDraw = time;
    }
    autoRaf = requestAnimationFrame(autoTick);
  }

  function syncAuto() {
    const uncovered =
      !coveringSection || coveringSection.getBoundingClientRect().top > 0;
    const active =
      mobile.matches &&
      !reduced.matches &&
      !document.hidden &&
      maps &&
      uncovered;
    if (active && !autoRaf) autoRaf = requestAnimationFrame(autoTick);
    else if (!active) stopAuto();
  }

  function onPointerMove(event) {
    if (
      touchLayout.matches ||
      reduced.matches ||
      (event.pointerType !== "mouse" && event.pointerType !== "pen")
    )
      return;
    const box = surface.getBoundingClientRect();
    const inside =
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom;
    target = inside
      ? Math.max(
          0,
          Math.min(1, ((event.clientX - box.left) / box.width - 0.165) / 0.67),
        )
      : 0;
    targetY = inside
      ? Math.max(0, Math.min(1, (event.clientY - box.top) / box.height))
      : 0.5;
    animate();
  }

  function onScroll() {
    if (mobile.matches) {
      syncAuto();
      return;
    }
    if (!touchLayout.matches || reduced.matches) return;
    target = Math.max(
      0,
      Math.min(1, window.scrollY / Math.max(interaction.offsetHeight * 0.9, 1)),
    );
    targetY = 0.5;
    animate();
  }

  function onModeChange() {
    stopAuto();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    autoElapsed = 0;
    target = 0;
    current = 0;
    targetY = 0.5;
    currentY = 0.5;
    draw();
    if (mobile.matches) syncAuto();
    else if (touchLayout.matches && !reduced.matches) onScroll();
  }

  function onBlur() {
    if (mobile.matches) {
      stopAuto();
      return;
    }
    target = 0;
    targetY = 0.5;
    animate();
  }

  function onMobileChange() {
    loadLighting();
    onModeChange();
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", syncAuto);
  document.addEventListener("visibilitychange", syncAuto);
  touchLayout.addEventListener("change", onModeChange);
  reduced.addEventListener("change", onModeChange);
  document.addEventListener(
    "astro:before-swap",
    () => {
      document.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", syncAuto);
      document.removeEventListener("visibilitychange", syncAuto);
      touchLayout.removeEventListener("change", onModeChange);
      reduced.removeEventListener("change", onModeChange);
      mobile.removeEventListener("change", onMobileChange);
      requestId++;
      if (raf) cancelAnimationFrame(raf);
      stopAuto();
    },
    { once: true },
  );
  mobile.addEventListener("change", onMobileChange);
  onModeChange();
  loadLighting();
})();
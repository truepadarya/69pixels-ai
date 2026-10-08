(() => {
  const pointillistPath = new URL(".", document.currentScript.src).href;
  const surface = document.querySelector(".pointillist_wrap");
  if (!surface || surface.dataset.lightingReady) return;
  surface.dataset.lightingReady = "true";
  const original = surface.querySelector(".pointillist_original");
  const interaction = surface.parentElement;
  const coveringSection = interaction.nextElementSibling;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = matchMedia("(width < 48rem)");
  const touchLayout = matchMedia("(width < 64rem)");
  let focused = true,
    disposed = false;
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
  const autoDuration = 60000;
  let scrollBoost = 0,
    autoSpeed = 1,
    lastScrollY = window.scrollY;
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.className = "pointillist_light";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  async function loadLighting() {
    const id = ++requestId;
    maps = undefined;
    syncAuto();
    canvas.style.visibility = "hidden";
    original.style.visibility = "visible";
    if (disposed) return;
    if (reduced.matches) {
      try {
        await original.decode();
        if (id !== requestId || disposed) return;
        canvas.height = mobile.matches ? 2191 : 1231;
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (mobile.matches)
          context.drawImage(original, 0, 0, canvas.width, canvas.height);
        else {
          height = 206;
          count = width * height;
          sourceHeight = 1231;
          grid = document.createElement("canvas");
          grid.width = width;
          grid.height = height;
          gridContext = grid.getContext("2d");
          gridContext.imageSmoothingEnabled = false;
          gridContext.drawImage(original, 0, 0, width, height);
          const staticPixels = gridContext.getImageData(0, 0, width, height);
          const source = Float32Array.from(
            { length: count },
            (_, i) => staticPixels.data[i * 4 + 3] / 255,
          );
          const sculpted = sculptLighting(source);
          for (let i = 0; i < count; i++)
            staticPixels.data[i * 4 + 3] = Math.round(sculpted[i] * 255);
          gridContext.putImageData(staticPixels, 0, 0);
          paintGrid();
        }
        if (!canvas.isConnected) surface.append(canvas);
        canvas.style.visibility = "visible";
        original.style.visibility = "hidden";
      } catch {
        original.style.visibility = "visible";
      }
      return;
    }
    try {
      const portrait = mobile.matches;
      const response = await fetch(
        portrait
          ? `${pointillistPath}relight-mobile.bin`
          : `${pointillistPath}relight.bin`,
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
      if (!portrait) {
        maps[0] = sculptLighting(maps[0]);
        maps[1] = sculptLighting(maps[1]);
      }
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

  function sculptLighting(source) {
    const result = new Float32Array(count);
    const radius = 9;
    const horizontal = new Float32Array(count);
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = -radius; x <= radius; x++)
        sum += source[y * width + Math.max(0, Math.min(width - 1, x))];
      for (let x = 0; x < width; x++) {
        horizontal[y * width + x] = sum / (radius * 2 + 1);
        sum +=
          source[y * width + Math.min(width - 1, x + radius + 1)] -
          source[y * width + Math.max(0, x - radius)];
      }
    }
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++)
        sum += horizontal[Math.max(0, Math.min(height - 1, y)) * width + x];
      for (let y = 0; y < height; y++) {
        const i = y * width + x;
        const nx = (x / width - 0.51) / 0.19;
        const ny = (y / height - 0.31) / 0.24;
        const mask = Math.exp(-2 * (nx * nx + ny * ny));
        const detail = source[i] - sum / (radius * 2 + 1);
        result[i] = Math.max(
          0,
          Math.min(0.99, source[i] + detail * mask * 1.4),
        );
        sum +=
          horizontal[Math.min(height - 1, y + radius + 1) * width + x] -
          horizontal[Math.max(0, y - radius) * width + x];
      }
    }
    return result;
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
    paintGrid();
  }

  function paintGrid() {
    context.clearRect(0, 0, 2048, sourceHeight);
    const faceOffset = mobile.matches ? 0 : 36;
    if (faceOffset)
      context.drawImage(grid, 0, 0, width, 1, 0, 0, width * 6, faceOffset);
    context.drawImage(grid, 0, faceOffset, width * 6, height * 6);
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
    scrollBoost = 0;
    autoSpeed = 1;
  }
  function autoTick(time) {
    const delta = autoLastTime ? Math.min(time - autoLastTime, 100) : 0;
    scrollBoost *= Math.exp(-delta / 900);
    autoSpeed += (1 + scrollBoost - autoSpeed) * (1 - Math.exp(-delta / 180));
    autoElapsed = (autoElapsed + delta * autoSpeed) % autoDuration;
    autoLastTime = time;
    if (time - autoLastDraw >= 1000 / 30) {
      current = (1 - Math.cos((2 * Math.PI * autoElapsed) / autoDuration)) / 2;
      currentY = 0.5;
      draw();
      autoLastDraw = time;
    }
    autoRaf = requestAnimationFrame(autoTick);
  }
  function isActive() {
    const uncovered =
      !coveringSection || coveringSection.getBoundingClientRect().top > 0;
    return (
      !reduced.matches &&
      !document.hidden &&
      focused &&
      !!maps &&
      uncovered &&
      !disposed
    );
  }
  function syncAuto() {
    const visible = isActive();
    if (!visible && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    const active = mobile.matches && visible;
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
    const delta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    if (touchLayout.matches) syncAuto();
    if (mobile.matches) {
      if (delta > 0 && isActive())
        scrollBoost = Math.min(
          7,
          scrollBoost + (delta / Math.max(window.innerHeight, 1)) * 24,
        );
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
    lastScrollY = window.scrollY;
    target = 0;
    current = 0;
    targetY = 0.5;
    currentY = 0.5;
    draw();
    syncAuto();
    if (!mobile.matches && touchLayout.matches && !reduced.matches) onScroll();
  }
  function onBlur() {
    focused = false;
    syncAuto();
    if (touchLayout.matches) return;
    target = 0;
    targetY = 0.5;
    animate();
  }
  function onFocus() {
    focused = true;
    syncAuto();
  }
  function onMobileChange() {
    loadLighting();
    onModeChange();
  }
  function onReducedChange() {
    onModeChange();
    loadLighting();
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", syncAuto);
  touchLayout.addEventListener("change", onModeChange);
  reduced.addEventListener("change", onReducedChange);
  document.addEventListener(
    "astro:before-swap",
    () => {
      disposed = true;
      document.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", syncAuto);
      touchLayout.removeEventListener("change", onModeChange);
      reduced.removeEventListener("change", onReducedChange);
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

(() => {
  const surface = document.querySelector(".pointillist_wrap");
  if (!surface || surface.dataset.lightingReady) return;
  surface.dataset.lightingReady = "true";
  const original = surface.querySelector(".pointillist_original");
  const interaction = surface.parentElement;
  const coveringSection = interaction.nextElementSibling;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = matchMedia("(width < 48rem)");
  const touchLayout = matchMedia("(width < 64rem)");
  const sensorLayout = matchMedia(
    "(width < 48rem), (width < 64rem) and (pointer: coarse)",
  );
  const control = interaction.querySelector(".pointillist_control");
  const orientation = window.DeviceOrientationEvent;
  const sensorAvailable = window.isSecureContext && !!orientation;
  let sensorPermission =
    typeof orientation?.requestPermission === "function" ? "prompt" : "granted";
  let sensorListening = false,
    sensorReady = false,
    sensorOrigin = null,
    permissionPending = false,
    focused = true,
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
  const autoDuration = 10000;
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
        context.drawImage(original, 0, 0, canvas.width, canvas.height);
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
          ? "/pointillist/relight-mobile.bin"
          : "/pointillist/relight.bin",
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
      reduced.matches || (touchLayout.matches && !sensorReady)
        ? 1
        : 1 - Math.exp(-(sensorReady ? 8 : 5.5) * seconds);
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
  function stopSensor() {
    if (sensorListening)
      window.removeEventListener("deviceorientation", onOrientation);
    sensorListening = false;
    sensorReady = false;
    sensorOrigin = null;
  }
  function syncAuto() {
    const visible = isActive();
    const sensorActive = sensorAvailable && sensorLayout.matches && visible;
    if (control) {
      control.hidden = !sensorActive || sensorPermission !== "prompt";
      control.disabled = permissionPending;
    }
    if (sensorActive && sensorPermission === "granted") {
      if (!sensorListening) {
        window.addEventListener("deviceorientation", onOrientation, {
          passive: true,
        });
        sensorListening = true;
      }
    } else stopSensor();
    if (!visible && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    const active = mobile.matches && visible && !sensorReady;
    if (active && !autoRaf) autoRaf = requestAnimationFrame(autoTick);
    else if (!active) stopAuto();
  }
  function angleDelta(value, origin) {
    return ((((value - origin + 180) % 360) + 360) % 360) - 180;
  }
  function onOrientation(event) {
    if (
      !sensorListening ||
      !isActive() ||
      !Number.isFinite(event.beta) ||
      !Number.isFinite(event.gamma)
    )
      return;
    if (!sensorOrigin) {
      sensorOrigin = { beta: event.beta, gamma: event.gamma };
      sensorReady = true;
      stopAuto();
    }
    const radians =
      ((screen.orientation?.angle ??
        (Number(Reflect.get(window, "orientation")) || 0)) *
        Math.PI) /
      180;
    const beta = angleDelta(event.beta, sensorOrigin.beta);
    const gamma = angleDelta(event.gamma, sensorOrigin.gamma);
    const horizontal = gamma * Math.cos(radians) + beta * Math.sin(radians);
    const vertical = beta * Math.cos(radians) - gamma * Math.sin(radians);
    target = Math.max(0, Math.min(1, 0.5 + horizontal / 60));
    targetY = Math.max(0, Math.min(1, 0.5 + vertical / 60));
    animate();
  }
  async function requestSensor() {
    if (permissionPending || disposed || !sensorLayout.matches || !isActive())
      return;
    permissionPending = true;
    if (control) control.disabled = true;
    try {
      sensorPermission = await orientation.requestPermission();
    } catch {
      sensorPermission = "denied";
    } finally {
      permissionPending = false;
      if (!disposed) syncAuto();
    }
  }
  function onOrientationChange() {
    sensorOrigin = null;
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
    if (sensorLayout.matches) syncAuto();
    if (mobile.matches) {
      return;
    }
    if (sensorReady) return;
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
    stopSensor();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    autoElapsed = 0;
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
    if (sensorLayout.matches) {
      return;
    }
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
  window.addEventListener("orientationchange", onOrientationChange);
  screen.orientation?.addEventListener("change", onOrientationChange);
  control?.addEventListener("click", requestSensor);
  document.addEventListener("visibilitychange", syncAuto);
  touchLayout.addEventListener("change", onModeChange);
  reduced.addEventListener("change", onReducedChange);
  sensorLayout.addEventListener("change", onModeChange);
  document.addEventListener(
    "astro:before-swap",
    () => {
      disposed = true;
      document.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("orientationchange", onOrientationChange);
      screen.orientation?.removeEventListener("change", onOrientationChange);
      control?.removeEventListener("click", requestSensor);
      document.removeEventListener("visibilitychange", syncAuto);
      touchLayout.removeEventListener("change", onModeChange);
      reduced.removeEventListener("change", onReducedChange);
      sensorLayout.removeEventListener("change", onModeChange);
      mobile.removeEventListener("change", onMobileChange);
      requestId++;
      if (raf) cancelAnimationFrame(raf);
      stopAuto();
      stopSensor();
    },
    { once: true },
  );
  mobile.addEventListener("change", onMobileChange);
  onModeChange();
  loadLighting();
})();

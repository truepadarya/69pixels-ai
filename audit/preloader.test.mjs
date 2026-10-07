import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { browserSession } from "./browser-session.mjs";

const browser = await browserSession();
const { send, evaluate, wait } = browser;
const output = new URL("./wifi-loading/", import.meta.url);
await mkdir(output, { recursive: true });

async function navigate(width, patterns = [], reduced = false) {
  await send("Fetch.disable");
  if (patterns.length)
    await send("Fetch.enable", {
      patterns: patterns.map((urlPattern) => ({
        urlPattern,
        requestStage: "Request",
      })),
    });
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 844,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await send("Emulation.setEmulatedMedia", {
    features: [
      {
        name: "prefers-reduced-motion",
        value: reduced ? "reduce" : "no-preference",
      },
    ],
  });
  await send("Page.navigate", {
    url: "http://192.168.3.67:4321/?loading-test=" + Date.now(),
  });
  await wait(5000);
  const state = await evaluate(`(() => {
    const loader = document.querySelector('.page-preloader');
    const heading = document.querySelector('.hero_heading');
    const point = document.elementFromPoint(innerWidth / 2, 400);
    return { state: document.readyState, ready: document.documentElement.classList.contains('is-page-ready'),
      opacity: loader ? Number(getComputedStyle(loader).opacity) : 0,
      blocking: point === loader, pointer: loader && getComputedStyle(loader).pointerEvents,
      headingOpacity: Number(getComputedStyle(heading).opacity), secure: isSecureContext };
  })()`);
  const name = `${width}-${patterns.length ? (patterns[0].includes("BaseLayout") ? "pending-modules" : "pending-image") : reduced ? "reduced" : "normal"}`;
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    new URL(name + ".png", output),
    Buffer.from(screenshot.data, "base64"),
  );
  console.log(name, state);
  assert.equal(
    state.opacity,
    0,
    "preloader must release content even while a resource is pending",
  );
  assert.equal(state.blocking, false, "preloader must not intercept touch");
  assert.equal(state.ready, true, "hero must be released");
  assert.equal(state.headingOpacity, 1, "hero text must be visible");
  assert.equal(state.secure, false, "test must run on the Wi-Fi HTTP origin");
  if (patterns.length)
    assert.notEqual(
      state.state,
      "complete",
      "pending resource must reproduce stalled loading",
    );
}

try {
  await navigate(390, ["*/pointillist/background.png*"]);
  await navigate(390, ["*/src/layouts/BaseLayout.astro?astro&type=script*"]);
  for (const width of [320, 390, 768, 1440]) await navigate(width);
  await navigate(390, [], true);
  console.log(
    "PASS Wi-Fi loading with stalled image/modules, mobile/tablet/desktop and reduced motion",
  );
} finally {
  await send("Fetch.disable");
  await browser.close();
}

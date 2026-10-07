import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { browserSession } from "./browser-session.mjs";

const browser = await browserSession();
const { send, evaluate, wait, load } = browser;
let bootstrapId;
const output = new URL("./hero-gyro/", import.meta.url);
await mkdir(output, { recursive: true });

async function open(mode, width = 390, reduced = false) {
  if (bootstrapId)
    await send("Page.removeScriptToEvaluateOnNewDocument", {
      identifier: bootstrapId,
    });
  const result = await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.gyroPermissionCalls = [];
      window.gyroErrors = [];
      window.addEventListener('error', e => gyroErrors.push(e.message));
      window.addEventListener('unhandledrejection', e => gyroErrors.push(String(e.reason)));
      if (${JSON.stringify(mode)} === 'unsupported') {
        Object.defineProperty(window, 'DeviceOrientationEvent', { value: undefined });
      } else if (${JSON.stringify(mode)} === 'auto') {
        delete DeviceOrientationEvent.requestPermission;
      } else {
        DeviceOrientationEvent.requestPermission = () => {
          gyroPermissionCalls.push(navigator.userActivation.isActive);
          if (${JSON.stringify(mode)} === 'error') return Promise.reject(new Error('Unavailable'));
          return Promise.resolve(${JSON.stringify(mode)} === 'denied' ? 'denied' : 'granted');
        };
      }
    `,
  });
  bootstrapId = result.identifier;
  await load(width, reduced);
  await evaluate("window.scrollTo({top: 0, behavior: 'instant'})");
  for (let i = 0; i < 50; i++) {
    if (
      await evaluate(
        "document.querySelector('.pointillist_light')?.style.visibility === 'visible'",
      )
    )
      break;
    await wait(100);
  }
  assert.equal(
    await evaluate(
      "document.querySelector('.pointillist_light')?.style.visibility",
    ),
    "visible",
  );
}

const sample = () =>
  evaluate(`(() => {
  const canvas = document.querySelector('.pointillist_light');
  const small = document.createElement('canvas');
  small.width = 64; small.height = 64;
  const ctx = small.getContext('2d');
  ctx.drawImage(canvas, 0, 0, 64, 64);
  return Array.from(ctx.getImageData(0, 0, 64, 64).data).filter((_, i) => i % 4 === 3);
})()`);

const difference = (a, b) =>
  a.reduce((sum, alpha, i) => sum + Math.abs(alpha - b[i]), 0);
const tilt = async (beta, gamma) => {
  await evaluate(
    `window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: ${beta}, gamma: ${gamma}, alpha: 0 }))`,
  );
  await wait(1400);
  return sample();
};

async function clickPermission() {
  const box = await evaluate(`(() => {
    const button = document.querySelector('.pointillist_control');
    const r = button.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width, height: r.height,
      hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.pointillist_control') === button };
  })()`);
  assert.ok(box.width > 0 && box.height >= 44 && box.hit, JSON.stringify(box));
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  });
  await wait(100);
  assert.deepEqual(await evaluate("gyroPermissionCalls"), [true]);
}

async function screenshot(name) {
  const result = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    new URL(name + ".png", output),
    Buffer.from(result.data, "base64"),
  );
}

try {
  await open("granted");
  assert.deepEqual(await evaluate("gyroPermissionCalls"), []);
  assert.equal(
    await evaluate("document.querySelector('.pointillist_control').hidden"),
    false,
  );
  await screenshot("permission-390");
  await clickPermission();
  assert.equal(
    await evaluate("document.querySelector('.pointillist_control').hidden"),
    true,
  );
  await tilt(55, 8);
  const left = await tilt(55, -22);
  const right = await tilt(55, 38);
  assert.ok(
    difference(left, right) > 10000,
    "left/right tilt must change the rendered lighting",
  );
  await screenshot("tilt-right-390");
  const forward = await tilt(25, 8);
  const backward = await tilt(85, 8);
  assert.ok(
    difference(forward, backward) > 1000,
    "forward/backward tilt must change lighting",
  );
  await wait(2000);
  assert.equal(
    difference(backward, await sample()),
    0,
    "lighting must stay still when the phone stays still",
  );
  console.log(
    "PASS permission requires a real click; calibrated horizontal/vertical tilt changes lighting; no autonomous loop after sensor data",
  );

  await evaluate(
    "window.scrollTo({top: document.querySelector('.hero_wrap').offsetHeight + 100, behavior: 'instant'})",
  );
  await wait(400);
  const covered = await sample();
  await tilt(0, -80);
  assert.equal(
    difference(covered, await sample()),
    0,
    "covered hero must ignore sensors",
  );
  await evaluate("window.scrollTo({top: 0, behavior: 'instant'})");
  await wait(300);
  await tilt(55, 8);
  const resumed = await tilt(55, -22);
  assert.ok(
    difference(covered, resumed) > 1000,
    "gyro must resume when returning to hero",
  );
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await wait(300);
  const staticFrame = await sample();
  await tilt(0, 80);
  assert.equal(
    difference(staticFrame, await sample()),
    0,
    "reduced motion must disable sensors",
  );
  assert.equal(
    await evaluate("document.querySelector('.pointillist_control').hidden"),
    true,
  );
  console.log(
    "PASS covered hero and reduced motion pause sensors; return to hero resumes them",
  );

  for (const mode of ["denied", "error", "unsupported"]) {
    await open(mode);
    if (mode !== "unsupported") await clickPermission();
    const before = await sample();
    await wait(1500);
    assert.ok(
      difference(before, await sample()) > 1000,
      `${mode}: ambient fallback must keep working`,
    );
    assert.deepEqual(await evaluate("gyroErrors"), []);
  }
  console.log(
    "PASS denied permission, rejected permission and missing sensor API preserve the existing fallback without errors",
  );

  await open("auto", 320);
  assert.equal(
    await evaluate("document.querySelector('.pointillist_control').hidden"),
    true,
  );
  await evaluate(
    "window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: null, gamma: null }))",
  );
  const invalid = await sample();
  await wait(1000);
  assert.ok(
    difference(invalid, await sample()) > 1000,
    "null sensor readings must not stop fallback",
  );
  await tilt(55, 0);
  const sensorLeft = await tilt(55, -30);
  const sensorRight = await tilt(55, 30);
  assert.ok(difference(sensorLeft, sensorRight) > 10000);
  await screenshot("auto-320");
  console.log(
    "PASS automatic access without a permission API and null readings at 320 px",
  );

  await open("granted", 844);
  await send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await wait(300);
  assert.equal(await evaluate("matchMedia('(pointer: coarse)').matches"), true);
  await send("Emulation.setDeviceMetricsOverride", {
    width: 844,
    height: 390,
    deviceScaleFactor: 1,
    mobile: true,
    screenOrientation: { type: "landscapePrimary", angle: 90 },
  });
  await wait(300);
  await clickPermission();
  await tilt(0, 55);
  const landscapeLeft = await tilt(-30, 55);
  const landscapeRight = await tilt(30, 55);
  assert.ok(
    difference(landscapeLeft, landscapeRight) > 10000,
    "landscape must use screen-relative axes",
  );
  console.log("PASS landscape phone uses screen-relative tilt");

  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await open("granted", 1440);
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('.pointillist_control')).display",
    ),
    "none",
  );
  const desktop = await sample();
  await tilt(0, 80);
  assert.equal(
    difference(desktop, await sample()),
    0,
    "desktop must ignore device orientation",
  );
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: 1250,
    y: 350,
  });
  await wait(1800);
  assert.ok(
    difference(desktop, await sample()) > 10000,
    "desktop pointer animation must remain functional",
  );
  assert.deepEqual(await evaluate("gyroPermissionCalls"), []);
  await screenshot("desktop-1440");
  await evaluate("document.dispatchEvent(new Event('astro:before-swap'))");
  const disposedFrame = await sample();
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: 150,
    y: 350,
  });
  await wait(1500);
  assert.equal(
    difference(disposedFrame, await sample()),
    0,
    "navigation must clean up animation handlers",
  );
  assert.deepEqual(await evaluate("gyroErrors"), []);
  console.log(
    "PASS desktop pointer behavior, hidden permission control and navigation cleanup",
  );
} finally {
  await browser.close();
}

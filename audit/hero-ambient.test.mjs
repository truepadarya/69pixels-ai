import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { browserSession } from "./browser-session.mjs";

const browser = await browserSession();
const { send, evaluate, load } = browser;
await mkdir("audit/hero-ambient", { recursive: true });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
  window.heroClock = { time: 0, next: 10000000, callbacks: new Map(), sensors: 0, errors: [] };
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => {
    if (!new Error().stack.includes('/pointillist/turn.js')) return nativeRAF(callback);
    const id = ++heroClock.next; heroClock.callbacks.set(id, callback); return id;
  };
  window.cancelAnimationFrame = id => heroClock.callbacks.delete(id) || nativeCancel(id);
  const nativeListen = window.addEventListener.bind(window);
  window.addEventListener = (type, ...args) => {
    if (type === 'deviceorientation') heroClock.sensors++;
    return nativeListen(type, ...args);
  };
  if (window.DeviceOrientationEvent) DeviceOrientationEvent.requestPermission = () => { heroClock.sensors++; throw new Error('Unexpected gyro permission'); };
  nativeListen('error', e => heroClock.errors.push(e.message));
  window.advanceHero = duration => {
    for (let elapsed = 0; elapsed < duration; elapsed += 50) {
      heroClock.time += 50;
      const callbacks = [...heroClock.callbacks.values()]; heroClock.callbacks.clear();
      callbacks.forEach(callback => callback(heroClock.time));
    }
  };
`,
});
const sample = () =>
  evaluate(`(() => {
  const canvas = document.querySelector('.pointillist_light');
  const probe = document.createElement('canvas'); probe.width = 64; probe.height = 64;
  const ctx = probe.getContext('2d'); ctx.drawImage(canvas, 0, 0, 64, 64);
  return Array.from(ctx.getImageData(0, 0, 64, 64).data).filter((_, i) => i % 4 === 3);
})()`);
const difference = (a, b) =>
  a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0);
const advance = (duration) => evaluate(`advanceHero(${duration})`);
const shot = async (name) => {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    `audit/hero-ambient/${name}.png`,
    Buffer.from(data, "base64"),
  );
};
try {
  await load(390);
  assert.equal(await evaluate("heroClock.sensors"), 0);
  assert.equal(
    await evaluate("document.querySelector('.pointillist_control')"),
    null,
  );
  const left = await sample();
  await shot("left");
  await advance(5000);
  const slow = await sample();
  const slowChange = difference(left, slow);
  await advance(25000);
  const right = await sample();
  await shot("right");
  assert(
    difference(left, right) > 10000,
    "Light should cross the face in 30 seconds",
  );
  await advance(30000);
  const loop = await sample();
  assert(
    difference(left, loop) < 500,
    "Loop should return smoothly to its initial light",
  );

  await load(390);
  const beforeScroll = await sample();
  await evaluate(
    "window.scrollTo({top:250,behavior:'instant'}); window.dispatchEvent(new Event('scroll'))",
  );
  await advance(5000);
  const fastChange = difference(beforeScroll, await sample());
  assert(
    fastChange > slowChange * 2,
    `Scroll should accelerate the sweep: ${fastChange} vs ${slowChange}`,
  );
  await evaluate(
    "window.scrollTo({top:4000,behavior:'instant'}); window.dispatchEvent(new Event('scroll'))",
  );
  assert.equal(
    await evaluate("heroClock.callbacks.size"),
    0,
    "Offscreen motion should stop",
  );

  await load(390, true);
  const reduced = await sample();
  await advance(60000);
  assert.equal(
    difference(reduced, await sample()),
    0,
    "Reduced motion should stay static",
  );
  assert.equal(await evaluate("heroClock.callbacks.size"), 0);

  await load(1440);
  assert.equal(
    await evaluate(`(() => {
    const canvas = document.querySelector('.pointillist_light');
    const top = canvas.getContext('2d').getImageData(0, 0, canvas.width, 1).data;
    const bounds = canvas.getBoundingClientRect();
    const hero = document.querySelector('.pointillist_wrap').getBoundingClientRect();
    return bounds.top === hero.top && bounds.bottom === hero.bottom && top.some((value, i) => i % 4 === 3 && value > 0);
  })()`),
    true,
    "Desktop lighting must fill the hero including its top edge",
  );
  const desktop = await sample();
  await evaluate(
    "document.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:1100,clientY:400}))",
  );
  await advance(3000);
  assert(
    difference(desktop, await sample()) > 10000,
    "Desktop pointer lighting should still work",
  );
  assert.equal(await evaluate("heroClock.sensors"), 0);
  assert.deepEqual(await evaluate("heroClock.errors"), []);
  console.log(
    JSON.stringify({
      cycleSeconds: 60,
      slowChange,
      fastChange,
      gyroListeners: 0,
      reducedMotion: "static",
      desktopPointer: "passed",
    }),
  );
} finally {
  await browser.close();
}

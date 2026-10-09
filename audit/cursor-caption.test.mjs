import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { browserSession } from "./browser-session.mjs";

const b = await browserSession();
const move = (x, y) =>
  b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
const state = () =>
  b.evaluate(`(() => {
  const caption = document.querySelector('[data-square-cursor-caption]');
  const background = document.querySelector('[data-square-cursor-background]');
  const text = document.querySelector('[data-square-cursor-text]');
  const r = background.getBoundingClientRect();
  const style = getComputedStyle(text);
  return {
    open: caption.classList.contains('is-visible'),
    text: text.textContent,
    letters: [...text.children].filter(e => getComputedStyle(e).opacity === '1').length,
    rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    width: caption.offsetWidth,
    height: caption.offsetHeight,
    blend: getComputedStyle(caption.parentElement).mixBlendMode,
    background: getComputedStyle(background).backgroundColor,
    color: style.color,
    font: style.fontFamily,
    size: style.fontSize,
    padding: style.padding,
    pointers: [...document.querySelectorAll('[data-square-cursor-pointer]')].map(e => getComputedStyle(e).opacity),
  };
})()`);

try {
  await b.load(1440);
  assert.equal(
    await b.evaluate(
      'document.querySelectorAll("[data-creators-direction] [data-cursor-label]").length',
    ),
    10,
  );
  await b.evaluate(`(() => {
    const section = document.querySelector('[data-creators-direction]');
    window.scrollTo({ top: section.getBoundingClientRect().top + scrollY + (section.offsetHeight - innerHeight) * 0.12, behavior: 'instant' });
  })()`);
  await b.wait(1700);
  const targets = await b.evaluate(`(() => {
    const points = [];
    for (const e of document.querySelectorAll('[data-cursor-label]')) {
      if (Number(getComputedStyle(e).opacity) < 0.2) continue;
      const r = e.getBoundingClientRect();
      for (const f of [0.5, 0.35, 0.65]) {
        const x = r.left + r.width * f, y = r.top + r.height * 0.5;
        if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue;
        if (document.elementFromPoint(x, y)?.closest('[data-cursor-label]') === e) {
          points.push({ x, y, label: e.dataset.cursorLabel });
          break;
        }
      }
    }
    return points;
  })()`);
  assert.ok(targets.length >= 2, "At least two real portraits are reachable");
  const first = targets.find((p) => p.label === "Alex") ?? targets[0];
  await move(first.x, first.y);
  await b.wait(70);
  const opening = await state();
  assert.equal(opening.open, true);
  assert.ok(
    opening.rect.width < opening.width,
    "Background expands from the square",
  );
  assert.ok(
    opening.letters < first.label.length,
    "Text starts hidden and types progressively",
  );
  await b.wait(350);
  const opened = await state();
  assert.equal(opened.text, first.label);
  assert.equal(opened.letters, first.label.length);
  assert.equal(opened.blend, "normal");
  assert.equal(opened.background, "rgb(0, 0, 0)");
  assert.equal(opened.color, "rgb(255, 255, 255)");
  assert.equal(opened.size, "12px");
  assert.equal(opened.padding, "2px 4px");
  assert.ok(
    opened.pointers.every((p) => p === "0"),
    "Blended pointer layers are hidden",
  );
  assert.ok(
    Math.abs(opened.rect.x - first.x) < 1 &&
      Math.abs(opened.rect.y - first.y) < 1,
    "Top-left remains at the pointer",
  );
  assert.ok(
    await b.evaluate(
      `[...document.fonts].some(f => f.family.includes('Roboto Mono') && f.status === 'loaded')`,
    ),
    "Local Roboto Mono loaded",
  );
  mkdirSync("audit/cursor-caption", { recursive: true });
  const screenshot = await b.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(
    "audit/cursor-caption/desktop.png",
    Buffer.from(screenshot.data, "base64"),
  );

  const second = targets.find((p) => p.label !== first.label);
  await move(second.x, second.y);
  await b.wait(30);
  await move(first.x, first.y);
  await b.wait(350);
  assert.equal(
    (await state()).text,
    first.label,
    "Fast re-entry cancels previous typing",
  );
  await move(720, 450);
  const exitFrames = await b.evaluate(`new Promise(resolve => {
    const samples = [];
    const until = performance.now() + 400;
    const sample = () => {
      const caption = document.querySelector('[data-square-cursor-caption]');
      const visible = caption.classList.contains('is-visible') ? 1 : Math.max(...[...document.querySelectorAll('[data-square-cursor-pointer]')].map(e => Number(getComputedStyle(e).opacity)));
      samples.push(visible);
      if (performance.now() < until) requestAnimationFrame(sample);
      else resolve(samples);
    };
    sample();
  })`);
  assert.ok(
    exitFrames.every((opacity) => opacity > 0.99),
    "Leaving a caption never fades the replacement square or creates an empty frame",
  );
  await b.wait(250);
  assert.equal((await state()).open, false, "Caption collapses on exit");

  await move(first.x, first.y);
  await b.wait(350);
  await b.evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`);
  await b.wait(1100);
  assert.equal(
    (await state()).open,
    false,
    "Scroll removes stale caption without pointer movement",
  );

  await b.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await b.wait(100);
  assert.equal(
    await b.evaluate(
      'document.documentElement.classList.contains("has-square-cursor")',
    ),
    false,
    "Runtime reduced-motion disables custom cursor",
  );
  await b.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await b.evaluate(
    `document.dispatchEvent(new Event('astro:page-load')); document.dispatchEvent(new Event('astro:page-load'))`,
  );
  await move(500, 100);
  await b.wait(200);
  assert.equal(
    await b.evaluate(
      'document.querySelectorAll("[data-square-cursor-caption]").length',
    ),
    1,
  );
  assert.equal(
    await b.evaluate(
      'document.documentElement.classList.contains("has-square-cursor")',
    ),
    true,
  );
  console.log(
    "PASS: expansion origin, letter typing, normal blend, font/padding, fast re-entry, exit, stationary scroll, reduced motion and Astro lifecycle",
  );
} finally {
  await b.close();
}

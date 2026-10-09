import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { browserSession } from "./browser-session.mjs";

const b = await browserSession();
const seen = new Set();

try {
  await b.load(1440);
  const cards = await b.evaluate(
    `Array.from(document.querySelectorAll('[data-capabilities] .capabilities_card'), (e, index) => ({ index, label: e.dataset.cursorLabel, kind: e.dataset.kind }))`,
  );
  assert.equal(cards.length, 22);
  assert.ok(
    cards.every((card) => card.label?.trim()),
    "Every image and video has a caption",
  );
  const section = await b.evaluate(`(() => {
    const e = document.querySelector('[data-capabilities]');
    return { top: e.getBoundingClientRect().top + scrollY, distance: e.offsetHeight - innerHeight };
  })()`);

  for (let step = 0; step <= 36; step++) {
    await b.evaluate(
      `window.scrollTo({ top: ${section.top + (section.distance * step) / 36}, behavior: 'instant' })`,
    );
    await b.wait(140);
    const targets = await b.evaluate(`(() => {
      const points = [];
      document.querySelectorAll('[data-capabilities] .capabilities_card').forEach((e, index) => {
        if (Number(getComputedStyle(e).opacity) < 0.2) return;
        const r = e.getBoundingClientRect();
        for (const fy of [0.5, 0.25, 0.75]) {
          for (const fx of [0.5, 0.25, 0.75]) {
            const x = r.left + r.width * fx, y = r.top + r.height * fy;
            if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue;
            if (document.elementFromPoint(x, y)?.closest('.capabilities_card') !== e) continue;
            points.push({ index, x, y, label: e.dataset.cursorLabel });
            return;
          }
        }
      });
      return points;
    })()`);
    for (const target of targets) {
      if (seen.has(target.index)) continue;
      await b.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: target.x,
        y: target.y,
      });
      await b.wait(180 + target.label.length * 35);
      const caption = await b.evaluate(`(() => {
        const e = document.querySelector('[data-square-cursor-caption]');
        return {
          open: e.classList.contains('is-visible'),
          text: e.textContent.trim(),
          blend: getComputedStyle(e.parentElement).mixBlendMode,
          letters: [...e.querySelector('[data-square-cursor-text]').children].every(e => getComputedStyle(e).opacity === '1'),
          pointers: [...document.querySelectorAll('[data-square-cursor-pointer]')].every(e => getComputedStyle(e).opacity === '0'),
        };
      })()`);
      assert.equal(caption.open, true, target.label);
      assert.equal(caption.text, target.label);
      assert.equal(caption.blend, "normal");
      assert.equal(caption.letters, true);
      assert.equal(caption.pointers, true);
      seen.add(target.index);
      console.log(`PASS: ${target.label}`);
      if (target.label === "INI Hannover") {
        mkdirSync("audit/cursor-caption", { recursive: true });
        const screenshot = await b.send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: false,
        });
        writeFileSync(
          "audit/cursor-caption/capabilities.png",
          Buffer.from(screenshot.data, "base64"),
        );
      }
    }
  }
  assert.deepEqual(
    cards.filter((card) => !seen.has(card.index)),
    [],
    "All 22 cards are reachable and show their caption during real scrolling",
  );
  console.log(
    "PASS: all capabilities images and videos display typed captions without blending",
  );
} finally {
  await b.close();
}

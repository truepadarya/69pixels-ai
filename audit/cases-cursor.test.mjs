import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { browserSession } from "./browser-session.mjs";

const b = await browserSession();
const move = (point) =>
  b.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
  });

try {
  await b.load(1440);
  const labels = await b.evaluate(
    `Array.from(document.querySelectorAll('[data-cases] [data-cursor-label]'), e => e.dataset.cursorLabel)`,
  );
  assert.equal(labels.length, 9);
  for (let index = 0; index < labels.length; index++) {
    await b.evaluate(`(() => {
      const e = document.querySelectorAll('[data-cases] [data-cursor-label]')[${index}];
      const r = e.querySelector('.card_visual').getBoundingClientRect();
      window.scrollTo({ top: scrollY + r.top + r.height / 2 - innerHeight / 2, behavior: 'instant' });
    })()`);
    await b.wait(300);
    const point = await b.evaluate(`(() => {
      const e = document.querySelectorAll('[data-cases] [data-cursor-label]')[${index}];
      const r = e.querySelector('.card_visual').getBoundingClientRect();
      return { x: r.left + r.width * .35, y: r.top + r.height / 2, clipped: getComputedStyle(e.querySelector('.card_content')).clipPath };
    })()`);
    assert.equal(
      point.clipped,
      "inset(50%)",
      "Desktop caption is visually hidden below the media",
    );
    await move(point);
    if (index === 0) {
      await b.wait(200);
      const visible = await b.evaluate(
        `Array.from(document.querySelector('[data-square-cursor-text]').children, e => getComputedStyle(e).opacity === '1')`,
      );
      const firstHidden = visible.indexOf(false);
      assert.ok(firstHidden > 0 && firstHidden < visible.length);
      assert.ok(
        visible.slice(firstHidden).every((value) => !value),
        "Letters type in reading order",
      );
      const expansion = await b.evaluate(`new Promise(resolve => {
        const text = document.querySelector('[data-square-cursor-text]');
        const background = document.querySelector('[data-square-cursor-background]');
        const letters = [...text.children];
        const firstTop = letters.find(e => e.textContent.trim()).offsetTop;
        const secondLetter = letters.find(e => e.textContent.trim() && e.offsetTop > firstTop + 1);
        const style = getComputedStyle(text);
        const firstHeight = parseFloat(style.lineHeight) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        const firstWidth = Math.max(...letters.filter(e => e.textContent.trim() && e.offsetTop === firstTop).map(e => e.getBoundingClientRect().right)) - text.getBoundingClientRect().left + parseFloat(style.paddingRight);
        const fullHeight = text.parentElement.offsetHeight;
        const samples = [];
        const until = performance.now() + 1600;
        const sample = () => {
          samples.push({ height: background.getBoundingClientRect().height, width: background.getBoundingClientRect().width, secondPrinted: getComputedStyle(secondLetter).opacity === '1' });
          if (performance.now() < until) requestAnimationFrame(sample);
          else resolve({ firstHeight, firstWidth, fullHeight, samples });
        };
        sample();
      })`);
      const beforeSecond = expansion.samples.filter(
        (sample) => !sample.secondPrinted,
      );
      assert.ok(beforeSecond.length > 3, "First line has its own typing phase");
      assert.ok(
        beforeSecond.every(
          (sample) => sample.height <= expansion.firstHeight + 0.75,
        ),
        "Background stays one line tall until second-line typing starts",
      );
      assert.ok(
        beforeSecond.every(
          (sample) => sample.width <= expansion.firstWidth + 0.75,
        ),
        "First-line background fits its text",
      );
      assert.ok(
        expansion.samples.filter(
          (sample) =>
            sample.secondPrinted &&
            sample.height > expansion.firstHeight + 0.75 &&
            sample.height < expansion.fullHeight - 0.75,
        ).length >= 3,
        "Background expands smoothly while the second line types",
      );
    }
    await b.wait(labels[index].length * 35 + 200);
    const result = await b.evaluate(`(() => {
      const e = document.querySelector('[data-square-cursor-text]');
      const chars = [...e.children].filter(e => e.textContent.trim()).map(e => ({ x: e.getBoundingClientRect().x, y: e.getBoundingClientRect().y }));
      const lines = [...new Set(chars.map(c => Math.round(c.y)))];
      const starts = lines.map(y => chars.find(c => Math.round(c.y) === y).x);
      const background = document.querySelector('[data-square-cursor-background]').getBoundingClientRect();
      const rightGap = background.right - Math.max(...[...e.children].filter(e => e.textContent.trim()).map(e => e.getBoundingClientRect().right));
      return {
        open: e.parentElement.classList.contains('is-visible'), text: e.textContent,
        lines: lines.length, starts, rightGap, align: getComputedStyle(e).textAlign,
        printed: [...e.children].every(e => getComputedStyle(e).opacity === '1'),
      };
    })()`);
    assert.equal(result.open, true);
    assert.equal(result.text, labels[index]);
    assert.equal(result.printed, true);
    assert.equal(result.align, "left");
    assert.ok(
      result.rightGap >= 3.5 && result.rightGap <= 5.5,
      `Background fits content with only its small padding: ${labels[index]} (${result.rightGap})`,
    );
    assert.ok(result.lines <= 2, `At most two lines: ${labels[index]}`);
    if (index === 0) {
      assert.equal(result.lines, 2, "Long caption wraps into two lines");
      assert.ok(
        Math.abs(result.starts[0] - result.starts[1]) < 1,
        "Both lines begin at the left edge",
      );
      mkdirSync("audit/cursor-caption", { recursive: true });
      const shot = await b.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      writeFileSync(
        "audit/cursor-caption/cases-desktop.png",
        Buffer.from(shot.data, "base64"),
      );
    }
    console.log(`PASS desktop: ${labels[index]} (${result.lines} lines)`);
  }

  await b.load(390);
  const mobile = await b.evaluate(
    `Array.from(document.querySelectorAll('[data-cases] .card_content'), e => ({ clip: getComputedStyle(e).clipPath, height: e.getBoundingClientRect().height }))`,
  );
  assert.equal(mobile.length, 9);
  assert.ok(
    mobile.every((e) => e.clip === "none" && e.height > 20),
    "All mobile captions remain below cards",
  );
  await b.evaluate(
    `document.querySelector('[data-cases]').scrollIntoView({ block: 'start', behavior: 'instant' })`,
  );
  await b.wait(250);
  const mobilePoint = await b.evaluate(
    `(() => { const r = document.querySelector('[data-cases] .card_visual').getBoundingClientRect(); return { x: r.left + r.width / 2, y: Math.max(1, Math.min(innerHeight - 1, r.top + r.height / 2)) }; })()`,
  );
  await move(mobilePoint);
  await b.wait(250);
  assert.equal(
    await b.evaluate(
      `document.querySelector('[data-square-cursor-caption]').classList.contains('is-visible')`,
    ),
    false,
    "Case cursor captions are desktop only",
  );

  await b.load(1440, true);
  assert.ok(
    await b.evaluate(
      `Array.from(document.querySelectorAll('[data-cases] .card_content')).every(e => getComputedStyle(e).clipPath === 'none')`,
    ),
    "Captions stay visible when the custom cursor is disabled",
  );
  console.log(
    "PASS: desktop hover, sequential two-line typing, left alignment, mobile captions and reduced-motion fallback",
  );
} finally {
  await b.close();
}

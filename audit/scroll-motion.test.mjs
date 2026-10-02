import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const origin = process.env.MOTION_TEST_URL || "http://localhost:4321";
const tabs = await (await fetch("http://localhost:9223/json")).json();
const tab = tabs.find((tab) => tab.type === "page");
assert.ok(tab, "Start a headless browser with remote debugging on port 9223");
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve) =>
  ws.addEventListener("open", resolve, { once: true }),
);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  message.error ? reject(message.error) : resolve(message.result);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  assert.equal(
    result.exceptionDetails,
    undefined,
    JSON.stringify(result.exceptionDetails),
  );
  return result.result?.value;
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 1200));
const scrollTo = async (position) => {
  await evaluate(`window.scrollTo(0, ${position})`);
  await settle();
};
const top = (selector) =>
  evaluate(
    `document.querySelector('${selector}').getBoundingClientRect().top + scrollY`,
  );
const activeCase = () =>
  evaluate(
    `Number(document.querySelector('[data-case-copy].is-active').dataset.caseCopy)`,
  );
const screenshot = async (name) => {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`audit/${name}.png`, Buffer.from(shot.data, "base64"));
};
const source = await (
  await fetch(
    `${origin}/src/components/SectionCases.astro?astro&type=script&index=0&lang.ts`,
  )
).text();
const moduleUrl = source.match(/from "([^"]*gsap_ScrollTrigger[^"]*)"/)[1];
const loadTriggers = () =>
  evaluate(
    `(async () => { window.motionTestTriggers = (await import('${moduleUrl}')).ScrollTrigger; })()`,
  );

try {
  await send("Page.enable");
  for (const [width, height] of [
    [1440, 900],
    [768, 900],
    [390, 844],
  ]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    await send("Page.navigate", { url: origin });
    await settle();
    await evaluate("document.fonts.ready");
    await settle();
    await loadTriggers();
    assert.equal(
      await evaluate(
        `document.body.textContent.includes('Here’s what that looks')`,
      ),
      false,
      "Removed caption",
    );

    const casesTop = await top("#cases");
    await scrollTo(casesTop);
    assert.equal(await activeCase(), 0, `${width}: first case at entry`);
    assert.equal(
      await evaluate(
        `getComputedStyle(document.querySelector('[data-case-group="0"]')).opacity`,
      ),
      "1",
    );
    await screenshot(`cases-${width}`);
    await scrollTo(await top('[data-case-group="1"]'));
    assert.equal(await activeCase(), 1, `${width}: second case`);
    await scrollTo(casesTop);
    assert.equal(await activeCase(), 0, `${width}: reverse scroll`);
    await send("Page.reload", { ignoreCache: true });
    await settle();
    await loadTriggers();
    await evaluate("motionTestTriggers.refresh()");
    assert.equal(await activeCase(), 0, `${width}: reload at first case`);

    const creatorsTop = await top("[data-creators-direction]");
    await scrollTo(creatorsTop - height * 0.25);
    const earlyProgress = await evaluate(
      `motionTestTriggers.getAll().filter(t => t.trigger.matches('[data-creators-direction]')).map(t => t.progress)`,
    );
    assert.deepEqual(
      earlyProgress,
      [0, 0],
      `${width}: scene must wait for its section`,
    );
    await scrollTo(creatorsTop + height * 1.8);
    assert.ok(
      await evaluate(
        `Number(getComputedStyle(document.querySelector('[data-phrase="ai"]')).opacity) > 0`,
      ),
      `${width}: scene plays in viewport`,
    );
    await screenshot(`creators-${width}`);

    const pricingTrigger = await evaluate(
      `(() => { const t = motionTestTriggers.getAll().find(t => t.trigger.matches('[data-engagement-pricing-stage]')); return {start:t.start,end:t.end}; })()`,
    );
    await scrollTo(
      pricingTrigger.start + (pricingTrigger.end - pricingTrigger.start) * 0.97,
    );
    const measureSquare = () =>
      evaluate(
        `(() => { const r = document.querySelector('[data-engagement-pricing-square]').getBoundingClientRect(); return {width:r.width,height:r.height}; })()`,
      );
    const square = await measureSquare();
    assert.ok(
      square.width >= width && square.height >= height,
      `${width}: square covers viewport: ${JSON.stringify(square)}`,
    );
    for (let refresh = 0; refresh < 3; refresh++) {
      await evaluate("motionTestTriggers.refresh()");
      await settle();
      const refreshed = await measureSquare();
      assert.ok(
        Math.abs(refreshed.width - square.width) < 2 &&
          Math.abs(refreshed.height - square.height) < 2,
        `${width}: refresh must preserve square scale`,
      );
    }
    await scrollTo(await top(".engagement-pricing_wrap"));
    if (width >= 1024) await scrollTo(pricingTrigger.end - 10);
    assert.ok(
      await evaluate(
        `[...document.querySelectorAll('.pricing-card_wrap')].every(e => Number(getComputedStyle(e).opacity) > .99)`,
      ),
      `${width}: all pricing cards visible`,
    );
    await screenshot(`pricing-${width}`);
    console.log(
      `PASS ${width}: case order, reload, reverse scroll, scene start, square expansion, refresh, pricing`,
    );
  }
  for (const width of [1440, 390, 768, 1440]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    await settle();
    await scrollTo(await top("#cases"));
    await evaluate("motionTestTriggers.refresh()");
    assert.equal(await activeCase(), 0, `${width}: resize without reload`);
    assert.equal(
      await evaluate(
        `motionTestTriggers.getAll().filter(t => t.trigger.matches('[data-cases]')).length`,
      ),
      1,
      "Resize must not duplicate case triggers",
    );
  }
  console.log(
    "PASS live resize: first case remains active, no duplicate triggers",
  );
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await settle();
  assert.equal(
    await evaluate(
      `getComputedStyle(document.querySelector('[data-engagement-pricing-stage]')).display`,
    ),
    "none",
  );
  assert.ok(
    await evaluate(
      `[...document.querySelectorAll('.pricing-card_wrap')].every(e => Number(getComputedStyle(e).opacity) === 1)`,
    ),
  );
  assert.equal(
    await evaluate(
      `getComputedStyle(document.querySelector('[data-phrase="creators"]')).opacity`,
    ),
    "1",
  );
  console.log("PASS reduced motion: pricing remains accessible");
} finally {
  await send("Emulation.setEmulatedMedia", { features: [] });
  ws.close();
}

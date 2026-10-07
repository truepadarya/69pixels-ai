import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { browserSession } from "./browser-session.mjs";

const phase = process.argv[2] ?? "before";
const out = `.tmp-lumos-audit/${phase}`;
mkdirSync(out, { recursive: true });
const browser = await browserSession();
const results = [];
try {
  for (const path of [
    "/",
    "/about",
    "/example-components",
    "/hero-original",
    "/404",
  ]) {
    for (const width of [1440, 390]) {
      await browser.load(width, true, path);
      assert.ok(
        await browser.evaluate("document.title.includes('69pixels')"),
        `${path}: expected the site page, not a dev error page`,
      );
      const metrics = await browser.evaluate(`(() => {
        const selectors = ['main', 'main section', 'h1', 'h2', '.button_wrap', '.hero_logo', '.hero_description > .text'];
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          elements: selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(e => {
            const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
            return { selector, text: e.textContent.trim().slice(0, 60), x: r.x, y: r.y, width: r.width, height: r.height,
              fontSize: s.fontSize, fontWeight: s.fontWeight, color: s.color, background: s.backgroundColor };
          })),
          missingAnchors: [...document.querySelectorAll('a[href^="#"]')].map(e => e.getAttribute('href'))
            .filter(h => h.length > 1 && !document.getElementById(h.slice(1))),
        };
      })()`);
      results.push({ path, width, ...metrics });
      const screenshot = await browser.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      writeFileSync(
        `${out}/${path === "/" ? "home" : path.slice(1)}-${width}.png`,
        Buffer.from(screenshot.data, "base64"),
      );
      console.log(
        `${phase}: ${path} ${width}, overflow=${metrics.overflow}, missing anchors=${metrics.missingAnchors.length}`,
      );
    }
  }
  writeFileSync(`${out}/metrics.json`, JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}

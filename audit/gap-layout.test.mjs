import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { browserSession } from "./browser-session.mjs";
const browser = await browserSession();
const errors = [];
let samples = 0;
try {
  for (const width of [1024, 1440, 1920]) {
    await browser.load(width, false, "/", 900);
    assert.equal(
      await browser.evaluate(
        "!!document.querySelector('img[src*=Concepts_5]')",
      ),
      false,
    );
    const range = await browser.evaluate(
      "(()=>{const r=document.querySelector('[data-capabilities]');return {top:r.getBoundingClientRect().top+scrollY,distance:(r.offsetHeight-r.querySelector('.capabilities_stage').clientHeight)/parseFloat(getComputedStyle(r).getPropertyValue('--capabilities-flow-end'))};})()",
    );
    for (const p of Array.from(
      { length: 31 },
      (_, i) => 0.33 + i * 0.01,
    ).concat([0.75, 0.8, 0.85, 0.9, 0.95, 0.4, 0.37])) {
      await browser.evaluate(
        "window.scrollTo({top:" +
          (range.top + p * range.distance) +
          ',behavior:"instant"})',
      );
      await browser.wait(100);
      const data = await browser.evaluate(
        "(()=>{const root=document.querySelector('[data-capabilities]');return {height:innerHeight,cards:[...root.querySelectorAll('.capabilities_card')].map(e=>{const r=e.getBoundingClientRect();const m=e.querySelector('img,video');return {src:decodeURIComponent(m?.currentSrc||m?.src||'').split('/').pop().split('.')[0],group:e.closest('[data-capabilities-theme]').dataset.capabilitiesTheme,opacity:parseFloat(getComputedStyle(e.querySelector('.capabilities_surface')).opacity),x:r.x,y:r.y,w:r.width,h:r.height};}).filter(r=>r.y<innerHeight&&r.y+r.h>0&&r.x<innerWidth&&r.x+r.w>0&&r.opacity>.01)};})()",
      );
      samples++;
      const a = data.cards.filter((c) => c.group === "visual"),
        b = data.cards.filter((c) => c.group === "product");
      for (const v of a)
        for (const q of b)
          if (
            Math.min(v.x + v.w, q.x + q.w) - Math.max(v.x, q.x) > 1 &&
            Math.min(v.y + v.h, q.y + q.h) - Math.max(v.y, q.y) > 1
          )
            errors.push({ width, p, a: v.src, b: q.src });
      const moved = b.find((c) => c.src === "Concepts_6");
      if (moved)
        for (const q of b.filter((c) => c !== moved))
          if (
            Math.min(moved.x + moved.w, q.x + q.w) - Math.max(moved.x, q.x) >
              1 &&
            Math.min(moved.y + moved.h, q.y + q.h) - Math.max(moved.y, q.y) > 1
          )
            errors.push({ width, p, a: moved.src, b: q.src });
      if (p === 0.4) {
        const gap =
          b.length && a.length
            ? Math.min(...b.map((c) => c.y)) -
              Math.max(...a.map((c) => c.y + c.h))
            : null;
        assert.ok(
          gap !== null && gap >= 45 && gap <= 90,
          "Boundary gap must stay compact without overlap",
        );
        console.log(JSON.stringify({ width, gap }));
        if (width === 1440) {
          const shot = await browser.send("Page.captureScreenshot", {
            format: "png",
          });
          writeFileSync(
            "audit/gap-verified.png",
            Buffer.from(shot.data, "base64"),
          );
        }
      }
    }
  }
  console.log(JSON.stringify({ samples, collisions: errors }));
  assert.equal(errors.length, 0);
} finally {
  await browser.close();
}

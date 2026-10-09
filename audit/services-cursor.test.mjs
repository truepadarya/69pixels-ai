import assert from "node:assert/strict";
import { browserSession } from "./browser-session.mjs";

const b = await browserSession();
const move = (x, y) =>
  b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
try {
  await b.load(1650, false, "/", 1000);
  await b.evaluate(
    `(()=>{const e=document.querySelector('[data-services-overview]');window.scrollTo({top:e.getBoundingClientRect().top+scrollY+e.offsetHeight-innerHeight*.85,behavior:'instant'})})()`,
  );
  await b.wait(800);
  const zones = await b.evaluate(
    `[...document.querySelectorAll('[data-cursor-gallery]')].map(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return {left:r.left,right:r.right,y:r.top+r.height/2,rowRight:p.right,count:JSON.parse(e.dataset.cursorGallery).length}})`,
  );
  assert.equal(zones.length, 4);
  assert(zones.every((z) => z.count === 8));
  const zone = zones[0];
  assert(
    zone.right < zone.rowRight - 100,
    "Empty right margin is outside the gallery zone",
  );
  await move(zone.left - 20, zone.y);
  await b.wait(200);
  assert.equal(
    await b.evaluate(
      `document.querySelector('[data-square-cursor-gallery]').classList.contains('is-visible')`,
    ),
    false,
  );
  await move(zone.left + 20, zone.y);
  const frames = await b.evaluate(
    `new Promise(resolve=>{const a=[],start=performance.now();function sample(){const e=document.querySelector('[data-square-cursor-gallery]'),s=getComputedStyle(e),v=s.clipPath.match(/[0-9.]+/g)||[];a.push({size:e.offsetWidth,side:e.offsetWidth-Number(v[1]||0),opacity:Number(getComputedStyle(e.querySelector('img')).opacity),height:e.offsetHeight});if(performance.now()-start<500)requestAnimationFrame(sample);else resolve(a)}sample()})`,
  );
  assert(
    new Set(frames.map((f) => Math.round(f.side))).size > 5,
    "Opening expands across multiple animation frames",
  );
  assert(
    frames.some((f) => f.opacity > 0.1 && f.side < f.size - 20),
    "Image appears during expansion",
  );
  assert(Math.abs(frames.at(-1).size - 285) < 2);
  assert.equal(frames.at(-1).size, frames.at(-1).height);
  const first = await b.evaluate(
    `document.querySelector('[data-square-cursor-gallery] img').src`,
  );
  await b.wait(600);
  assert.notEqual(
    await b.evaluate(
      `document.querySelector('[data-square-cursor-gallery] img').src`,
    ),
    first,
  );
  await move(zone.right + 20, zone.y);
  await b.wait(240);
  assert.equal(
    await b.evaluate(
      `document.querySelector('[data-square-cursor-gallery]').classList.contains('is-visible')`,
    ),
    false,
  );
  await b.send("Emulation.setDeviceMetricsOverride", {
    width: 1200,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  assert(
    Math.abs(
      (await b.evaluate(
        `document.querySelector('[data-square-cursor-gallery]').offsetWidth`,
      )) - 207,
    ) < 2,
  );
  console.log(
    "PASS: bounded hover zone, smooth image reveal, 285px square, fast slideshow, exit and responsive size",
  );
} finally {
  await b.close();
}

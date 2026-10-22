import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { browserSession } from "./browser-session.mjs";
const b = await browserSession();
const out = ".astro/mobile-usability";
await fs.mkdir(out, { recursive: true });
async function tap(selector) {
  await b.evaluate(
    `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',inline:'center',behavior:'instant'})`,
  );
  await b.wait(700);
  const p = await b.evaluate(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})()`,
  );
  assert.ok(p.hit, `Obscured target: ${selector}`);
  await b.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: p.x, y: p.y }],
  });
  await b.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await b.wait(200);
}
try {
  await b.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  for (const [w, h] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [667, 375],
    [844, 390],
    [768, 1024],
    [1024, 768],
    [1280, 800],
  ]) {
    await b.load(w, false, "/", h);
    const layout = await b.evaluate(
      `(()=>{const box=document.querySelector('.lynq-story_wrap.workflow'),title=box.querySelector('h4').getBoundingClientRect(),steps=[...box.querySelectorAll('li')].map(e=>e.getBoundingClientRect()),r=box.getBoundingClientRect();return{titleBottom:title.bottom,steps:steps.map(e=>({top:e.top,bottom:e.bottom})),bottom:r.bottom,overflow:document.documentElement.scrollWidth>innerWidth}})()`,
    );
    assert.equal(layout.overflow, false);
    assert.ok(layout.titleBottom < layout.steps[0].top);
    for (let i = 0; i < layout.steps.length; i++) {
      assert.ok(layout.steps[i].bottom < layout.bottom);
      if (i) assert.ok(layout.steps[i].top >= layout.steps[i - 1].bottom + 4);
    }
    for (const selector of ["[data-screens-control]"]) {
      assert.ok(
        await b.evaluate(
          `!!document.querySelector(${JSON.stringify(selector)})`,
        ),
      );
      await tap(selector);
      assert.equal(
        await b.evaluate(
          `document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-pressed')`,
        ),
        "true",
      );
    }
    await tap(".product-variations_arrow");
    assert.equal(
      await b.evaluate(
        `document.querySelector('[data-product-variations]').dataset.variationIndex`,
      ),
      "1",
    );
    await tap(".cta-project_input");
    await b.send("Input.insertText", { text: "A mobile project & design" });
    assert.equal(
      await b.evaluate(`document.activeElement.matches('.cta-project_input')`),
      true,
    );
    assert.ok(
      await b.evaluate(
        `decodeURIComponent(document.querySelector('[data-project-email]').href).includes('A mobile project & design')`,
      ),
    );
    await b.evaluate("document.activeElement.blur()");
    for (const selector of [
      ".services-overview_wrap",
      ".work-setup-section_wrap",
      ".footer_wrap",
      ".cta-project_content",
    ]) {
      if (
        !(await b.evaluate(
          `!!document.querySelector(${JSON.stringify(selector)})`,
        ))
      )
        continue;
      await b.evaluate(
        `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start',behavior:'instant'})`,
      );
      await b.wait(600);
      assert.equal(
        await b.evaluate(`document.documentElement.scrollWidth>innerWidth`),
        false,
      );
      if (w === 320 || w === 844) {
        const shot = await b.send("Page.captureScreenshot", { format: "png" });
        await fs.writeFile(
          out + "/" + w + "-" + selector.slice(1) + ".png",
          Buffer.from(shot.data, "base64"),
        );
      }
    }
    await tap('.services-overview_term-link[href="#dedicated-subscription"]');
    await b.wait(1600);
    const anchor = await b.evaluate(
      `(()=>{const r=document.querySelector('#dedicated-subscription').getBoundingClientRect();return{top:r.top,hash:location.hash}})()`,
    );
    assert.equal(anchor.hash, "#dedicated-subscription");
    assert.ok(anchor.top > 50 && anchor.top < 220, JSON.stringify(anchor));
    const targets = await b.evaluate(
      `(()=>{document.querySelector('.footer_wrap').scrollIntoView({behavior:'instant'});return [...document.querySelectorAll('.footer_link,.services-overview_term-link,[data-screens-control],.product-variations_arrow')].map(e=>({name:e.textContent.trim(),height:e.getBoundingClientRect().height}))})()`,
    );
    for (const t of targets) assert.ok(t.height >= 44, JSON.stringify(t));
    const work = await b.evaluate(
      `(()=>{const a=document.querySelector('.footer_links li:nth-child(2) a');return !!document.querySelector(new URL(a.href).hash)})()`,
    );
    assert.ok(work);
    console.log(
      "PASS",
      w,
      h,
      "workflow, tap controls, editable input, contact email, sections, anchors, touch targets",
    );
  }
} finally {
  await b.close();
}

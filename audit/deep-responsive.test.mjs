import assert from "node:assert/strict";
import { browserSession } from "./browser-session.mjs";
const b = await browserSession();
try {
  await b.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  for (const [width, height, font = 16, reduced = false] of [
    [280, 653],
    [320, 480],
    [360, 640],
    [375, 667],
    [393, 852],
    [412, 915],
    [540, 720],
    [600, 960],
    [768, 1024],
    [800, 1280],
    [820, 1180],
    [912, 1368],
    [1024, 1366],
    [1180, 820],
    [1366, 1024],
    [568, 320],
    [740, 360],
    [932, 430],
    [320, 480, 24],
    [390, 844, 24],
    [768, 1024, 24],
    [390, 844, 32],
    [390, 844, 24, true],
    [820, 1180, 24, true],
  ]) {
    await b.load(width, reduced, "/", height);
    await b.evaluate(`document.documentElement.style.fontSize='${font}px'`);
    await b.wait(600);
    const layout = await b.evaluate(
      `(()=>{const rect=e=>e.getBoundingClientRect();return{width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,issues:[...document.querySelectorAll('.story-card .centered-cases_frame')].flatMap(frame=>[...frame.querySelectorAll('h4,h5,p,dt,dd,li,span')].filter(e=>!e.classList.contains('sr-only')&&!e.closest('.sr-only')&&e.textContent.trim()).flatMap(e=>{const r=rect(e),f=rect(frame);const font=parseFloat(getComputedStyle(e).fontSize);return [...(r.right>f.right+1||r.left<f.left-1||r.bottom>f.bottom+1?[{type:'clipped',c:e.className,t:e.textContent.trim().slice(0,30)}]:[]),...(!e.children.length&&font<11.9?[{type:'tiny',font,t:e.textContent.trim().slice(0,30)}]:[])]})),workflow:[...document.querySelectorAll('.lynq-story_wrap.workflow')].map(e=>({title:rect(e.querySelector('h4')).bottom,steps:[...e.querySelectorAll('li')].map(e=>({top:rect(e).top,bottom:rect(e).bottom}))})),illustrations:[...document.querySelectorAll('.rebuilding_illustration')].map(e=>e.offsetHeight),price:(()=>{const e=document.querySelector('.work-subscription_price-row');return{width:e.clientWidth,scroll:e.scrollWidth}})()}})()`,
    );
    const name = `${width}x${height} font ${font}${reduced ? " reduced" : ""}`;
    assert.ok(
      layout.scrollWidth <= layout.width + 1,
      `${name}: page overflow ${layout.scrollWidth}`,
    );
    assert.deepEqual(layout.issues, [], name);
    assert.ok(
      layout.price.scroll <= layout.price.width + 1,
      `${name}: price overflow`,
    );
    for (const h of layout.illustrations)
      assert.ok(h >= 60, `${name}: collapsed illustration ${h}`);
    for (const c of layout.workflow) {
      assert.ok(c.title < c.steps[0].top);
      for (let i = 1; i < c.steps.length; i++)
        assert.ok(c.steps[i].top >= c.steps[i - 1].bottom + 10);
    }
    console.log(
      "PASS",
      name,
      "readability, text bounds, price wrapping, illustrations, workflow spacing",
    );
  }
  await b.send("Emulation.setTouchEmulationEnabled", {
    enabled: false,
    maxTouchPoints: 1,
  });
  await b.load(1440);
  const desktop = await b.evaluate(
    `({workflow:getComputedStyle(document.querySelector('.lynq-story_steps')).position,card:getComputedStyle(document.querySelector('.lynq-story_wrap.workflow')).display,production:getComputedStyle(document.querySelector('.production-story_content')).position})`,
  );
  assert.equal(desktop.workflow, "absolute");
  assert.equal(desktop.card, "block");
  assert.equal(desktop.production, "absolute");
  console.log("PASS desktop retains original graphic layouts");
} finally {
  await b.close();
}

import assert from "node:assert/strict";
import { browserSession } from "./browser-session.mjs";
const b = await browserSession();
const load = async (...args) => {
  await b.send("Page.navigate", { url: "about:blank" });
  await b.load(...args);
};
const check = async (label) => {
  const state = await b.evaluate(
    `(()=>{const cases=document.querySelector('#cases'),stage=document.querySelector('.rebuilding_stage');return {top:cases.getBoundingClientRect().top,margin:parseFloat(getComputedStyle(cases).scrollMarginTop),hash:location.hash,active:document.querySelector('[data-case-copy].is-active')?.dataset.caseCopy,stagePosition:getComputedStyle(stage).position,titleOpacity:getComputedStyle(document.querySelector(".rebuilding_title")).opacity,reduced:matchMedia("(prefers-reduced-motion: reduce)").matches,hit:!!document.elementFromPoint(innerWidth*.75,innerHeight*.55)?.closest('#cases'),behavior:getComputedStyle(document.documentElement).scrollBehavior}})()`,
  );
  assert(
    Math.abs(state.top - state.margin) <= 1.1,
    `${label}: ${JSON.stringify(state)}`,
  );
  assert.equal(state.hash, "#cases");
  assert.equal(state.active, "0");
  assert.notEqual(state.stagePosition, "fixed");
  assert.equal(state.hit, true);
  assert.equal(state.behavior, "auto");
  if (!state.reduced)
    assert(
      Number(state.titleOpacity) < 0.001,
      `${label}: Rebuilding title must be hidden after its scene`,
    );
  console.log("PASS", label);
};
try {
  for (const [width, reduced] of [
    [1440, false],
    [390, false],
    [1440, true],
  ]) {
    await load(width, reduced);
    for (let repeat = 0; repeat < 2; repeat++) {
      await b.evaluate(
        `scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});document.querySelector('.footer_link[href$="#cases"]').click()`,
      );
      await b.wait(reduced ? 500 : 1500);
      await check(`Work ${width} reduced=${reduced} repeat=${repeat}`);
    }
    await load(width, reduced, "/#cases");
    await check(`direct hash ${width} reduced=${reduced}`);
  }
  await load(1440, false, "/#cases");
  const source = await (
    await fetch(
      "http://localhost:4321/src/components/ScrollLetters.astro?astro&type=script&index=0&lang.ts",
    )
  ).text();
  const moduleUrl = source.match(
    /from "([^"\n]*gsap_ScrollTrigger[^"\n]*)"/,
  )[1];
  await b.evaluate(
    `(async()=>{window.workTriggers=(await import('${moduleUrl}')).ScrollTrigger})()`,
  );
  for (let repeat = 0; repeat < 3; repeat++) {
    await b.evaluate("workTriggers.refresh()");
    await b.wait(500);
    await check(`refresh after Work ${repeat}`);
  }
  const early = await b.evaluate(
    `(()=>{const stage=document.querySelector('.rebuilding_stage'),t=workTriggers.getAll().find(t=>t.pin===stage);return t.start+(t.end-t.start)*.15})()`,
  );
  await b.evaluate(`scrollTo({top:${early},behavior:'instant'})`);
  await b.wait(800);
  assert(
    Number(
      await b.evaluate(
        "getComputedStyle(document.querySelector('.rebuilding_title')).opacity",
      ),
    ) > 0.99,
  );
  console.log("PASS reverse scrolling restores Rebuilding title");
  await load(1440, false);
  await b.send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: 700,
    y: 600,
    deltaY: 100000,
    deltaX: 0,
  });
  for (let i = 0; i < 100; i++) {
    if (
      await b.evaluate(
        `document.querySelector('.footer_wrap').getBoundingClientRect().top<innerHeight`,
      )
    )
      break;
    await b.wait(30);
  }
  await b.evaluate(
    `document.querySelector('.footer_link[href$="#cases"]').click()`,
  );
  await b.wait(1500);
  await check("Work while scrolling");
} finally {
  await b.close();
}

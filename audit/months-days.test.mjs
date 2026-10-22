import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { browserSession } from "./browser-session.mjs";

const b = await browserSession();
const script = async (name) =>
  await (
    await fetch(
      `http://localhost:4321/src/components/${name}.astro?astro&type=script&index=0&lang.ts`,
    )
  ).text();
const gsapUrl = (await script("ContentMonthsDays")).match(
  /import \{ gsap \} from "([^"]+)"/,
)[1];
const stUrl = (await script("ScrollLetters")).match(
  /from "([^"]*gsap_ScrollTrigger[^"]*)"/,
)[1];
const state = () =>
  b.evaluate(`(() => {
 const g=document.querySelector('[data-months-days]'), box=g.querySelector('.months-days_border'),outline=g.querySelector('.months-days_outline');
 const glyphs=[...g.querySelectorAll('.months-days_glyph')];
 const visible=glyphs.filter(e=>Number(getComputedStyle(e).opacity)>.5);
 const caret=g.querySelector('.months-days_caret');

 return {width:Number(box.getAttribute('width')),x:Number(box.getAttribute('x')),monthsX:Number(outline.getAttribute('x')),word:visible.map(e=>e.textContent).join(''),hasCaret:!!caret,selection:Number(getComputedStyle(g.querySelector('.months-days_selection')).opacity),image:g.querySelector('img').complete&&g.querySelector('img').naturalWidth>0,overflow:document.documentElement.scrollWidth>innerWidth};
})()`);
const shot = async (name) => {
  const result = await b.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`audit/months-${name}.png`, Buffer.from(result.data, "base64"));
};
try {
  for (const width of [1440, 768, 390]) {
    await b.load(width);
    await b.evaluate("window.scrollTo(0,0)");
    await b.wait(600);
    await b.evaluate(
      `(async()=>{const gsap=(await import('${gsapUrl}')).gsap;window.monthsTimeline=gsap.globalTimeline.getChildren(true,true,true).find(t=>t.targets?.().includes(document.querySelector('.months-days_selection'))).parent; const st=(await import('${stUrl}')).ScrollTrigger;const t=st.getAll().find(t=>t.pin&&t.trigger?.matches('[data-rebuilding]'));window.monthsScene={start:t.start,end:t.end};window.scrollTo(0,t.start+(t.end-t.start)*.5);})()`,
    );
    await b.wait(2200);
    let final = await state();
    assert.equal(final.word, "days");
    assert.equal(final.monthsX, 196);
    assert.equal(final.width, 127.854);
    assert.ok(final.image);
    assert.ok(!final.overflow);
    await shot(width);
    await b.evaluate("monthsTimeline.pause(0);void 0;");
    let previous = 141;
    for (const time of [0.2, 0.24, 0.4, 0.54, 0.72, 0.9, 1.2, 1.4]) {
      await b.evaluate(`monthsTimeline.time(${time});void 0;`);
      const s = await state();
      assert.ok(
        s.monthsX >= previous,
        `${width}: months moves continuously forward`,
      );
      previous = s.monthsX;
      if (time <= 0.24)
        assert.equal(s.width, 0, "selection waits for mouse arrival");
      assert.equal(s.hasCaret, false, "Typing caret is removed");
      if (width === 1440 && [0.2, 0.4, 0.72, 1.2].includes(time))
        await shot(`frame-${time}`);
    }
    await b.evaluate("window.scrollTo(0,monthsScene.start);");
    await b.wait(1400);
    assert.equal((await state()).word, "", "reset on reverse scroll");
    await b.evaluate(
      "window.scrollTo(0,monthsScene.start+(monthsScene.end-monthsScene.start)*.5);",
    );
    await b.wait(2200);
    assert.equal((await state()).word, "days", "replays on entry");
    await b.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await b.wait(300);
    final = await state();
    assert.equal(final.word, "days");
    assert.equal(final.width, 127.854);
    assert.equal(final.selection, 1);
    console.log(
      `PASS ${width}: cursor arrives first, typing without caret, continuous expansion, replay, reduced motion`,
    );
  }
} finally {
  await b.close();
}

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { browserSession } from "./browser-session.mjs";

const browser = await browserSession();
const source = await (
  await fetch(
    "http://localhost:4321/src/components/ScrollLetters.astro?astro&type=script&index=0&lang.ts",
  )
).text();
const moduleUrl = source.match(/from "([^"]*gsap_ScrollTrigger[^"]*)"/)[1];
const dockSource = await (
  await fetch(
    "http://localhost:4321/src/components/ContentToolsDock.astro?astro&type=script&index=0&lang.ts",
  )
).text();
const gsapUrl = dockSource.match(/import \{ gsap \} from "([^"]+)"/)[1];
const state = () =>
  browser.evaluate(`(() => {
  const dock = document.querySelector('[data-tools-dock]');
  const rect = dock.getBoundingClientRect();
  const studio = dock.querySelector('.studio');
  const glass = getComputedStyle(dock.querySelector('.tools-dock_glass'));
  return { opacity: Number(getComputedStyle(studio).opacity), layoutOpacity: Number(getComputedStyle(dock.firstElementChild).opacity),
    width: rect.width, height: rect.height, clip: glass.clipPath, blur: glass.backdropFilter,
    imagesLoaded: [...dock.querySelectorAll('img')].every(i => i.complete && i.naturalWidth > 0),
    iconWidths: [...dock.querySelectorAll('img')].map(i => i.getBoundingClientRect().width),
    overflow: document.documentElement.scrollWidth > innerWidth };
})()`);
const scroll = async (position) => {
  await browser.evaluate(`window.scrollTo(0, ${position})`);
  await browser.wait(1300);
};
try {
  for (const width of [1440, 768, 390]) {
    await browser.load(width);
    await scroll(0);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (
        await browser.evaluate(
          `document.querySelector('.tools-dock_layout').style.opacity !== ''`,
        )
      )
        break;
      await browser.wait(100);
    }
    await browser.evaluate(
      `(async () => { window.dockTriggers = (await import('${moduleUrl}')).ScrollTrigger; })()`,
    );
    const trigger = await browser.evaluate(`(() => {
      const t = dockTriggers.getAll().find(t => t.trigger?.matches('[data-rebuilding]') && t.pin);
      return { start: t.start, end: t.end };
    })()`);
    await browser.evaluate(
      `(async()=>{const g=(await import('${gsapUrl}')).gsap;window.dockTestTimeline=g.globalTimeline.getChildren(true,true,true).find(t=>t.targets?.().includes(document.querySelector('.tools-dock_icon.studio'))).parent;})()`,
    );
    assert.equal(
      (await state()).opacity,
      0,
      `${width}: new icon waits for entry`,
    );
    await scroll(trigger.start + (trigger.end - trigger.start) * 0.4);
    const final = await state();
    assert.equal(final.opacity, 1, `${width}: observer plays reveal`);
    assert.equal(final.layoutOpacity, 1);
    assert.ok(final.imagesLoaded);
    assert.ok(!final.overflow);
    assert.ok(final.blur.includes("blur("));
    assert.ok(final.clip.startsWith("inset(0px 0%"));
    assert.ok(
      Math.max(...final.iconWidths) - Math.min(...final.iconWidths) < 0.1,
    );
    const shot = await browser.send("Page.captureScreenshot", {
      format: "png",
    });
    writeFileSync(`audit/dock-${width}.png`, Buffer.from(shot.data, "base64"));
    for (const time of [0.06, 0.09, 0.12, 0.18, 0.3, 0.5, 0.7]) {
      const frame = await browser.evaluate(`(() => {
        dockTestTimeline.pause().time(${time});
        const d=document.querySelector('[data-tools-dock]');
        const finder=d.querySelector('.finder').getBoundingClientRect();
        const studio=d.querySelector('.studio').getBoundingClientRect();
        const settings=d.querySelector('.settings').getBoundingClientRect();
        const a=d.querySelector('.tools-dock_left').getCTM(),m=d.querySelector('.tools-dock_middle').getCTM();
        return {opacity:Number(getComputedStyle(d.querySelector('.studio')).opacity),leftGap:studio.left-finder.right,rightGap:settings.left-studio.right,join:Math.abs((52.5*a.a+a.e)-(52.5*m.a+m.e))};
      })()`);
      assert.ok(frame.join < 0.1, `${width} at ${time}: continuous rim`);
      if (time === 0.12) {
        assert.ok(
          frame.opacity > 0.5,
          `${width}: middle icon appears without a long delay`,
        );
      }
      if (frame.opacity > 0.05) {
        assert.ok(
          frame.leftGap >= -0.5 && frame.rightGap >= -0.5,
          `${width} at ${time}: icons never overlap`,
        );
      }
    }
    await browser.evaluate("dockTestTimeline.progress(1).play();void 0;");
    await scroll(trigger.start);
    assert.equal(
      (await state()).opacity,
      0,
      `${width}: reset after returning below viewport`,
    );
    await scroll(trigger.start + (trigger.end - trigger.start) * 0.4);
    assert.equal((await state()).opacity, 1, `${width}: replays on re-entry`);
    await browser.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await browser.wait(300);
    const reduced = await state();
    assert.equal(
      reduced.opacity,
      1,
      `${width}: reduced motion shows final icon`,
    );
    assert.equal(reduced.layoutOpacity, 1);
    console.log(
      `PASS ${width}: entry, replay, glass, equal icon sizes, reduced motion, no overflow`,
    );
  }
  await browser.load(1440, true);
  assert.equal(
    (await state()).opacity,
    1,
    "initial reduced-motion visit has final state",
  );
  console.log("PASS initial reduced-motion visit");
} finally {
  await browser.close();
}

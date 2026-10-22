import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { browserSession } from "./browser-session.mjs";
const b = await browserSession();
const src = await (
  await fetch(
    "http://localhost:4321/src/components/ScrollLetters.astro?astro&type=script&index=0&lang.ts",
  )
).text();
const url = src.match(/from "([^"]*gsap_ScrollTrigger[^"]*)"/)[1];
try {
  for (const width of [1440, 768, 390]) {
    await b.load(width);
    await b.evaluate(
      `(async()=>{const st=(await import('${url}')).ScrollTrigger;const t=st.getAll().find(t=>t.pin&&t.trigger?.matches('[data-rebuilding]'));scrollTo(0,t.start+(t.end-t.start)*.47);})()`,
    );
    await b.wait(1800);
    const cards = await b.evaluate(`['dark','light'].map(tone=>{
   const c=document.querySelector('.rebuilding_card.'+tone),h=c.querySelector('.rebuilding_card-title'),f=c.querySelector('.rebuilding_card-caption'),g=c.querySelector(tone==='dark'?'[data-tools-dock]':'[data-months-days]');
   let top=g.offsetTop,parent=g.offsetParent;
   while(parent&&parent!==c){top+=parent.offsetTop;parent=parent.offsetParent;}
   const style=getComputedStyle(f);
   return {tone,above:top-h.offsetTop-h.offsetHeight,below:f.offsetTop-top-g.offsetHeight,font:style.fontSize,family:style.fontFamily,height:f.offsetHeight,line:Number.parseFloat(style.lineHeight),text:f.textContent.trim()};
  })`);
    for (const c of cards) {
      assert.ok(
        Math.abs(c.above - c.below) <= 2,
        `${width} ${c.tone}: equal gaps ${JSON.stringify(c)}`,
      );
      assert.equal(c.font, "14px");
      assert.ok(c.family.includes("Mono") || c.family.includes("mono"));
      if (c.tone === "light" && width >= 1024)
        assert.ok(c.height <= c.line, "second caption is one line");
    }
    const shot = await b.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(
      `audit/captions-${width}.png`,
      Buffer.from(shot.data, "base64"),
    );
    console.log("PASS", width, JSON.stringify(cards));
  }
} finally {
  await b.close();
}

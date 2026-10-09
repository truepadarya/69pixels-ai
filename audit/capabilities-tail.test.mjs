import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { browserSession } from "./browser-session.mjs";
const b = await browserSession();
try {
  for (const width of [1440, 768, 390]) {
    await b.load(width, false, "/", 900);
    const range = await b.evaluate(
      "(()=>{const r=document.querySelector('[data-capabilities]');return {top:r.getBoundingClientRect().top+scrollY,distance:r.offsetHeight-r.querySelector('.capabilities_stage').clientHeight,height:r.offsetHeight,end:parseFloat(getComputedStyle(r).getPropertyValue('--capabilities-flow-end'))};})()",
    );
    assert.equal(
      await b.evaluate(
        "document.querySelectorAll('[data-capabilities] .capabilities_title').length",
      ),
      5,
    );
    await b.evaluate(
      "window.scrollTo({top:" +
        (range.top - 900 * 0.28) +
        ',behavior:"instant"})',
    );
    await b.wait(400);
    assert.equal(
      await b.evaluate(
        "parseFloat(getComputedStyle(document.querySelector('[data-capabilities] .capabilities_title .heading')).opacity)",
      ),
      0,
    );
    await b.evaluate(
      "window.scrollTo({top:" + (range.top - 15) + ',behavior:"instant"})',
    );
    await b.wait(400);
    assert.ok(
      await b.evaluate(
        "parseFloat(getComputedStyle(document.querySelector('[data-capabilities] .capabilities_title .heading')).opacity)>.9",
      ),
    );
    for (const p of [0.88, 0.92, 0.96, 0.99, 1]) {
      await b.evaluate(
        "window.scrollTo({top:" +
          (range.top + p * range.distance) +
          ',behavior:"instant"})',
      );
      await b.wait(500);
      const data = await b.evaluate(
        "(()=>{const r=document.querySelector('[data-capabilities]');const last=[...r.querySelectorAll('img')].find(i=>decodeURIComponent(i.currentSrc||i.src).includes('dev_5'));const card=last.closest('.capabilities_card').getBoundingClientRect();const n=document.querySelector('[data-rebuilding]');return {stageOpacity:parseFloat(getComputedStyle(r.querySelector('.capabilities_stage')).opacity),stageTop:r.querySelector('.capabilities_stage').getBoundingClientRect().top,title:[...r.querySelectorAll('.capabilities_title')].filter(t=>parseFloat(getComputedStyle(t).opacity)>.5).map(t=>t.textContent.trim()),lastCard:{top:card.top,bottom:card.bottom},nextTop:n.getBoundingClientRect().top,nextHeadingOpacity:parseFloat(getComputedStyle(n.querySelector('.rebuilding_words')).opacity),eco:[...r.querySelectorAll('video')].some(v=>v.src.includes('Concepts_6'))};})()",
      );
      assert.equal(data.eco, false);
      if (p === 0.92) assert.equal(data.stageOpacity, 1, "Keep the final heading readable before fading");
      if (p === 0.96)
        assert.ok(
          data.stageOpacity > 0 && data.stageOpacity < 1,
          "Final heading must dissolve gradually",
        );
      if (p === 0.99) {
        assert.equal(
          data.stageOpacity,
          0,
          "Heading must disappear before unpinning",
        );
        assert.ok(
          Math.abs(data.stageTop) < 1,
          "Fade must finish while the stage is pinned",
        );
      }
      assert.deepEqual(data.title, ["Design to Development"]);
      if (p === 0.92)
        assert.ok(data.lastCard.bottom > 0 && data.lastCard.top < 900);
      if (p === 1) {
        assert.ok(
          Math.abs(data.nextTop) < 2,
          "Next section must reach top as the flow ends",
        );
        assert.ok(
          data.nextHeadingOpacity > 0.9,
          "Next content must already be visible",
        );
      }
      console.log(JSON.stringify({ width, p, ...data }));
      if (width === 1440 && p === 0.99) {
        const shot = await b.send("Page.captureScreenshot", { format: "png" });
        writeFileSync(
          "audit/capabilities-connected-tail.png",
          Buffer.from(shot.data, "base64"),
        );
      }
    }
    await b.load(width, true, "/", 900);
    const fallback = await b.evaluate(
      "(()=>{const r=document.querySelector('[data-capabilities]');const n=document.querySelector('[data-rebuilding]');return {margin:parseFloat(getComputedStyle(r).marginBottom),gap:n.getBoundingClientRect().top-r.getBoundingClientRect().bottom};})()",
    );
    assert.equal(fallback.margin, 0);
    assert.ok(fallback.gap >= -1);
  }
} finally {
  await b.close();
}

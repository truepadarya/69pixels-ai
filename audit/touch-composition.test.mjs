import assert from "node:assert/strict";
import { browserSession } from "./browser-session.mjs";
const b = await browserSession();
try {
  await b.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [740, 360],
    [820, 1180],
    [1024, 768],
    [1366, 1024],
  ]) {
    await b.load(w, false, "/", h);
    const state = await b.evaluate(
      `(()=>{const r=e=>e.getBoundingClientRect();const cards=[...document.querySelectorAll('.rebuilding_card')];return{animated:document.querySelector('[data-rebuilding]').classList.contains('is-animated'),cards:cards.map(e=>({top:r(e).top,bottom:r(e).bottom})),opacity:[...document.querySelectorAll('.services-overview_item')].map(e=>getComputedStyle(e).opacity),film:getComputedStyle(document.querySelector('.lynq-film_link')).display,video:[...document.querySelectorAll('video.centered-cases_visual')].every(e=>e.controls),team:getComputedStyle(document.querySelector('.creators-direction_phrase-ai')).opacity}})()`,
    );
    assert.equal(state.animated, false);
    for (let i = 1; i < state.cards.length; i++)
      assert.ok(state.cards[i].top >= state.cards[i - 1].bottom + 12);
    assert.ok(state.opacity.every((v) => v === "1"));
    assert.equal(state.film, "block");
    assert.equal(state.video, true);
    for (let c = 0; c < 4; c++) {
      await b.evaluate(
        `(()=>{const a=document.querySelectorAll('[data-centered-case]')[${c}];a.querySelector('[data-centered-gallery]').scrollLeft=0;a.querySelector('.centered-cases_navigation').scrollIntoView({block:'center',behavior:'instant'})})()`,
      );
      await b.wait(200);
      for (let step = 0; step < 10; step++) {
        const disabled = await b.evaluate(
          `document.querySelectorAll('[data-gallery-next]')[${c}].disabled`,
        );
        if (disabled) break;
        await b.evaluate(
          `document.querySelectorAll('[data-gallery-next]')[${c}].click()`,
        );
        await b.wait(600);
      }
      const end = await b.evaluate(
        `(()=>{const a=document.querySelectorAll('[data-centered-case]')[${c}],g=a.querySelector('[data-centered-gallery]');return{counter:a.querySelector('[data-gallery-counter]').textContent,disabled:a.querySelector('[data-gallery-next]').disabled,gap:g.scrollWidth-g.clientWidth-g.scrollLeft}})()`,
      );
      assert.equal(end.disabled, true, JSON.stringify({ w, c, ...end }));
      assert.ok(end.gap < 3);
      await b.evaluate(
        `document.querySelectorAll('[data-gallery-previous]')[${c}].click()`,
      );
      await b.wait(600);
      assert.equal(
        await b.evaluate(
          `document.querySelectorAll('[data-gallery-next]')[${c}].disabled`,
        ),
        false,
      );
    }
    console.log(
      "PASS",
      w,
      h,
      "method flow, visible services, film poster, video controls, all carousel arrows and end states",
    );
  }
} finally {
  await b.close();
}

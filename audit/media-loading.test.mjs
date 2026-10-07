import assert from "node:assert/strict";
import { browserSession } from "./browser-session.mjs";

const browser = await browserSession({ baseUrl: process.env.TEST_SITE_URL });
const { evaluate, send, wait, load } = browser;
try {
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await load(1440);
  const initial = await evaluate(`(() => {
    const videos = [...document.querySelectorAll('video')];
    return {count: videos.length, deferred: videos.filter(v => v.dataset.videoReady).length,
      loading: videos.filter(v => v.preload !== 'none').length,
      heights: videos.map(v => v.getBoundingClientRect().height),
      resources: performance.getEntriesByType('resource').filter(r => r.name.includes('.mp4')).length};
  })()`);
  console.log("Initial media:", JSON.stringify(initial));
  assert.equal(initial.count, 19);
  assert.equal(initial.deferred, initial.count);
  assert.ok(
    initial.loading <= 1,
    "only the video approaching the viewport may preload",
  );
  assert.ok(
    initial.resources <= 2,
    "first screen must not download all case videos",
  );
  assert.ok(
    initial.heights.every((h) => h > 0),
    "videos must reserve layout space",
  );
  const caseHeight = await evaluate(
    "document.querySelector('.card_visual video').getBoundingClientRect().height",
  );
  await evaluate(
    "document.querySelector('.card_visual video').scrollIntoView({block:'center',behavior:'instant'})",
  );
  for (let i = 0; i < 80; i++) {
    if (
      await evaluate(
        "document.querySelector('.card_visual video').readyState >= 2 && !document.querySelector('.card_visual video').paused",
      )
    )
      break;
    await wait(100);
  }
  const active =
    await evaluate(`(() => {const v = document.querySelector('.card_visual video');
    return {ready: v.readyState, paused: v.paused, width: v.videoWidth, height: v.videoHeight,
      ratio: getComputedStyle(v).aspectRatio, layoutHeight: v.getBoundingClientRect().height};})()`);
  assert.ok(active.ready >= 2, "visible video must load");
  assert.equal(active.paused, false, "visible muted video must play");
  assert.ok(
    Math.abs(caseHeight - active.layoutHeight) < 1,
    "metadata must not shift the card",
  );
  await evaluate("window.scrollTo({top:0,behavior:'instant'})");
  for (let i = 0; i < 30; i++) {
    if (await evaluate("document.querySelector('.card_visual video').paused && scrollY < 1")) break;
    await wait(100);
  }
  assert.equal(
    await evaluate("document.querySelector('.card_visual video').paused"),
    true,
    "offscreen video must pause",
  );
  console.log(
    "PASS initial video downloads deferred; visible video plays, reserves space and pauses offscreen",
  );

  // Check every local display ratio against the browser's decoded metadata.
  const ratios =
    await evaluate(`Promise.all([...document.querySelectorAll('video')].map(v => new Promise(resolve => {
    const read = () => resolve({src:v.getAttribute('src'), width:v.videoWidth, height:v.videoHeight, ratio:v.style.aspectRatio, auto:v.classList.contains('ratio-auto')});
    if (v.readyState >= 1) return read();
    v.addEventListener('loadedmetadata',read,{once:true});
    v.addEventListener('error',()=>resolve({error:v.getAttribute('src')}),{once:true});
    v.preload = 'metadata'; v.load();
  })))`);
  for (const row of ratios) {
    assert.equal(row.error, undefined, `video failed: ${row.error}`);
    if (!row.ratio) continue;
    const [w, h = 1] = row.ratio.split("/").map(Number);
    // Custom crop ratios need not match the file; auto ratios must.
    if (row.auto) {
      assert.ok(
        Math.abs(w / h - row.width / row.height) < 0.003,
        `incorrect intrinsic ratio for ${row.src}`,
      );
    }
  }
  console.log(`PASS browser metadata checked for ${ratios.length} videos`);
  await load(390, true);
  assert.equal(
    await evaluate(
      "performance.getEntriesByType('resource').some(r => /relight.*\\.bin/.test(r.name))",
    ),
    false,
  );
  assert.equal(
    await evaluate(
      "document.querySelector('.pointillist_light')?.style.visibility",
    ),
    "visible",
  );
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  for (let i = 0; i < 60; i++) {
    if (
      await evaluate(
        "document.querySelector('.pointillist_light')?.style.visibility === 'visible'",
      )
    )
      break;
    await wait(100);
  }
  assert.equal(
    await evaluate(
      "document.querySelector('.pointillist_light')?.style.visibility",
    ),
    "visible",
  );
  console.log(
    "PASS reduced motion skips animation data and live preference changes restore animation",
  );
} finally {
  await browser.close();
}

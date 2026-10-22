import assert from "node:assert/strict";
import { browserSession } from "./browser-session.mjs";
const b = await browserSession({ baseUrl: "http://localhost:4322" });
try {
  await b.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  for (const [width, height] of [
    [390, 844],
    [740, 360],
  ]) {
    await b.load(width, false, "/", height);
    for (const index of [0, 2, 3]) {
      const point = await b.evaluate(
        `(()=>{const video=document.querySelectorAll('video.centered-cases_visual')[${index}];video.scrollIntoView({block:'center',inline:'center',behavior:'instant'});const r=video.closest('.centered-cases_frame').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,
      );
      await b.wait(300);
      const start = await b.evaluate("scrollY");
      await b.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [point],
      });
      for (let i = 1; i <= 5; i++) {
        await b.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: point.x, y: point.y - i * 26 }],
        });
        await b.wait(50);
      }
      await b.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await b.wait(450);
      const end = await b.evaluate("scrollY");
      assert.ok(
        end > start + 50,
        `${width} video ${index}: vertical scroll blocked (${start} -> ${end})`,
      );
      console.log(
        "PASS",
        width,
        height,
        "vertical page swipe over native video",
        index,
      );
    }
  }
} finally {
  await b.close();
}

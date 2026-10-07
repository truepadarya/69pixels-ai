import assert from "node:assert/strict";
import { browserSession } from "./browser-session.mjs";

const browser = await browserSession();
try {
  for (const enabled of [true, false]) {
    await browser.send("Emulation.setScriptExecutionDisabled", {
      value: !enabled,
    });
    await browser.send("Page.navigate", { url: "http://localhost:4321/" });
    for (let attempt = 0; attempt < 80; attempt++) {
      await browser.wait(100);
      if (
        await browser.evaluate(`document.readyState === 'complete' && !!document.querySelector('h1') && (() => {
        const e = document.querySelector('.page-preloader');
        if (!e) return false;
        const s = getComputedStyle(e);
        return s.display === 'none' || Number(s.opacity) === 0;
      })()`)
      )
        break;
    }
    const state = await browser.evaluate(`(() => {
      const preloader = document.querySelector('.page-preloader');
      const style = getComputedStyle(preloader);
      return { display: style.display, opacity: Number(style.opacity), pointerEvents: style.pointerEvents,
        ready: document.documentElement.classList.contains('is-page-ready'),
        heading: document.querySelector('h1').textContent.trim() };
    })()`);
    assert.ok(state.heading.includes("From first"));
    if (enabled) {
      assert.equal(state.opacity, 0);
      assert.equal(state.pointerEvents, "none");
      assert.equal(state.ready, true);
    } else {
      assert.equal(
        state.display,
        "none",
        "No-JavaScript visits must not be blocked by the preloader",
      );
    }
    console.log(
      `PASS preloader with JavaScript ${enabled ? "enabled" : "disabled"}`,
    );
  }
} finally {
  await browser.send("Emulation.setScriptExecutionDisabled", { value: false });
  await browser.close();
}

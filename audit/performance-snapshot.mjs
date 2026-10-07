import { mkdirSync, writeFileSync } from "node:fs";
import { browserSession } from "./browser-session.mjs";

const phase = process.argv[2] ?? "before";
const out = `.tmp-performance/${phase}`;
mkdirSync(out, { recursive: true });
const browser = await browserSession();
const results = [];
try {
  await browser.send("Network.enable");
  await browser.send("Network.setCacheDisabled", { cacheDisabled: true });
  for (const [width, reduced] of [
    [1440, false],
    [390, false],
    [390, true],
  ]) {
    await browser.load(width, reduced);
    await browser.wait(1500);
    const metrics = await browser.evaluate(`(() => {
      const resources = performance.getEntriesByType('resource');
      const videos = [...document.querySelectorAll('video')];
      return {
        videos: videos.length, sourcedVideos: videos.filter(v => v.hasAttribute('src')).length,
        playingVideos: videos.filter(v => !v.paused).length,
        resourceBytes: resources.reduce((n, r) => n + r.encodedBodySize, 0),
        heroResources: resources.filter(r => r.name.includes('/pointillist/')).map(r => ({url:r.name,bytes:r.encodedBodySize})),
        fontPreloads: [...document.querySelectorAll('link[rel="preload"][as="font"]')].map(e => e.href),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    results.push({ width, reduced, ...metrics });
    console.log(JSON.stringify({ phase, width, reduced, ...metrics }));
    const screenshot = await browser.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    writeFileSync(
      `${out}/hero-${width}-${reduced}.png`,
      Buffer.from(screenshot.data, "base64"),
    );
  }
  writeFileSync(`${out}/metrics.json`, JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}

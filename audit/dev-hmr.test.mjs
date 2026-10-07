import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import assert from "node:assert/strict";

const file = "src/components/Item/CardPricing.astro";
const temp = `${file}.watch-probe.tmp`;
const original = readFileSync(file);
const cssUrl =
  "http://localhost:4321/src/components/Item/CardPricing.astro?astro&type=style&index=0&lang.css";
const css = async () =>
  (await fetch(cssUrl, { signal: AbortSignal.timeout(5000) })).text();
const events = [];
const ws = new WebSocket("ws://localhost:4321/", "vite-hmr");
ws.addEventListener("message", (event) => events.push(JSON.parse(event.data)));
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
try {
  const html = await (await fetch("http://localhost:4321/")).text();
  assert.ok(
    html.includes("data-astro-source-file"),
    "Alt+Click source annotations must remain enabled",
  );
  await css();
  for (const mode of ["direct", "rename"]) {
    for (let i = 0; i < 4; i++) {
      const marker = `watchprobe-${mode}-${Date.now()}-${i}`;
      const code = original
        .toString()
        .replace("</style>", `  .${marker} { --watch-probe: 1; }\n</style>`);
      const start = Date.now();
      const eventStart = events.length;
      if (mode === "rename") {
        writeFileSync(temp, code);
        for (let attempt = 0; ; attempt++) {
          try {
            renameSync(temp, file);
            break;
          } catch (error) {
            if (error.code !== "EPERM" || attempt === 10) throw error;
            await sleep(50);
          }
        }
      } else writeFileSync(file, code);
      let found = false;
      while (Date.now() - start < 3500) {
        await sleep(100);
        if ((await css()).includes(marker)) {
          found = true;
          break;
        }
      }
      console.log(
        JSON.stringify({
          mode,
          i,
          found,
          ms: Date.now() - start,
          hmr: events.slice(eventStart).map((e) => e.type),
        }),
      );
      assert.ok(
        found,
        `${mode} save must update CSS without reloading the page or restarting the server`,
      );
      assert.ok(
        events.slice(eventStart).some((e) => e.type === "update"),
        "A CSS HMR update must be sent",
      );
      assert.ok(
        !events.slice(eventStart).some((e) => e.type === "full-reload"),
        "Style-only saves must preserve the page",
      );
    }
  }
  const marker = "data-hmr-markup-probe";
  writeFileSync(
    file,
    original
      .toString()
      .replace("class:list={[", `${marker}="current"\n      class:list={[`),
  );
  let found = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(100);
    const html = await (await fetch("http://localhost:4321/")).text();
    if (html.includes(marker)) {
      found = true;
      break;
    }
  }
  assert.ok(found, "Markup changes must also reach the page");
  console.log("Markup refresh and source annotations passed.");
} finally {
  writeFileSync(file, original);
  if (existsSync(temp)) unlinkSync(temp);
  await sleep(500);
  ws.close();
}

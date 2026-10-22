import fs from "node:fs/promises";
import sharp from "sharp";
import { browserSession } from "./browser-session.mjs";
const b = await browserSession({
  baseUrl: process.env.REVIEW_BASE || "http://localhost:4322",
});
await b.send("Emulation.setTouchEmulationEnabled", {
  enabled: true,
  maxTouchPoints: 5,
});
const dir = ".astro/two-pass-2";
await fs.mkdir(dir, { recursive: true });
for (const [w, h] of [
  [390, 844],
  [820, 1180],
  [740, 360],
]) {
  await b.load(w, false, "/", h);
  for (const [name, selector, steps] of [
    ["opening", ".hero-capabilities_wrap", [0, 0.15, 0.35, 0.55, 0.75, 0.95]],
    ["method", "[data-rebuilding]", [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1]],
    [
      "team",
      "[data-creators-direction]",
      [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1],
    ],
    ["services", "[data-services-overview]", [0, 0.2, 0.4, 0.6, 0.8, 1]],
    ["pricing", "[data-work-setup]", [0, 0.2, 0.4, 0.6, 0.8, 1]],
    ["contact", ".cta-project_wrap", [0, 0.3, 0.6, 0.9]],
  ]) {
    const tiles = [];
    let n = 0;
    const tileh = Math.round((h / w) * 280) + 24;
    for (const p of steps) {
      await b.evaluate(
        `(()=>{const e=document.querySelector('${selector}'),r=e.getBoundingClientRect();scrollTo({top:scrollY+r.top+Math.max(0,r.height-innerHeight)*${p},behavior:'instant'})})()`,
      );
      await b.wait(500);
      const shot = await b.send("Page.captureScreenshot", { format: "png" });
      const data = await sharp(Buffer.from(shot.data, "base64"))
        .resize({ width: 280 })
        .png()
        .toBuffer();
      tiles.push(
        {
          input: data,
          left: (n % 4) * 280,
          top: Math.floor(n / 4) * tileh + 24,
        },
        {
          input: Buffer.from(
            `<svg width="280" height="24"><rect width="280" height="24" fill="#ddd"/><text x="8" y="17" font-size="14">${name} ${p}</text></svg>`,
          ),
          left: (n % 4) * 280,
          top: Math.floor(n / 4) * tileh,
        },
      );
      n++;
    }
    await sharp({
      create: {
        width: 1120,
        height: Math.ceil(n / 4) * tileh,
        channels: 3,
        background: "#555",
      },
    })
      .composite(tiles)
      .png()
      .toFile(`${dir}/${w}-${name}.png`);
  }
  const cases = await b.evaluate(
    `document.querySelectorAll('[data-centered-case]').length`,
  );
  for (let c = 0; c < cases; c++) {
    const n = await b.evaluate(
      `document.querySelectorAll('[data-centered-case]')[${c}].querySelectorAll('figure').length`,
    );
    const tiles = [];
    const tileh = Math.round((h / w) * 280) + 24;
    for (let i = 0; i < n; i++) {
      await b.evaluate(
        `(()=>{const a=document.querySelectorAll('[data-centered-case]')[${c}],g=a.querySelector('[data-centered-gallery]'),f=a.querySelectorAll('figure')[${i}];g.scrollLeft=f.offsetLeft-parseFloat(getComputedStyle(g).scrollPaddingLeft);f.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'})})()`,
      );
      await b.wait(650);
      const shot = await b.send("Page.captureScreenshot", { format: "png" });
      tiles.push(
        {
          input: await sharp(Buffer.from(shot.data, "base64"))
            .resize(280)
            .png()
            .toBuffer(),
          left: (i % 4) * 280,
          top: Math.floor(i / 4) * tileh + 24,
        },
        {
          input: Buffer.from(
            `<svg width="280" height="24"><rect width="280" height="24" fill="#ddd"/><text x="8" y="17" font-size="14">case ${c + 1} card ${i + 1}</text></svg>`,
          ),
          left: (i % 4) * 280,
          top: Math.floor(i / 4) * tileh,
        },
      );
    }
    await sharp({
      create: {
        width: 1120,
        height: Math.ceil(n / 4) * tileh,
        channels: 3,
        background: "#555",
      },
    })
      .composite(tiles)
      .png()
      .toFile(`${dir}/${w}-case-${c + 1}.png`);
  }
  console.log("captured", w, h);
}
await b.close();

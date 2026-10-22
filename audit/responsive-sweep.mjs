import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { browserSession } from "./browser-session.mjs";

const phase = process.env.REVIEW_PHASE || "before";
const directory = `.astro/responsive-${phase}`;
await mkdir(directory, { recursive: true });
const selectors = [
  ["hero", ".hero_wrap"],
  ["capabilities", ".capabilities_wrap"],
  ["rebuilding", "[data-rebuilding]"],
  ...Array.from({ length: 4 }, (_, i) => [
    `case-${i + 1}`,
    `[data-centered-case]:nth-of-type(${i + 1})`,
  ]),
  ["creators", "[data-creators-direction]"],
  ["services", "[data-services-overview]"],
  ["pricing", "[data-work-setup]"],
  ["subscription", "#dedicated-subscription"],
  ["credits", ".site-credits_wrap"],
  ["contact", "#contact"],
  ["footer", "footer"],
];
const browser = await browserSession();
const reports = [];
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await browser.load(width, false, "/", width < 600 ? 844 : 900);
    const report = await browser.evaluate(`(() => {
      const rect = e => {const r=e.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height}};
      return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,sections:[...document.querySelectorAll('main > *, .hero_wrap, .capabilities_wrap, [data-centered-case], #contact, footer')].map(e=>({class:e.className,...rect(e)})),
      cases:[...document.querySelectorAll('[data-centered-case]')].map(e=>({title:e.querySelector('h3')?.textContent.trim(),stage:rect(e.querySelector('.centered-cases_stage')),gallery:rect(e.querySelector('[data-centered-gallery]')),cards:[...e.querySelectorAll('figure')].map(f=>({width:f.offsetWidth,height:f.offsetHeight,caption:f.querySelector('figcaption')?.textContent.trim(),captionHeight:f.querySelector('figcaption')?.offsetHeight}))})),
      overflow:[...document.querySelectorAll('h1,h2,h3,h4,p,input,button,.services-overview_item,.work-subscription_wrap,.footer_inner')].filter(e=>{const r=e.getBoundingClientRect();return r.width>innerWidth+1 || (e.clientWidth>0&&e.scrollWidth>e.clientWidth+2)}).map(e=>({class:e.className,text:e.textContent.trim().slice(0,80),width:e.getBoundingClientRect().width,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}))};
    })()`);
    reports.push(report);
    const tiles = [];
    for (const [name, selector] of selectors) {
      if (
        !(await browser.evaluate(
          `!!document.querySelector(${JSON.stringify(selector)})`,
        ))
      )
        continue;
      await browser.evaluate(
        `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start',behavior:'instant'})`,
      );
      await browser.wait(180);
      const shot = await browser.send("Page.captureScreenshot", {
        format: "png",
      });
      const buffer = Buffer.from(shot.data, "base64");
      await writeFile(`${directory}/${width}-${name}.png`, buffer);
      const tile = await sharp(buffer).resize({ width: 260 }).png().toBuffer();
      tiles.push({
        input: tile,
        left: (tiles.length % 4) * 260,
        top: Math.floor(tiles.length / 4) * Math.ceil((900 / width) * 260),
      });
    }
    const rowHeight = Math.ceil(((width < 600 ? 844 : 900) / width) * 260);
    tiles.forEach((tile, i) => {
      tile.top = Math.floor(i / 4) * rowHeight;
    });
    await sharp({
      create: {
        width: 1040,
        height: Math.ceil(tiles.length / 4) * rowHeight,
        channels: 3,
        background: "#333",
      },
    })
      .composite(tiles)
      .png()
      .toFile(`${directory}/${width}-contact.png`);
    console.log(
      JSON.stringify({
        width,
        documentWidth: report.documentWidth,
        overflow: report.overflow,
        cases: report.cases.map((c) => ({
          title: c.title,
          gallery: c.gallery,
          cards: c.cards.map((f) => ({ width: f.width, height: f.height })),
        })),
      }),
    );
  }
  await writeFile(`${directory}/report.json`, JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}

import assert from "node:assert/strict";
import { browserSession } from "./browser-session.mjs";

const b = await browserSession();
await b.send("Network.enable");
await b.send("Network.setCacheDisabled", { cacheDisabled: true });
await b.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
window.dockDecodeResolvers=[];
const decode=HTMLImageElement.prototype.decode;
HTMLImageElement.prototype.decode=function(){
 const decoded=decode.call(this);
 return this.closest('[data-tools-dock]') ? Promise.all([decoded,new Promise(resolve=>dockDecodeResolvers.push(resolve))]) : decoded;
};
`,
});
try {
  await b.load(1440);
  const script = await (
    await fetch(
      "http://localhost:4321/src/components/ContentToolsDock.astro?astro&type=script&index=0&lang.ts",
    )
  ).text();
  const gsapUrl = script.match(/import \{ gsap \} from "([^"]+)"/)[1];
  const scrollScript = await (
    await fetch(
      "http://localhost:4321/src/components/ScrollLetters.astro?astro&type=script&index=0&lang.ts",
    )
  ).text();
  const stUrl = scrollScript.match(/from "([^"]*gsap_ScrollTrigger[^"]*)"/)[1];
  await b.evaluate(`(async()=>{
 const gsap=(await import('${gsapUrl}')).gsap;
 const timeline=gsap.globalTimeline.getChildren(true,true,true).find(t=>t.targets?.().includes(document.querySelector('.tools-dock_layout'))).parent;
 window.dockStarts=0;timeline.eventCallback('onStart',()=>dockStarts++);
 const st=(await import('${stUrl}')).ScrollTrigger;
 const scene=st.getAll().find(t=>t.pin&&t.trigger?.matches('[data-rebuilding]'));
 scrollTo(0,scene.start+(scene.end-scene.start)*.4);
})()`);
  await b.wait(700);
  assert.equal(await b.evaluate("dockDecodeResolvers.length"), 3);
  assert.equal(
    await b.evaluate("dockStarts"),
    0,
    "cold images must be decoded before the first start",
  );
  assert.equal(
    await b.evaluate(
      "Number(getComputedStyle(document.querySelector('.tools-dock_layout')).opacity)",
    ),
    0,
  );
  const frames = await b.evaluate(`new Promise(resolve=>{
 const d=document.querySelector('[data-tools-dock]'),s=d.querySelector('.studio'),l=d.firstElementChild;
 const frames=[];let resized=false;const begin=performance.now();
 dockDecodeResolvers.forEach(release=>release());
 function tick(){
  const opacity=Number(getComputedStyle(s).opacity);
  if(opacity>.1&&!resized){d.style.width='69.9%';resized=true;}
  frames.push({opacity,layout:Number(getComputedStyle(l).opacity),scale:new DOMMatrix(getComputedStyle(s).transform).a});
  if(performance.now()-begin<1100)requestAnimationFrame(tick);else resolve(frames);
 }
 requestAnimationFrame(tick);
})`);
  assert.equal(
    await b.evaluate("dockStarts"),
    1,
    "one start despite first-entry size changes",
  );
  for (let i = 1; i < frames.length; i++)
    for (const key of ["opacity", "layout", "scale"]) {
      assert.ok(
        frames[i][key] >= frames[i - 1][key] - 0.002,
        `${key} must never flash back to its initial state`,
      );
    }
  assert.ok(frames.at(-1).opacity >= 0.999);
  assert.ok(frames.at(-1).layout >= 0.999);
  console.log(
    "PASS cold first entry: images decode before one start; opacity and scale stay monotonic during resize",
  );
} finally {
  await b.close();
}

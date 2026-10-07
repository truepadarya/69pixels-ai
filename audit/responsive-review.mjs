import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const phase = process.argv[2] || 'before';
const out = `audit/responsive-${phase}`;
mkdirSync(out, { recursive: true });
const tab = await (await fetch('http://localhost:9223/json/new?about:blank',{method:'PUT'})).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
const source = await (await fetch('http://localhost:4321/src/components/SectionCases.astro?astro&type=script&index=0&lang.ts')).text();
const moduleUrl = source.match(/from "([^"]*gsap_ScrollTrigger[^"]*)"/)[1];
ws.addEventListener('message', event => {
  const m = JSON.parse(event.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ': ' + (m.params.exceptionDetails.exception?.description || ''));
  const p = pending.get(m.id);
  if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  assert.equal(r.exceptionDetails, undefined, JSON.stringify(r.exceptionDetails));
  return r.result?.value;
};
const wait = ms => new Promise(r => setTimeout(r, ms));
const ready = async () => {
  for (let i=0;i<100;i++) {
    await wait(200);
    if (await evaluate("document.readyState === 'complete' && document.documentElement.classList.contains('is-page-ready')")) break;
  }
  await evaluate('document.fonts.ready');
  await evaluate("window.scrollTo({top:0,behavior:'instant'})");
  await wait(1500);
};
const shot = async name => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`${out}/${name}.png`, Buffer.from(r.data, 'base64'));
};
const sections = ['.hero_wrap', '[data-capabilities]', '[data-rebuilding]', '#cases', '[data-creators-direction]', '.services-overview-section_wrap', '.work-setup-section_wrap', '.site-credits_wrap', '#contact', '.footer_wrap'];
const motionOnly=process.argv.includes('--motion-only');
const report = motionOnly ? JSON.parse(readFileSync(`${out}/report.json`,'utf8')).report.filter(r=>!r.normal) : [];
try {
  await send('Page.enable');
  await send('Runtime.enable');
  for (const width of motionOnly ? [] : [1440, 768, 390, 320, 1024]) {
    const height = width < 600 ? 844 : 900;
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await send('Page.navigate', { url: 'http://localhost:4321/' });
    await ready();
    await evaluate(`(async()=>{window.reviewTriggers=(await import('${moduleUrl}')).ScrollTrigger;reviewTriggers.refresh();})()`);
    for (let i = 0; i < sections.length; i++) {
      const selector = sections[i];
      const bounds = await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)}); const r=e.getBoundingClientRect();return {top:r.top+scrollY,height:r.height};})()`);
      await evaluate(`window.scrollTo({top:${bounds.top},behavior:'instant'})`);
      await wait(250);
      await shot(`${width}-${i}`);
      if (bounds.height > height * 1.2) {
        await evaluate(`window.scrollTo({top:${bounds.top + bounds.height - height},behavior:'instant'})`);
        await wait(200);
        await shot(`${width}-${i}-end`);
      }
      report.push(await evaluate(`(() => {
        const root=document.querySelector(${JSON.stringify(selector)});
        const visible=e=>{const r=e.getBoundingClientRect();const c=getComputedStyle(e);return r.width&&r.height&&c.visibility!=='hidden'&&Number(c.opacity)>.1;};
        return {width:${width},selector:${JSON.stringify(selector)},height:root.offsetHeight,documentWidth:document.documentElement.scrollWidth,
          overflow:[...root.querySelectorAll('h1,h2,h3,p,a,input,button')].filter(visible).map(e=>({el:e.className,text:e.textContent.trim().slice(0,85),rect:e.getBoundingClientRect().toJSON(),font:getComputedStyle(e).fontSize,client:e.clientWidth,scroll:e.scrollWidth})).filter(e=>e.rect.left < -1 || e.rect.right > innerWidth+1 || e.scroll > e.client+2),
          brokenImages:[...root.querySelectorAll('img')].filter(e=>e.complete&&!e.naturalWidth).map(e=>e.src)};
      })()`));
    }
    console.log(`Captured reduced motion ${width}`);
  }
  for (const width of [1440, 768, 390]) {
    const height = width < 600 ? 844 : 900;
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Emulation.setEmulatedMedia', { features: [] });
    await send('Page.navigate', { url: 'http://localhost:4321/' });
    await ready();
    await evaluate(`(async()=>{window.reviewTriggers=(await import('${moduleUrl}')).ScrollTrigger;reviewTriggers.refresh();})()`);
    for (let i = 0; i < sections.length; i++) {
      const selector = sections[i];
      const bounds=await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});const r=e.getBoundingClientRect();return {top:r.top+scrollY,height:r.height};})()`);
      const fractions = [1,2,4,7].includes(i) ? [.15,.5,.85] : [.0];
      for (const p of fractions) {
        const y=i===8 ? await evaluate(`reviewTriggers.getAll().find(t=>t.trigger.matches('${width>=1024?'[data-site-credits]':'[data-cta-project-stage]'}')).end-1`) : bounds.top+Math.max(0,bounds.height-height)*p;
        await evaluate(`window.scrollTo({top:${y},behavior:'instant'})`);
        await wait(i===8?2300:1600);
        await shot(`${width}-motion-${i}-${p}`);
      }
    }
    report.push(await evaluate(`({width:${width},normal:true,documentWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight})`));
    console.log(`Captured normal motion ${width}`);
  }
  writeFileSync(`${out}/report.json`, JSON.stringify({report,errors}, null, 2));
  console.log(JSON.stringify({errors,brokenImages:report.filter(r=>r.brokenImages?.length)}));
} finally {ws.close();await fetch(`http://localhost:9223/json/close/${tab.id}`);}

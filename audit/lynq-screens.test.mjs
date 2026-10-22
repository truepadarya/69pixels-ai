import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { browserSession } from './browser-session.mjs';

const browser = await browserSession();
const state = () => browser.evaluate(`document.querySelector('[data-lynq-screens]').dataset.screenIndex`);
const showCase = async () => {
  const source = await (await fetch('http://localhost:4321/src/components/SectionCasesCentered.astro?astro&type=script&index=0&lang.ts')).text();
  const url = source.match(/from "([^"]*gsap_ScrollTrigger[^"]*)"/)[1];
  await browser.evaluate(`(async()=>{const st=(await import('${url}')).ScrollTrigger;const a=document.querySelector('[data-lynq-screens]').closest('article');const t=st.getAll().find(t=>t.trigger===a&&t.pin);if(t)scrollTo(0,t.start);else a.scrollIntoView()})()`);
  await browser.wait(200);
};
try {
  await browser.load(1440);
  assert.deepEqual(await browser.evaluate(`[...document.querySelectorAll('#cases-centered h3')].map(e=>e.textContent.trim())`), ['Four healthcare appprototypes ready for testing', 'Twice the weeklydelivery for LYNQ', 'A custom tool forproducing 1,000 images']);
  await browser.wait(2200);
  assert.equal(await state(), '0', 'offscreen slideshow stays still');
  await showCase();
  const layout = await browser.evaluate(`(()=>{
    const root=document.querySelector('[data-lynq-screens]');
    const figures=[...root.closest('article').querySelectorAll('figure')];
    const overview=document.querySelector('[data-lynq-story="overview"]');
    const box=overview.getBoundingClientRect(), text=overview.querySelector('h4').getBoundingClientRect();
    window.lynqLayerErrors=[];
    window.lynqLayerObserver=new MutationObserver(()=>{
      const visible=[...root.querySelectorAll('.lynq-screens_image')].filter(i=>getComputedStyle(i).visibility==='visible');
      if(visible.length!==1||!visible[0].classList.contains('is-active')) window.lynqLayerErrors.push(visible.length);
    });
    window.lynqLayerObserver.observe(root,{subtree:true,attributes:true,attributeFilter:['class']});
    return {count:figures.length,phoneSeparate:figures[0].contains(root)&&!overview.contains(root),
      fullHeight:Math.abs(root.getBoundingClientRect().height-box.height)<1,
      paddingDifference:Math.abs((text.left-box.left)-(box.right-text.right)),
      placeholders:[...root.closest('article').querySelectorAll('[data-lynq-story="build"],[data-lynq-story="review"]')].map(e=>e.childElementCount),
      color:getComputedStyle(root.closest('article').querySelector('.centered-cases_tags')).color};
  })()`);
  assert.equal(layout.count,6);
  assert.ok(layout.phoneSeparate&&layout.fullHeight);
  assert.ok(layout.paddingDifference<1);
  assert.deepEqual(layout.placeholders,[]);
  assert.equal(layout.color,'rgb(222, 222, 227)');
  const geometry = await browser.evaluate(`(()=>{const r=document.querySelector('[data-lynq-screens]'),b=r.getBoundingClientRect(),p=r.querySelector('.lynq-screens_phone').getBoundingClientRect();return{ratio:b.width/b.height,phoneWidth:p.width/b.width,phoneTop:(p.top-b.top)/b.height,images:[...r.querySelectorAll('img')].map(i=>i.complete&&i.naturalWidth>0)}})()`);
  assert.ok(Math.abs(geometry.ratio-390/844)<0.002);
  assert.ok(Math.abs(geometry.phoneWidth-1)<0.002);
  assert.ok(Math.abs(geometry.phoneTop)<0.002);
  assert.ok(geometry.images.length===4&&geometry.images.every(Boolean));
  for(const expected of ['1','2','3','0']) {
    await browser.wait(2150);
    assert.equal(await state(),expected,'four screens cycle at two-second intervals');
    if(expected==='1') {
      const shot=await browser.send('Page.captureScreenshot',{format:'png'});
      await writeFile('audit/lynq-case-desktop.png',Buffer.from(shot.data,'base64'));
    }
    if(expected==='2') {
      const shot=await browser.send('Page.captureScreenshot',{format:'png'});
      await writeFile('audit/lynq-case-dark-screen.png',Buffer.from(shot.data,'base64'));
    }
  }
  assert.deepEqual(await browser.evaluate(`window.lynqLayerObserver.disconnect();window.lynqLayerErrors`),[], 'previous screens stay hidden throughout transitions');
  await browser.evaluate(`document.querySelector('[data-screens-control]').click()`);
  const paused = await state();
  await browser.wait(2200);
  assert.equal(await state(),paused,'manual pause works');
  await browser.evaluate(`document.querySelector('[data-screens-control]').click();scrollTo(0,0)`);
  await browser.wait(200);
  const offscreen=await state();
  await browser.wait(2200);
  assert.equal(await state(),offscreen,'leaving the viewport pauses playback');
  await browser.load(1440,true);
  await showCase();
  await browser.wait(2200);
  assert.equal(await state(),'0','reduced motion does not autoplay');
  await browser.evaluate(`document.querySelector('[data-screens-control]').click()`);
  assert.equal(await state(),'1','reduced motion allows manual screen changes');
  console.log('PASS LYNQ: case order, exact frame geometry, all four assets, 2s cycle, offscreen and manual pause, reduced motion');
} finally { await browser.close(); }

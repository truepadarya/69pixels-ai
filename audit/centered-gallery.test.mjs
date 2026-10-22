import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { browserSession } from './browser-session.mjs';

const browser = await browserSession();
try {
  for (const [width, height, reduced] of [[1440, 900, false], [1280, 720, false], [1920, 1080, false], [1440, 900, true]]) {
    await browser.load(width, reduced, '/', height);
    const source = await (await fetch('http://localhost:4321/src/components/ScrollLetters.astro?astro&type=script&index=0&lang.ts')).text();
    const moduleUrl = source.match(/from "([^"]*gsap_ScrollTrigger[^"]*)"/)[1];
    await browser.evaluate(`(async()=>{window.galleryST=(await import('${moduleUrl}')).ScrollTrigger;})()`);
    const counts = await browser.evaluate(`[...document.querySelectorAll('[data-centered-gallery]')].map(e=>e.querySelectorAll('figure').length)`);
    assert.deepEqual(counts, [4, 6, 6, 4]);
    const presentation = await browser.evaluate(`({captions:document.querySelectorAll('#cases-centered figcaption').length,labels:document.querySelectorAll('#cases-centered [data-cursor-label]').length,cards:[...document.querySelectorAll('.case-results_wrap')].map(e=>{const b=e.getBoundingClientRect(),n=e.querySelector('.case-results_note').getBoundingClientRect(),v=e.querySelector('.case-results_after').getBoundingClientRect();return n.bottom<=b.bottom-10&&v.right<=b.right-10})})`);
    assert.equal(presentation.captions, 0);
    assert.equal(presentation.labels, 19);
    assert.equal(presentation.cards.length, 0);
    const order = await browser.evaluate(`[...document.querySelector('[data-centered-case]').querySelectorAll('[data-cursor-label]')].map(e=>e.dataset.cursorLabel)`);
    assert.deepEqual(order, ['Four concepts to test before committing to development.', 'Connected tools for patients, nurses and clinical teams.', 'Recovery plans, daily check-ins and support in one patient app.', 'Shift summaries and patient handovers in a nursing app.']);
    const pins = await browser.evaluate(`window.galleryST.getAll().filter(t=>t.pin&&t.trigger.matches('[data-centered-case]')).length`);
    assert.equal(pins, reduced ? 0 : 4);
    for (let index = 0; index < 4; index++) {
      for (const progress of [0, 0.5, 1]) {
        await browser.evaluate(`(()=>{
          const g=document.querySelectorAll('[data-centered-gallery]')[${index}];
          const t=window.galleryST.getAll().find(t=>t.pin&&t.trigger===g.closest('article'));
          if(t) scrollTo({top:t.start+(t.end-t.start)*${progress},behavior:'instant'});
          else {g.scrollIntoView();g.scrollLeft=(g.scrollWidth-g.clientWidth)*${progress};}
        })()`);
        await browser.wait(700);
        const geometry = await browser.evaluate(`(()=>{
          const g=document.querySelectorAll('[data-centered-gallery]')[${index}];
          const r=g.getBoundingClientRect();
          const items=[...g.querySelectorAll('figure')].map(e=>{const b=e.getBoundingClientRect(), f=e.querySelector('.centered-cases_frame').getBoundingClientRect();return{left:b.left,right:b.right,width:b.width,height:f.height,ratio:f.width/f.height,expected:parseFloat(e.style.getPropertyValue('--_media-ratio'))}});
          const stage=g.closest('article').querySelector('.centered-cases_stage').getBoundingClientRect();
          return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,stageHeight:stage.height,items,overflow:document.documentElement.scrollWidth>innerWidth};
        })()`);
        assert.equal(geometry.overflow, false);
        assert.ok(Math.abs(geometry.stageHeight-height)<1);
        assert.ok(Math.max(...geometry.items.map(e=>e.height))-Math.min(...geometry.items.map(e=>e.height))<1);
        for(const item of geometry.items) assert.ok(Math.abs(item.ratio-item.expected)<0.002,JSON.stringify(item));
        if(!reduced) {assert.ok(geometry.top>=0);assert.ok(geometry.bottom<=height+1);}
        if (progress === 0 || progress === 1) {
          const item = progress === 0 ? geometry.items[0] : geometry.items.at(-1);
          assert.ok(item.left >= geometry.left - 2, JSON.stringify(geometry));
          assert.ok(item.right <= geometry.right + 2, JSON.stringify(geometry));
        }
        if (width === 1440 && !reduced && index === 0) {
          const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
          await writeFile(`audit/centered-gallery-${progress}.png`, Buffer.from(shot.data, 'base64'));
        }
      }
    }
    console.log(`PASS ${width}x${height}, reduced=${reduced}: 100svh, equal heights, original ratios, complete horizontal travel`);
  }
} finally {
  await browser.close();
}

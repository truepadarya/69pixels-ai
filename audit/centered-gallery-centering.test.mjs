import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { browserSession } from './browser-session.mjs';

const browser = await browserSession();
try {
  for (const [width, height, reduced] of [[1440,900,false],[1280,720,false],[1920,1080,false],[1440,900,true]]) {
    await browser.load(width, reduced, '/', height);
    const source=await(await fetch('http://localhost:4321/src/components/SectionCasesCentered.astro?astro&type=script&index=0&lang.ts')).text();
    const url=source.match(/from "([^"]*gsap_ScrollTrigger[^"]*)"/)[1];
    await browser.evaluate(`(async()=>{window.centerST=(await import('${url}')).ScrollTrigger;})()`);
    for(let index=0;index<3;index++) {
      for(const progress of [0,0.5,1,0]) {
        await browser.evaluate(`(()=>{
          const a=document.querySelectorAll('[data-centered-case]')[${index}],g=a.querySelector('[data-centered-gallery]');
          const t=window.centerST.getAll().find(t=>t.trigger===a&&t.pin);
          if(t)scrollTo({top:(t.start-innerHeight*0.2)+(t.end-t.start+innerHeight*0.2)*${progress},behavior:'instant'});
          else {a.scrollIntoView();g.scrollLeft=(g.scrollWidth-g.clientWidth)*${progress};}
        })()`);
        await browser.wait(600);
        const geometry=await browser.evaluate(`(()=>{
          const a=document.querySelectorAll('[data-centered-case]')[${index}],g=a.querySelector('[data-centered-gallery]'),m=g.querySelector('.centered-cases_media');
          const f=m.firstElementChild.getBoundingClientRect(),l=m.lastElementChild.getBoundingClientRect(),r=g.getBoundingClientRect();
          const t=window.centerST.getAll().find(t=>t.trigger===a&&t.pin);
          return {first:(f.left+f.right)/2,last:(l.left+l.right)/2,target:(r.left+r.right)/2,
            firstWidth:f.width,lastWidth:l.width,distance:(l.left+l.right-f.left-f.right)/2,
            start:t?t.start-innerHeight*0.2:0,scrollDistance:t?t.end-t.start+innerHeight*0.2:0,mask:getComputedStyle(g).maskImage,
            overflow:document.documentElement.scrollWidth>innerWidth};
        })()`);
        assert.equal(geometry.overflow,false);
        assert.equal(geometry.mask,'none');
        if(!reduced)assert.ok(Math.abs(geometry.scrollDistance-geometry.distance)<2,'movement follows scroll 1:1, without holds');
        if(progress===0)assert.ok(Math.abs(geometry.first-geometry.target-Math.min(0,geometry.start))<2,JSON.stringify({width,index,progress,...geometry}));
        if(progress===1)assert.ok(Math.abs(geometry.last-geometry.target)<2,JSON.stringify({width,index,progress,...geometry}));
        if(width===1440&&!reduced&&progress===0&&index<2){
          const shot=await browser.send('Page.captureScreenshot',{format:'png'});
          await writeFile(`audit/centered-start-${index}.png`,Buffer.from(shot.data,'base64'));
        }
      }
    }
    console.log(`PASS ${width}x${height}, reduced=${reduced}: unequal first/last items centered, no masks or overflow, reversible 1:1 travel`);
  }
} finally { await browser.close(); }

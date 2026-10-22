import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {browserSession} from './browser-session.mjs';

const browser=await browserSession();
try {
  for(const [width,height] of [[1440,900],[1280,720]]) {
    await browser.load(width,false,'/',height);
    const source=await(await fetch('http://localhost:4321/src/components/SectionCasesCentered.astro?astro&type=script&index=0&lang.ts')).text();
    const url=source.match(/from "([^"]*gsap_ScrollTrigger[^"]*)"/)[1];
    await browser.evaluate(`(async()=>{window.flowST=(await import('${url}')).ScrollTrigger;})()`);
    for(const index of [1,2]) {
      const range=await browser.evaluate(`(()=>{const a=document.querySelectorAll('[data-centered-case]')[${index}],ts=window.flowST.getAll().filter(t=>t.trigger===a),p=ts.find(t=>t.pin),m=ts.find(t=>t.animation);return{start:m.start,end:m.end,pinStart:p.start,pinEnd:p.end}})()`);
      const state=()=>browser.evaluate(`(()=>{const a=document.querySelectorAll('[data-centered-case]')[${index}],g=a.querySelector('[data-centered-gallery]'),track=g.firstElementChild,r=g.getBoundingClientRect(),first=track.firstElementChild.getBoundingClientRect(),last=track.lastElementChild.getBoundingClientRect();return{x:new DOMMatrix(getComputedStyle(track).transform).m41,y:new DOMMatrix(getComputedStyle(g).transform).m42,op:['.centered-cases_title','.centered-cases_summary','.centered-cases_tags','.centered-cases_gallery'].map(s=>+getComputedStyle(a.querySelector(s)).opacity),first:(first.left+first.right-r.left-r.right)/2,lastGap:r.right-last.right,endPadding:parseFloat(getComputedStyle(track).paddingRight)}})()`);
      const positions=[range.start+height*0.22,range.start+height*0.38,range.pinStart-height*0.2,range.pinEnd-40,range.pinEnd+40,range.pinEnd+height*0.3,range.pinEnd+height*0.5,range.end];
      const samples=[];
      for(const y of positions){await browser.evaluate(`scrollTo({top:${y},behavior:'instant'})`);await browser.wait(500);samples.push({scroll:y,...await state()})}
      for(let i=1;i<samples.length;i++){const rate=(samples[i-1].x-samples[i].x)/(samples[i].scroll-samples[i-1].scroll);assert.ok(Math.abs(rate-1)<0.03,JSON.stringify({width,index,i,rate,samples}));}
      samples.forEach(s=>assert.ok(Math.abs(s.y)<0.01,'gallery has no vertical transform'));
      assert.ok(samples[0].op[0]>samples[0].op[3],'title appears before gallery');
      assert.ok(samples[0].op[3]<samples[1].op[3]&&samples[1].op[3]<samples[2].op[3],'entry fades increase smoothly');
      assert.ok(samples[2].op.every(n=>n>0.99));
      assert.ok(Math.abs(samples[2].first)<2,'first item is centered at the entry anchor');
      assert.ok(samples[4].op[3]>samples[5].op[3]&&samples[5].op[3]>samples[6].op[3],'exit fades decrease while track keeps moving');
      assert.ok(samples.at(-1).op.every(n=>n<0.01));
      await browser.evaluate(`scrollTo({top:${range.pinEnd},behavior:'instant'})`);await browser.wait(500);
      const end=await state();assert.ok(Math.abs(end.lastGap-end.endPadding)<2,'last item reaches the right inset before exit');assert.ok(end.op.every(n=>n>0.99));
      await browser.evaluate('window.flowST.refresh()');await browser.wait(500);
      const refreshed=await state();assert.ok(Math.abs(refreshed.x-end.x)<2,'refresh does not shift the track');
      await browser.evaluate(`scrollTo({top:${positions[1]},behavior:'instant'})`);await browser.wait(500);
      const reverse=await state();assert.ok(Math.abs(reverse.x-samples[1].x)<2);reverse.op.forEach((n,i)=>assert.ok(Math.abs(n-samples[1].op[i])<0.02));
      if(width===1440&&index===1){await browser.evaluate(`scrollTo({top:${range.pinEnd+height*0.3},behavior:'instant'})`);await browser.wait(500);const shot=await browser.send('Page.captureScreenshot',{format:'png'});await writeFile('audit/gallery-continuous-exit.png',Buffer.from(shot.data,'base64'))}
    }
    console.log(`PASS ${width}x${height}: uninterrupted 1:1 entry/travel/exit, smooth opacity, centered start and right-aligned finish, reverse and refresh`);
  }
  await browser.load(1440,true);
  const reduced=await browser.evaluate(`({pins:[...document.querySelectorAll('.centered-cases_stage')].filter(e=>e.parentElement.classList.contains('pin-spacer')).length,op:[...document.querySelectorAll('.centered-cases_gallery')].map(g=>getComputedStyle(g).opacity)})`);
  assert.equal(reduced.pins,0);assert.deepEqual(reduced.op,['1','1','1','1']);
  console.log('PASS reduced motion: native galleries, all content visible');
}finally {await browser.close()}

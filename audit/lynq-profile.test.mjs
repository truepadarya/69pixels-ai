import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {browserSession} from './browser-session.mjs';

const browser=await browserSession();
try {
  const show=async()=>{
    const src=await(await fetch('http://localhost:4321/src/components/SectionCasesCentered.astro?astro&type=script&index=0&lang.ts')).text();
    const url=src.match(/from "([^"]*gsap_ScrollTrigger[^"]*)"/)[1];
    await browser.evaluate(`(async()=>{const st=(await import('${url}')).ScrollTrigger,r=document.querySelector('[data-lynq-profile]'),a=r.closest('article'),g=r.closest('[data-centered-gallery]'),f=r.closest('figure'),m=f.parentElement,p=st.getAll().find(t=>t.trigger===a&&t.pin);if(p){const d=f.offsetLeft+f.offsetWidth/2-m.firstElementChild.offsetLeft-m.firstElementChild.offsetWidth/2;scrollTo({top:p.start-innerHeight*.2+d,behavior:'instant'})}else{a.scrollIntoView();g.scrollLeft=f.offsetLeft+f.offsetWidth/2-g.clientWidth/2}})()`);
  };
  const y=()=>browser.evaluate(`new DOMMatrix(getComputedStyle(document.querySelector('[data-profile-content]')).transform).m42`);
  await browser.load(1440);
  await browser.wait(900);assert.ok(Math.abs(await y())<1,'offscreen demo is paused');
  await show();await browser.wait(150);
  const geometry=await browser.evaluate(`(()=>{const r=document.querySelector('[data-lynq-profile]'),p=r.querySelector('.lynq-profile_phone').getBoundingClientRect(),f=r.closest('figure').getBoundingClientRect(),o=document.querySelector('[data-lynq-story="overview"]'),b=o.getBoundingClientRect();return{phone:p.width/p.height,fullHeight:Math.abs(p.height-f.height)<1,overview:b.width/b.height,title:parseFloat(getComputedStyle(o.querySelector('h4')).fontSize),images:[...r.querySelectorAll('img')].map(i=>({ready:i.complete&&i.naturalWidth>0,src:i.currentSrc})),parts:r.querySelectorAll('img').length}})()`);
  assert.ok(Math.abs(geometry.phone-390/841)<0.002);
  assert.ok(geometry.fullHeight);
  assert.ok(Math.abs(geometry.overview-0.9)<0.002,'overview is only ten percent narrower');
  assert.ok(Math.abs(geometry.title-34.06)<1,'original text scale is preserved');
  assert.equal(geometry.parts,2,'only intact full Figma exports are used');
  assert.ok(geometry.images.every(i=>i.ready&&!i.src.includes('figma.com')));
  for(const [name,delay]of [['original',0],['scrolling',4300],['bottom',4500],['returned',9000]]){
    await browser.wait(delay);const value=await y();
    if(name==='original'||name==='returned')assert.ok(Math.abs(value)<3,`${name}: ${value}`);
    if(name==='scrolling')assert.ok(value < -100&&value > -500,String(value));
    if(name==='bottom')assert.ok(value < -600,String(value));
    const shot=await browser.send('Page.captureScreenshot',{format:'png'});await writeFile(`audit/lynq-profile-${name}.png`,Buffer.from(shot.data,'base64'));
  }
  await browser.evaluate(`document.querySelector('[data-profile-control]').click()`);const paused=await y();await browser.wait(700);assert.ok(Math.abs((await y())-paused)<1,'manual pause');
  await browser.evaluate(`document.querySelector('[data-profile-control]').click();scrollTo({top:0,behavior:'instant'})`);await browser.wait(200);const off=await y();await browser.wait(700);assert.ok(Math.abs((await y())-off)<1,'offscreen pause');
  await browser.load(1440,true);await show();await browser.wait(1200);assert.ok(Math.abs(await y())<1,'reduced motion stays static');
  console.log('PASS original Figma exports, full profile loop, no split-layer holes, phone ratio, narrower overview without smaller type, pause/offscreen/reduced motion');
}finally{await browser.close()}

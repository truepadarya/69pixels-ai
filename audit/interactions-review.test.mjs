import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { browserSession } from './browser-session.mjs';
const b=await browserSession();
const out='audit/responsive-final/interactions';
mkdirSync(out,{recursive:true});
const source=await (await fetch('http://localhost:4321/src/components/SectionCases.astro?astro&type=script&index=0&lang.ts')).text();
const moduleUrl=source.match(/from "([^"]*gsap_ScrollTrigger[^"]*)"/)[1];
const screenshot=async name=>{const s=await b.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${out}/${name}.png`,Buffer.from(s.data,'base64'));};
try {
  for(const width of process.argv.includes('--demo-only') ? [] : [320,390,768,1024,1440,1920]) {
    await b.load(width);
    await b.evaluate(`(async()=>{window.reviewTriggers=(await import('${moduleUrl}')).ScrollTrigger;window.scrollTo({top:0,behavior:'instant'});reviewTriggers.refresh();})()`);
    await b.wait(1400);
    assert.ok(await b.evaluate(`Number(getComputedStyle(document.querySelector('.hero_heading')).opacity)>.99`),'Hero title visible');
    assert.ok(await b.evaluate(`!!document.querySelector('.pointillist_light')`),'Hero lighting canvas initialized');
    await screenshot(`hero-${width}`);
    const group=await b.evaluate(`(() => {const e=document.querySelector('#cases');return e.getBoundingClientRect().top+scrollY;})()`);
    await b.evaluate(`window.scrollTo({top:${group},behavior:'instant'})`);
    await b.wait(900);
    assert.equal(await b.evaluate(`document.querySelector('[data-case-copy].is-active').dataset.caseCopy`),'0');
    if(width<1024) {
      const swipe=await b.evaluate(`(() => {const e=document.querySelector('.cases_cards');e.scrollLeft=e.scrollWidth;return {end:e.scrollLeft,max:e.scrollWidth-e.clientWidth};})()`);
      await b.wait(350);
      assert.ok(swipe.max>0,'Case cards can be scrolled');
      assert.ok(await b.evaluate(`document.querySelector('.cases_cards').scrollLeft>0`),'Case carousel reaches next card');
    }
    const team=await b.evaluate(`(() => {const e=document.querySelector('[data-creators-direction]');return e.getBoundingClientRect().top+scrollY+(e.offsetHeight-innerHeight)*.5;})()`);
    await b.evaluate(`window.scrollTo({top:${team},behavior:'instant'})`);
    await b.wait(1600);
    const photos=await b.evaluate(`[...document.querySelectorAll('[data-photo]')].filter(e=>{const r=e.getBoundingClientRect();return Number(getComputedStyle(e).opacity)>.1&&r.top<innerHeight&&r.bottom>0;}).map(e=>({loaded:e.querySelector('img').complete&&e.querySelector('img').naturalWidth>0}))`);
    assert.ok(photos.length>=2&&photos.every(e=>e.loaded),'Team portraits are visible and loaded');
    await screenshot(`team-${width}`);
    const end=await b.evaluate(`(() => {const t=reviewTriggers.getAll().find(t=>t.trigger.matches(${JSON.stringify(width>=1024?'[data-site-credits]':'[data-cta-project-stage]')}));return t.end-1;})()`);
    await b.evaluate(`window.scrollTo({top:${end},behavior:'instant'})`);
    await b.wait(2300);
    assert.ok(await b.evaluate(`[...document.querySelectorAll('.cta-project_heading,.cta-project_field,.cta-project_button')].every(e=>getComputedStyle(e).visibility==='visible'&&Number(getComputedStyle(e).opacity)>.95)`),'CTA fully reveals');
    const hit=await b.evaluate(`(() => {const input=document.querySelector('.cta-project_input');const r=input.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight,hit:document.elementFromPoint(r.left+r.width*.35,r.top+r.height/2)?.className};})()`);
    assert.ok(hit.top>=0&&hit.bottom<hit.height,`Input in viewport: ${JSON.stringify(hit)}`);
    assert.equal(hit.hit,'cta-project_input',`Input is reachable: ${JSON.stringify(hit)}`);
    await b.evaluate(`(() => {const input=document.querySelector('.cta-project_input');input.value='A responsive project';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    assert.equal(await b.evaluate(`new URL(document.querySelector('[data-project-email]').href).searchParams.get('subject')`),'A responsive project');
    const idea=await b.evaluate(`(() => {document.querySelector('.cta-project_shuffle').click();return document.querySelector('.cta-project_input').value;})()`);
    assert.notEqual(idea,'A responsive project');
    await screenshot(`contact-${width}`);
    console.log(`PASS ${width}: hero, case swipe, team portraits, contact visibility, hit targets, shuffle and email payload`);
  }
  for(const width of [390,768,1440]) {
    await b.load(width,true,'/example-components');
    assert.equal(await b.evaluate('document.querySelectorAll("h1").length'),1);
    for(const id of ['modal-small','modal-side','modal-full']) {
      await b.evaluate(`document.querySelector('[data-modal-open="${id}"]').click()`);
      await b.wait(200);
      assert.equal(await b.evaluate(`document.getElementById('${id}').open`),true);
      assert.ok(await b.evaluate(`(() => {const e=document.getElementById('${id}').querySelector('.modal_body');const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})()`),'Modal content fits');
      await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await b.wait(150);
      assert.equal(await b.evaluate(`document.getElementById('${id}').open`),false,'Escape closes modal');
    }
    const tabs=await b.evaluate(`(() => {const e=document.querySelector('[role="tablist"]');const t=[...e.querySelectorAll('[role="tab"]')];t[1].click();return t.map(e=>e.getAttribute('aria-selected'));})()`);
    assert.equal(tabs[1],'true');
    const accordions=await b.evaluate(`(() => {const e=document.querySelector('.accordion_toggle');const before=e.parentElement.open;e.click();return {before,after:e.parentElement.open};})()`);
    assert.notEqual(accordions.after,accordions.before);
    const dropdown=await b.evaluate(`(() => {const e=document.querySelector('.dropdown_toggle');e.click();return e.parentElement.open;})()`);
    assert.equal(dropdown,true);
    await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    assert.equal(await b.evaluate(`document.querySelector('.dropdown_wrap').open`),false);
    console.log(`PASS ${width}: demo h1, modal sizes and Escape, tabs, accordion, dropdown`);
  }
  await b.load(1440);
  await b.evaluate(`(async()=>{window.reviewTriggers=(await import('${moduleUrl}')).ScrollTrigger;})()`);
  for(const width of [768,390,1440]) {
    await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    await b.wait(1000);
    await b.evaluate('reviewTriggers.refresh()');
    const active=await b.evaluate(`({width:innerWidth,desktop:matchMedia('(width >= 64rem)').matches,triggers:reviewTriggers.getAll().filter(t=>t.trigger.matches('[data-cases]')).map(t=>({animation:!!t.animation,start:t.vars.start}))})`);
    console.log('Resize cases',JSON.stringify(active));
    assert.equal(active.triggers.filter(t=>t.animation).length,1,'Resize does not duplicate reveal triggers');
    assert.equal(active.triggers.filter(t=>!t.animation).length,active.desktop?1:0,'Resize does not duplicate active-case triggers');
    const end=await b.evaluate(`reviewTriggers.getAll().find(t=>t.trigger.matches('${width>=1024?'[data-site-credits]':'[data-cta-project-stage]'}')).end-1`);
    await b.evaluate(`window.scrollTo({top:${end},behavior:'instant'})`);
    await b.wait(2300);
    assert.ok(await b.evaluate(`Number(getComputedStyle(document.querySelector('.cta-project_field')).opacity)>.95`),'CTA reveals after live resize');
    assert.equal(await b.evaluate('document.querySelectorAll("#contact").length'),1,'Contact ID remains unique');
  }
  await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await b.wait(900);
  assert.ok(await b.evaluate(`(() => {const team=document.querySelector('[data-creators-direction]').getBoundingClientRect();const services=document.querySelector('.services-overview-section_wrap').getBoundingClientRect();return services.top>=team.bottom-1;})()`),'Live reduced motion keeps team visible');
  await b.send('Emulation.setEmulatedMedia',{features:[]});
  await b.wait(900);
  assert.equal(await b.evaluate('document.querySelectorAll("#contact").length'),1);
  console.log('PASS live resize and motion preference changes: unique scene triggers and contact anchor');
} finally {await b.close();}

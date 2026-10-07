import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const tabs=await(await fetch('http://localhost:9334/json')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}});
const send=(method,params={})=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}));});
const ev=async expression=>{const m=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!m.exceptionDetails,JSON.stringify(m));return m.result.value;};
try {
await send('Page.enable');
for(const [width,height] of [[1440,1100],[390,844],[1920,1080]]) {
 await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
 await send('Page.navigate',{url:'http://localhost:4321'});
 await new Promise(r=>setTimeout(r,2200));
 await ev(`(async()=>{await document.fonts.ready;document.querySelector('#contact').scrollIntoView();await Promise.all([...document.querySelectorAll('#contact img')].map(i=>{i.loading="eager";return i.decode().catch(()=>{})}));})()`);
 await new Promise(r=>setTimeout(r,500));
 const layout=await ev(`(()=>{const r=document.querySelector('#contact');const a=r.querySelector('.cta-project_heading');const b=document.querySelector('.rebuilding_title');return {old:!!document.querySelector('.cta-marquee_wrap'),overflow:document.documentElement.scrollWidth>innerWidth,font:getComputedStyle(a).fontSize,originalFont:getComputedStyle(b).fontSize,heights:[...r.querySelectorAll('figure')].map(i=>i.getBoundingClientRect().height),ratios:[...r.querySelectorAll('img')].map(i=>({actual:i.clientWidth/i.clientHeight,original:i.naturalWidth/i.naturalHeight,loaded:i.complete&&i.naturalWidth>0})),panels:[...r.querySelectorAll('.cta-project_panel')].map(i=>i.clientWidth),directions:[...r.querySelectorAll('.cta-project_track')].map(i=>getComputedStyle(i).animationDirection)}})()`);
 assert.equal(layout.old,false);assert.equal(layout.overflow,false);assert.equal(layout.font,layout.originalFont);assert.ok(layout.heights.every(h=>h===layout.heights[0]));assert.ok(layout.ratios.every(i=>i.loaded&&Math.abs(i.actual-i.original)<.02));assert.deepEqual(layout.directions,['normal','reverse']);
 const functional=await ev(`(()=>{const input=document.querySelector('.cta-project_input');const button=document.querySelector('.cta-project_shuffle');const first=input.value;button.click();const second=input.value;input.value='Новый проект & AI? '+ 'Long idea '.repeat(40);input.dispatchEvent(new Event('input'));const email=document.querySelector('[data-project-email]');return {different:first!==second,subject:new URL(email.href).searchParams.get('subject'),value:input.value,fieldWidth:document.querySelector('.cta-project_field').clientWidth,booking:document.querySelector('[data-project-booking]').href}})()`);
 assert.equal(functional.different,true);assert.equal(functional.subject,functional.value);assert.equal(functional.booking,'https://calendar.app.google/Snnw3wcumNzSF9Qv6');
 await ev(`document.querySelector('.cta-project_shuffle').click()`);
 const clip=await ev(`(()=>{const r=document.querySelector('#contact').getBoundingClientRect();return {x:0,y:Math.max(0,r.top+scrollY),width:innerWidth,height:Math.min(r.height,1400),scale:1}})()`);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});writeFileSync(`audit/cta-project-${width}.png`,Buffer.from(shot.data,'base64'));
 console.log(width, 'layout, heading size, image ratios, shuffle and email passed');
}
await ev(`(()=>{const a=document.querySelector('[data-project-booking]');a.addEventListener('click',e=>e.preventDefault());Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copiedIdea=value;}}});a.click();})()`);
await new Promise(r=>setTimeout(r,100));
assert.equal(await ev(`window.copiedIdea`),await ev(`document.querySelector('.cta-project_input').value`));
assert.match(await ev(`document.querySelector('.cta-project_status').textContent`),/Idea copied/);
const point=await ev(`(()=>{const r=document.querySelector('.cta-project_gallery').getBoundingClientRect();return {x:r.x+r.width/2,y:Math.min(innerHeight-20,r.y+100)}})()`);
await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
const before=await ev(`[...document.querySelectorAll('.cta-project_track')].map(i=>getComputedStyle(i).transform)`);
await new Promise(r=>setTimeout(r,300));
const after=await ev(`[...document.querySelectorAll('.cta-project_track')].map(i=>getComputedStyle(i).transform)`);
assert.ok(after.every((v,i)=>v!==before[i]));
assert.deepEqual(await ev(`[...document.querySelectorAll('.cta-project_track')].map(i=>getComputedStyle(i).animationPlayState)`),['running','running']);
console.log('Clipboard payload, status message and continued movement on hover passed');
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
assert.deepEqual(await ev(`[...document.querySelectorAll('.cta-project_track')].map(i=>getComputedStyle(i).animationName)`),['none','none']);
console.log('CTA checks passed, including reduced motion.');
}finally{ws.close()}

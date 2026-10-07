import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const tab = await (await fetch('http://localhost:9223/json/new?about:blank', {method: 'PUT'})).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, {once: true}));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', ({data}) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  const item = pending.get(message.id);
  if (item) { pending.delete(message.id); message.error ? item.reject(message.error) : item.resolve(message.result); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, {resolve, reject}); ws.send(JSON.stringify({id, method, params})); });
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
mkdirSync('audit/copy-preview', {recursive: true});
await send('Runtime.enable');
await send('Page.enable');
for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 740]]) {
  await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
  await send('Page.navigate', {url: process.env.REVIEW_URL || 'http://localhost:4321/'});
  await wait(2500);
  await evaluate('document.fonts.ready');
  const result = await evaluate(`(() => {
    const h = document.querySelector('.hero_heading').getBoundingClientRect();
    const hero = document.querySelector('.hero_wrap').getBoundingClientRect();
    const mail = document.querySelector('[data-project-email]');
    const input = document.querySelector('.cta-project_input');
    input.value = 'A new project'; input.dispatchEvent(new Event('input'));
    return {
      headers: [['.hero_heading > .heading','.hero_description > .text'],['.work-setup_heading','.work-setup_lead'],['.cta-project_heading','.cta-project_lead']].map(([h,p])=>{const a=document.querySelector(h).getBoundingClientRect(),b=document.querySelector(p).getBoundingClientRect();const c=getComputedStyle(document.querySelector(p));return {gap:b.top-a.bottom,centerOffset:(b.left+b.width/2)-(a.left+a.width/2),size:c.fontSize,lineHeight:c.lineHeight,weight:c.fontWeight,align:c.textAlign,width:b.width};}),
      title: document.title,
      description: document.querySelector('meta[name="description"]').content,
      heroFits: h.top >= hero.top && h.bottom <= hero.bottom && h.left >= 0 && h.right <= innerWidth,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      cards: document.querySelectorAll('.cases_wrap .card_visual').length,
      credits: [...document.querySelectorAll('.site-credits_line:not(.site-credits_final)')].map(x=>x.textContent.trim()),
      email: mail.href,
      cardOverflow: [...document.querySelectorAll('.pricing-card_body')].map(x=>x.scrollHeight > x.clientHeight + 1),
      placeholders: document.body.textContent.includes('Уточнить'),
    };
  })()`);
  console.log(width, JSON.stringify(result));
  assert(result.headers.every(h=>Math.abs(h.centerOffset)<1));
  assert(result.headers.every(h=>parseFloat(h.size)<=20));
  assert.equal(result.title, '69pixels | Creative studio with AI in the workflow.');
  assert.equal(result.cards, 9);
  assert.equal(result.heroFits, true);
  assert.equal(result.horizontalOverflow, false);
  assert.equal(result.placeholders, false);
  assert(result.email.startsWith('mailto:hello@69pixels.com?subject=Project%20enquiry&body='));
  assert(result.cardOverflow.every(value => !value));
  for (const [name, selector] of [['hero', '.hero_wrap'], ['approach', '.rebuilding_cards'], ['experience', '.rebuilding_card.gray'], ['formats', '.work-setup_wrap'], ['contact', '.cta-project_content']]) {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start',behavior:'instant'}); window.scrollBy({top:-100,behavior:'instant'})`);
    await wait(350);
    const screenshot = await send('Page.captureScreenshot', {format: 'png'});
    writeFileSync(`audit/copy-preview/${name}-${width}.png`, Buffer.from(screenshot.data, 'base64'));
  }
}
await send('Emulation.setEmulatedMedia', {features: [{name:'prefers-reduced-motion', value:'no-preference'}]});
await send('Emulation.setDeviceMetricsOverride', {width:1440, height:900, deviceScaleFactor:1, mobile:false});
await send('Page.navigate', {url:process.env.REVIEW_URL || 'http://localhost:4321/'});
await wait(2500);
await evaluate('window.scrollTo({top:document.body.scrollHeight,behavior:"instant"})');
await wait(1500);
const contactType = await evaluate(`(() => ({heading:parseFloat(getComputedStyle(document.querySelector('.cta-project_heading')).fontSize),lead:parseFloat(getComputedStyle(document.querySelector('.cta-project_lead')).fontSize)}))()`);
assert(contactType.lead < contactType.heading / 2);
console.log('Animated desktop contact type:', JSON.stringify(contactType));
assert.deepEqual(errors, []);
console.log('Preview checks passed, including browser runtime errors.');
ws.close();

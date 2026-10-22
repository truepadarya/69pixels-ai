import assert from 'node:assert/strict';
import { browserSession } from './browser-session.mjs';

const browser = await browserSession();
try {
  await browser.load(1440);
  const source = await (await fetch('http://localhost:4321/src/components/SectionCasesCentered.astro?astro&type=script&index=0&lang.ts')).text();
  const url = source.match(/from "([^"]*gsap_ScrollTrigger[^"]*)"/)[1];
  await browser.evaluate(`(async()=>{window.lifecycleST=(await import('${url}')).ScrollTrigger;window.lifecycleErrors=[];addEventListener('error',e=>window.lifecycleErrors.push(e.message));})()`);
  const count = () => browser.evaluate('window.lifecycleST.getAll().filter(t=>t.pin).length');
  const initial = await count();
  assert.ok(initial >= 3, 'Desktop scenes are mounted');
  for (let cycle = 0; cycle < 3; cycle++) {
    await browser.evaluate("dispatchEvent(new PageTransitionEvent('pagehide', {persisted:true}))");
    await browser.wait(100);
    assert.equal(await count(), 0, 'Preview teardown must remove pinning before the DOM is replaced');
    await browser.evaluate("dispatchEvent(new PageTransitionEvent('pageshow', {persisted:true}))");
    await browser.wait(250);
    assert.equal(await count(), initial, 'Restoring preview must mount each scene once');
  }
  assert.deepEqual(await browser.evaluate('window.lifecycleErrors'), []);
  console.log('PASS: three preview teardown/restore cycles without stale pins, duplicate scenes or browser errors');
} finally {
  await browser.close();
}

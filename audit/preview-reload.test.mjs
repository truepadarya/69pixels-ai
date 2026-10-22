import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { browserSession } from './browser-session.mjs';

const file = 'src/components/ContentProductionStory.astro';
const original = await readFile(file, 'utf8');
const browser = await browserSession();
try {
  await browser.send('Page.addScriptToEvaluateOnNewDocument', {source: `addEventListener('error',event=>{let errors=JSON.parse(sessionStorage.getItem('preview-errors')||'[]');errors.push(event.error?.stack||event.message);sessionStorage.setItem('preview-errors',JSON.stringify(errors))})`});
  await browser.load(1440);
  await browser.evaluate("sessionStorage.setItem('preview-errors','[]');scrollTo({top:700,behavior:'instant'})");
  for (let cycle = 0; cycle < 3; cycle++) {
    const origin = await browser.evaluate('performance.timeOrigin');
    await writeFile(file, original.replace('data-production-story={variant}', `data-production-story={variant} data-preview-probe="${cycle}"`));
    let reloaded = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      await browser.wait(150);
      try {
        reloaded = await browser.evaluate(`performance.timeOrigin !== ${origin} && document.readyState === 'complete' && document.querySelectorAll('.centered-cases_stage').length >= 3 && document.querySelectorAll('.centered-cases_stage').length === document.querySelectorAll('.pin-spacer > .centered-cases_stage').length`);
        if (reloaded) break;
      } catch {}
    }
    if (!reloaded) console.log(await browser.evaluate(`({origin:performance.timeOrigin,previous:${origin},stages:document.querySelectorAll('.centered-cases_stage').length,pins:document.querySelectorAll('.pin-spacer > .centered-cases_stage').length,errors:sessionStorage.getItem('preview-errors')})`));
    assert.ok(reloaded, 'Markup save reloads preview and restores gallery pins');
    await browser.wait(400);
    assert.deepEqual(await browser.evaluate("JSON.parse(sessionStorage.getItem('preview-errors')||'[]')"), []);
  }
  console.log('PASS: three real markup saves reload the preview without browser errors or broken gallery pins');
} finally {
  await writeFile(file, original);
  await browser.close();
}

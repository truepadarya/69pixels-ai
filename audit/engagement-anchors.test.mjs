import assert from 'node:assert/strict';
import { browserSession } from './browser-session.mjs';

const browser = await browserSession();
try {
  for (const reduced of [false, true]) {
    await browser.load(1440, reduced);
    for (const [term, target, highlight] of [
      ['Fixed Price', 'project-partnership', true],
      ['Fixed Price', 'project-partnership', true],
      ['T&M', 'project-partnership', false],
      ['Subscription', 'dedicated-subscription', false],
    ]) {
      await browser.evaluate(`(() => {
        const links = [...document.querySelectorAll('.services-overview_term-link')];
        const link = links.find(a => a.textContent.trim() === '${term}');
        link.scrollIntoView({ block: 'center', behavior: 'instant' });
      })()`);
      await browser.wait(350);
      await browser.evaluate(`(() => {
        const link = [...document.querySelectorAll('.services-overview_term-link')]
          .find(a => a.textContent.trim() === '${term}');
        link.focus({ preventScroll: true });
        link.click();
      })()`);
      await browser.wait(2100);
      const result = await browser.evaluate(`(() => {
        const target = document.getElementById('${target}');
        const card = target.matches('.work-setup_card') ? target : target.querySelector('.work-setup_card');
        return {
          hash: location.hash,
          top: target.getBoundingClientRect().top,
          margin: parseFloat(getComputedStyle(target).scrollMarginTop),
          opacity: parseFloat(getComputedStyle(card).opacity),
          visibility: getComputedStyle(card).visibility,
          focused: document.activeElement?.id,
          flashes: document.querySelectorAll('.work-setup_flash').length,
        };
      })()`);
      assert.equal(result.hash, '#' + target);
      assert.ok(Math.abs(result.top - result.margin) < 2, JSON.stringify(result));
      assert.equal(result.opacity, 1);
      assert.equal(result.visibility, 'visible');
      assert.equal(result.flashes, 0);
      if (highlight) assert.equal(result.focused, 'fixed-project');
      else assert.notEqual(result.focused, 'fixed-project');
      console.log(`PASS ${reduced ? 'reduced' : 'normal'} ${term}: stable landing, visible card, expected focus`);
    }
  }
} finally {
  await browser.close();
}

import assert from 'node:assert/strict';
import { browserSession } from './browser-session.mjs';

const browser = await browserSession();
const { evaluate, load } = browser;
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
try {
  for (const width of [320, 390, 768, 820, 1024, 1440]) {
    await load(width, true);
    check(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `${width}: page overflows horizontally`);
    const fallback = await evaluate(`(() => {
      const team=document.querySelector('[data-creators-direction]');
      const services=document.querySelector('.services-overview-section_wrap');
      const media=document.querySelector('.capabilities_media');
      return {teamEnd:team.getBoundingClientRect().bottom,servicesTop:services.getBoundingClientRect().top,mediaHeight:media.offsetHeight,mediaContent:media.scrollHeight};
    })()`);
    check(fallback.servicesTop >= fallback.teamEnd - 1, `${width}: reduced motion hides the team section`);
    check(fallback.mediaHeight >= fallback.mediaContent - 1, `${width}: reduced motion crops capabilities`);
    if (width >= 768 && width < 1024) {
      const third = await evaluate(`(() => {const e=document.querySelectorAll('.work-setup_card')[2];return {height:e.offsetHeight,width:e.offsetWidth};})()`);
      check(third.height < third.width * .8, `${width}: wide third setup card has oversized empty space`);
    }
    const inputFocus = await evaluate(`(() => {
      const input=document.querySelector('.cta-project_input');input.focus({preventScroll:true});
      const field=input.parentElement;const s=getComputedStyle(field);const i=getComputedStyle(input);
      return {active:document.activeElement===input,fieldOutline:s.outlineStyle,inputOutline:i.outlineStyle,mask:i.maskImage,padding:parseFloat(i.paddingRight),shuffle:parseFloat(getComputedStyle(field).getPropertyValue('--_shuffle-offset'))+18};
    })()`);
    check(inputFocus.active, `${width}: idea input cannot receive focus`);
    check(inputFocus.fieldOutline !== 'none' || inputFocus.inputOutline !== 'none', `${width}: idea input lacks visible keyboard focus`);
    check(inputFocus.mask === 'none' && inputFocus.padding >= inputFocus.shuffle, `${width}: idea input masks typed text and caret`);
    await load(width);
    if (width < 1024) {
      const card = await evaluate(`(() => {
        const e=document.querySelector('.rebuilding_card.gray');
        const title=e.querySelector('.rebuilding_card-title');
        const text=e.querySelector('.rebuilding_card-text');
        const graphic=e.querySelector('.rebuilding_illustration');
        const height=e=>{const s=getComputedStyle(e);return {top:e.offsetTop,height:e.offsetHeight,scroll:e.scrollWidth,width:e.clientWidth,gap:parseFloat(s.rowGap)};};
        return {title:height(title),text:height(text),graphic:height(graphic),card:height(e)};
      })()`);
      check(card.title.scroll <= card.title.width + 1, `${width}: rebuilding card heading overflows`);
      check(card.text.top >= card.title.top + card.title.height + 10, `${width}: rebuilding text crowds its heading`);
      check(card.graphic.top >= card.text.top + card.text.height + 10, `${width}: rebuilding text crowds its illustration`);
    }
    console.log(`Reviewed ${width}`);
  }
} finally { browser.close(); }
failures.forEach(f => console.error('FAIL ' + f));
assert.equal(failures.length, 0, `${failures.length} responsive regressions`);
console.log('PASS responsive layouts, reduced motion and input focus');

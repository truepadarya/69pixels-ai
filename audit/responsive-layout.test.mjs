import assert from "node:assert/strict";
import { browserSession } from "./browser-session.mjs";

const browser = await browserSession();
try {
  for (const { width, height = 900, touch = false, reduced = false } of [
    { width: 320, height: 844, touch: true },
    { width: 360, height: 800, touch: true },
    { width: 390, height: 844, touch: true },
    { width: 428, height: 926, touch: true },
    { width: 768, height: 1024, touch: true },
    { width: 1024, height: 768, touch: true },
    { width: 844, height: 390, touch: true },
    { width: 1024 },
    { width: 1440 },
    { width: 1920, height: 1080 },
    { width: 1440, height: 600 },
    { width: 390, height: 844, touch: true, reduced: true },
    { width: 1440, reduced: true },
  ]) {
    await browser.send("Emulation.setTouchEmulationEnabled", {
      enabled: touch,
      maxTouchPoints: touch ? 5 : 1,
    });
    await browser.load(width, reduced, "/", height);
    const initial = await browser.evaluate(`(() => {
      const layout = e => {const r=e.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top,bottom:r.bottom}};
      const touchLayout=matchMedia('(width < 64rem), (pointer: coarse)').matches;
      return {
        viewport:innerWidth,document:document.documentElement.scrollWidth,
        client:document.documentElement.clientWidth,touchLayout,
        cases:[...document.querySelectorAll('[data-centered-case]')].map(article=>({
          pinned:article.querySelector('[data-centered-gallery]').classList.contains('is-pinned'),
          stage:layout(article.querySelector('.centered-cases_stage')),
          gallery:layout(article.querySelector('[data-centered-gallery]')),
          cards:[...article.querySelectorAll('figure')].map(figure=>({
            ...layout(figure),captionClipped:!!figure.querySelector('figcaption')&&figure.querySelector('figcaption').scrollWidth>figure.querySelector('figcaption').clientWidth+1,
            frame:layout(figure.querySelector('.centered-cases_frame')),
          })),
        })),
        pricing:[...document.querySelectorAll('.work-setup_card.pricing-card_wrap')].map(card=>({
          card:layout(card),body:layout(card.querySelector('.pricing-card_body')),
          footer:layout(card.querySelector('.pricing-card_footer')),
          text:layout(card.querySelector('.pricing-card_text')),
        })),
        footerOverflow:document.querySelector('.footer_inner').scrollWidth>document.querySelector('.footer_inner').clientWidth+1,
        contactSticky:getComputedStyle(document.querySelector('.cta-project-section_wrap')).position,
        contactVisible:getComputedStyle(document.querySelector('.cta-project_heading')).visibility,
        touchTargets:[...document.querySelectorAll('.case-preview_link,.work-subscription_button,.cta-project_button')].map(e=>layout(e).height),
      };
    })()`);
    const name = `${width}x${height}${touch ? " touch" : ""}${reduced ? " reduced" : ""}`;
    assert.ok(
      initial.document <= initial.client + 1,
      `${name}: page must not overflow horizontally`,
    );
    assert.equal(initial.cases.length, 4);
    for (const item of initial.cases)
      assert.ok(
        item.gallery.bottom <= item.stage.bottom + 1,
        `${name}: gallery exceeds section height`,
      );
    assert.equal(initial.footerOverflow, false, `${name}: footer overflow`);
    for (const card of initial.pricing) {
      assert.ok(
        card.text.bottom <= card.footer.top + 1,
        `${name}: pricing text overlaps footer`,
      );
      assert.ok(
        card.footer.bottom <= card.card.bottom + 1,
        `${name}: pricing footer outside card`,
      );
    }
    for (const size of initial.touchTargets)
      assert.ok(size >= 43.9, `${name}: undersized touch target`);
    if (initial.touchLayout) {
      assert.equal(
        initial.contactSticky,
        "relative",
        `${name}: contact form must not be trapped in a pin`,
      );
      assert.equal(initial.contactVisible, "visible");
      for (const item of initial.cases) {
        assert.equal(item.pinned, false, `${name}: native carousel required`);
        for (const card of item.cards) {
          assert.ok(
            card.width <= width - 20,
            `${name}: case card wider than viewport`,
          );
          assert.ok(card.frame.height > 70, `${name}: missing media height`);
          assert.equal(card.captionClipped, false, `${name}: clipped caption`);
        }
      }
      const navigation = await browser.evaluate(`(() => {
        return [...document.querySelectorAll('[data-centered-gallery]')].map(gallery=>{
          gallery.scrollLeft=gallery.scrollWidth;
          const last=gallery.querySelector('figure:last-child');
          const r=last.getBoundingClientRect();return {left:r.left,right:r.right,scroll:gallery.scrollLeft};
        });
      })()`);
      for (const last of navigation) {
        assert.ok(last.scroll > 0);
        assert.ok(
          last.left >= -1 && last.right <= width + 1,
          `${name}: last case cannot be reached`,
        );
      }
    }
    console.log(
      `PASS ${name}: all sections, pricing, case sizes/captions, carousel reachability and touch targets`,
    );
  }
  await browser.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await browser.load(390, false, "/", 844);
  const point = await browser.evaluate(`(()=>{
    const gallery=document.querySelectorAll('[data-centered-gallery]')[1];
    gallery.scrollIntoView({block:'center',behavior:'instant'});
    const r=gallery.getBoundingClientRect();return {x:300,y:r.top+r.height/2};
  })()`);
  await browser.wait(150);
  await browser.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: point.x, y: point.y }],
  });
  for (let i = 1; i <= 7; i++) {
    await browser.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x - i * 30, y: point.y }],
    });
    await browser.wait(40);
  }
  await browser.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await browser.wait(600);
  assert.ok(
    await browser.evaluate(
      "document.querySelectorAll('[data-centered-gallery]')[1].scrollLeft>100",
    ),
    "Native horizontal swipe must move case gallery",
  );
  const startY = await browser.evaluate("scrollY");
  await browser.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 180, y: point.y }],
  });
  for (let i = 1; i <= 5; i++) {
    await browser.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 180, y: point.y - i * 30 }],
    });
    await browser.wait(40);
  }
  await browser.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await browser.wait(350);
  assert.ok(
    await browser.evaluate(`scrollY>${startY + 60}`),
    "Vertical swipe over gallery must continue scrolling the page",
  );
  console.log(
    "PASS real touch gestures: horizontal case swipe and vertical page scroll",
  );
  await browser.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await browser.load(1440, false);
  await browser.evaluate(
    "window.responsiveErrors=[];addEventListener('error',e=>window.responsiveErrors.push(e.message))",
  );
  for (const [width, touch] of [
    [390, true],
    [768, true],
    [1024, true],
    [1440, false],
  ]) {
    await browser.send("Emulation.setTouchEmulationEnabled", {
      enabled: touch,
      maxTouchPoints: touch ? 5 : 1,
    });
    await browser.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: touch,
    });
    await browser.wait(450);
    const state = await browser.evaluate(
      "({pinned:document.querySelectorAll('.centered-cases_gallery.is-pinned').length,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1})",
    );
    assert.equal(state.pinned, width >= 1024 && !touch ? 4 : 0);
    assert.equal(state.overflow, false);
  }
  await browser.evaluate(
    "document.querySelector('[data-centered-gallery]').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));window.scrollBy({top:-200,behavior:'instant'})",
  );
  await browser.wait(150);
  assert.ok(
    Math.abs(
      await browser.evaluate(
        "document.querySelector('.centered-cases_stage').getBoundingClientRect().top",
      ),
    ) < 2,
    "Desktop case pin must survive resizing",
  );
  assert.deepEqual(await browser.evaluate("window.responsiveErrors"), []);
  console.log(
    "PASS live desktop/mobile/tablet resize: no stale pins, overflow or browser errors",
  );
} finally {
  await browser.close();
}

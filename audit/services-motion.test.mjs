import assert from "node:assert/strict";

const tabs = await (await fetch("http://localhost:9223/json")).json();
const ws = new WebSocket(tabs.find((tab) => tab.type === "page").webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (!pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  message.error ? reject(message.error) : resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 1000));
try {
  await send("Page.enable");
  for (const [component, rootSelector, headingSelector, itemSelector] of [
    ["ContentWorkSetup", ".work-setup_wrap", ".work-setup_heading", ".work-setup_card"],
    ["ContentServicesOverview", "[data-services-overview]", ".services-overview_heading", ".services-overview_item"],
  ]) {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send("Page.navigate", { url: "http://localhost:4321/" });
    await settle();
    await evaluate("document.fonts.ready");
    const source = await (await fetch("http://localhost:4321/src/components/ContentServicesOverview.astro?astro&type=script&index=0&lang.ts")).text();
    const moduleUrl = source.match(/from "([^"]*gsap_ScrollTrigger[^"]*)"/)[1];
    await evaluate(`(async () => { window.servicesTriggers = (await import('${moduleUrl}')).ScrollTrigger; servicesTriggers.refresh(); })()`);
    const range = await evaluate(`(() => { const t = servicesTriggers.getAll().find(t => t.trigger.matches('${rootSelector}')); return t ? {start:t.start,end:t.end} : null; })()`);
    assert.ok(range, `${component}: reveal must follow scroll progress`);
    for (const progress of [0, .1, .3, .5, .7, .9, 1, .5, 0]) {
      await evaluate(`window.scrollTo(0, ${range.start + (range.end - range.start) * progress})`);
      await settle();
      const values = await evaluate(`(() => {
        const root = document.querySelector('${rootSelector}');
        const opacity = e => { let value = 1; for (; e && e !== root; e = e.parentElement) value *= Number(getComputedStyle(e).opacity); return value; };
        const heading = root.querySelector('${headingSelector}');
        return {lines: [...heading.children].map(opacity), items: [heading, ...root.querySelectorAll('${itemSelector}')].map(e => ({opacity:opacity(e),children:[...e.children].map(opacity)}))};
      })()`);
      assert.ok(values.lines.every(value => Math.abs(value - values.items[0].opacity) < .001), `${width} @ ${progress}: heading must reveal as one element`);
      values.items.forEach((item, index) => {
        assert.ok(item.children.every(value => Math.abs(value - item.opacity) < .001), `${width} @ ${progress}: item ${index} must reveal as a unit`);
        if (index > 0 && item.opacity > .001) assert.ok(values.items[index - 1].opacity > .999, `${width} @ ${progress}: previous item must finish first`);
      });
      if (progress === 1) assert.ok(values.items.every(item => item.opacity > .999), `${width}: all items finish`);
    }
    console.log(`PASS ${component} ${width}: complete elements, ordered scroll and reverse scroll`);
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await settle();
    assert.ok(await evaluate(`[...document.querySelectorAll('${headingSelector}, ${itemSelector}, ${itemSelector} > *')].every(e => getComputedStyle(e).opacity === '1' && getComputedStyle(e).visibility === 'visible')`));
    console.log(`PASS ${width}: reduced motion keeps every element visible`);
    await send("Emulation.setEmulatedMedia", { features: [] });
  }
  }
} finally {
  await send("Emulation.setEmulatedMedia", { features: [] });
  ws.close();
}

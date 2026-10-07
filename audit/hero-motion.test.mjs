import assert from "node:assert/strict";

const tabs = await (await fetch("http://localhost:9224/json")).json();
const ws = new WebSocket(
  tabs.find((tab) => tab.type === "page").webSocketDebuggerUrl,
);
await new Promise((resolve) =>
  ws.addEventListener("open", resolve, { once: true }),
);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  message.error
    ? handler.reject(message.error)
    : handler.resolve(message.result);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  assert.equal(
    result.exceptionDetails,
    undefined,
    JSON.stringify(result.exceptionDetails),
  );
  return result.result.value;
};
const waitForLoad = () => new Promise((resolve) => {
  const listener = (event) => {
    if (JSON.parse(event.data).method !== "Page.loadEventFired") return;
    ws.removeEventListener("message", listener);
    resolve();
  };
  ws.addEventListener("message", listener);
});
try {
  await send("Page.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
    window.heroEvents = [];
    window.addEventListener('load', () => window.heroLoad = performance.now());
    document.addEventListener('animationstart', event => {
      if (event.target.matches('.hero_layout [data-reveal]')) {
        window.heroEvents.push({className: event.target.classList[0], time: performance.now(), preloaderOpacity: Number(getComputedStyle(document.querySelector('.page-preloader')).opacity), duration: getComputedStyle(event.target).animationDuration});
      }
    });
  `,
  });
  for (const width of [1440, 390]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    const loaded = waitForLoad();
    await send("Page.navigate", { url: "http://localhost:4321" });
    await loaded;
    const result = await evaluate(`new Promise((resolve, reject) => {
      const start = performance.now();
      const poll = () => {
        if (window.heroEvents?.length === 4 && !document.querySelector('.hero_layout [data-motion-ready]')) {
          resolve({events: window.heroEvents, load: window.heroLoad, descriptionOpacity: getComputedStyle(document.querySelector('.hero_description > .text')).opacity, actionOpacity: getComputedStyle(document.querySelector('.hero_action')).opacity});
        } else if (performance.now() - start > 15000) reject(new Error('Hero reveal did not finish'));
        else setTimeout(poll, 50);
      }; poll();
    })`);
    assert.deepEqual(
      result.events.map((event) => event.className),
      ["hero_heading", "hero_description", "hero_action_wrap", "hero_bottom"],
    );
    assert.ok(
      result.events[0].time - result.load < 150,
      JSON.stringify(result),
    );
    assert.ok(result.events[0].preloaderOpacity > 0, JSON.stringify(result));
    assert.equal(result.events[0].duration, "0.7s");
    for (let index = 1; index < 4; index++) {
      const interval =
        result.events[index].time - result.events[index - 1].time;
      assert.ok(interval > 70 && interval < 190, String(interval));
    }
    assert.equal(result.descriptionOpacity, "0.35");
    assert.equal(result.actionOpacity, "0.8");
    console.log(
      `${width}: immediate start, order, overlap, 700ms duration and final opacity passed.`,
      JSON.stringify(result.events),
    );
  }
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  const loaded = waitForLoad();
  await send("Page.reload");
  await loaded;
  const reduced = await evaluate(`new Promise(resolve => {
    const poll = () => document.documentElement.classList.contains('is-page-reveal-ready') ? resolve([...document.querySelectorAll('.hero_layout [data-reveal]')].map(item => ({opacity: getComputedStyle(item).opacity, animation: getComputedStyle(item).animationName}))) : setTimeout(poll, 50);
    poll();
  })`);
  assert.equal(reduced.length, 4);
  reduced.forEach((item) => {
    assert.equal(item.opacity, "1");
    assert.equal(item.animation, "none");
  });
  console.log("Reduced motion: all four groups visible without animation.");
} finally {
  await send("Emulation.setEmulatedMedia", { features: [] });
  ws.close();
}

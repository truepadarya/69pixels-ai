import assert from 'node:assert/strict';

export async function browserSession({ baseUrl = 'http://localhost:4321' } = {}) {
  const tab = await (await fetch('http://localhost:9223/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const m = JSON.parse(data);
    const p = pending.get(m.id);
    if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    assert.equal(r.exceptionDetails, undefined, JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const load = async (width, reduced = false, path = '/', height = width < 600 ? 844 : 900) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
    await send('Page.navigate', { url: baseUrl + path });
    for (let i = 0; i < 100; i++) {
      await wait(200);
      if (await evaluate("document.readyState === 'complete' && document.documentElement.classList.contains('is-page-ready')")) break;
    }
    await evaluate('document.fonts.ready');
    await wait(750);
  };
  await send('Page.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  return { send, evaluate, wait, load, close: async () => {
    const closed = new Promise(resolve => ws.addEventListener('close', resolve, { once: true }));
    ws.close();
    await closed;
    await fetch(`http://localhost:9223/json/close/${tab.id}`);
  } };
}

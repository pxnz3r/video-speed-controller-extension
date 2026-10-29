// Runs in the page's own JS world (MAIN) so it can patch fetch/XHR and hls.js.
// Settings arrive from content.js via data attributes on <html>.
(() => {
  'use strict';

  const on = (name) => document.documentElement.dataset[name] === '1';

  // --- Quality lock: strip every HLS variant below the highest resolution ---

  function filterMaster(text) {
    if (!on('vscQuality') || typeof text !== 'string' || !text.startsWith('#EXTM3U') ||
        !text.includes('#EXT-X-STREAM-INF')) return text;

    const lines = text.split(/\r?\n/);
    const variants = []; // { start, end, height, bw }
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('#EXT-X-STREAM-INF')) continue;
      let end = i + 1;
      while (end < lines.length && (lines[end] === '' || lines[end].startsWith('#'))) end++;
      const res = /RESOLUTION=\d+x(\d+)/.exec(lines[i]);
      const bw = /[^-]BANDWIDTH=(\d+)/.exec(lines[i]);
      variants.push({ start: i, end, height: res ? +res[1] : 0, bw: bw ? +bw[1] : 0 });
      i = end;
    }
    if (variants.length < 2) return text;

    // Keep all variants at the top resolution (they may differ by codec); if no
    // RESOLUTION tags exist, fall back to the highest bandwidth.
    const maxH = Math.max(...variants.map((v) => v.height));
    const maxBw = Math.max(...variants.map((v) => v.bw));
    const keep = (v) => (maxH > 0 ? v.height === maxH : v.bw === maxBw);

    const drop = new Set();
    for (const v of variants) {
      if (!keep(v)) for (let j = v.start; j <= v.end; j++) drop.add(j);
    }
    return lines.filter((_, j) => !drop.has(j)).join('\n');
  }

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    const type = res.headers.get('content-type') || '';
    if (!on('vscQuality') || !(/\.m3u8/i.test(res.url) || /mpegurl/i.test(type))) return res;
    const text = await res.clone().text();
    const out = filterMaster(text);
    if (out === text) return res;
    const patched = new Response(out, { status: res.status, statusText: res.statusText, headers: res.headers });
    Object.defineProperty(patched, 'url', { value: res.url });
    return patched;
  };

  const cache = new WeakMap();
  for (const prop of ['responseText', 'response']) {
    const desc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, prop);
    Object.defineProperty(XMLHttpRequest.prototype, prop, {
      configurable: true,
      enumerable: desc.enumerable,
      get() {
        const val = desc.get.call(this);
        if (typeof val !== 'string' || this.readyState !== 4) return val;
        const hit = cache.get(this);
        if (hit && hit.in === val) return hit.out;
        const out = filterMaster(val);
        cache.set(this, { in: val, out });
        return out;
      },
    });
  }

  // --- Performance mode: bigger buffer-ahead for players that expose hls.js ---

  function tuneHls(Hls) {
    if (!Hls || !on('vscPerf') || Hls.__vscTuned) return;
    const cfg = Hls.DefaultConfig;
    if (!cfg) return;
    Object.assign(cfg, {
      maxBufferLength: 120, // seconds to buffer ahead (default 30)
      maxMaxBufferLength: 600,
      maxBufferSize: 300 * 1000 * 1000, // bytes (default 60 MB)
      backBufferLength: 60,
      abrEwmaDefaultEstimate: 5e6, // assume a fast connection at start
    });
    Hls.__vscTuned = true;
  }

  let hls = window.Hls;
  tuneHls(hls);
  try {
    Object.defineProperty(window, 'Hls', {
      configurable: true,
      enumerable: true,
      get: () => hls,
      set(v) { hls = v; tuneHls(v); },
    });
  } catch (e) {
    console.warn('[vsc] could not hook window.Hls', e);
  }
})();

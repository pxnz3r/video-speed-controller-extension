(() => {
  'use strict';

  const STEP = 0.1;
  const SKIP = 10;
  const MIN = 0.07;
  const MAX = 16;

  // S slower, D faster, R reset, Z back 10s, X forward 10s, V show/hide controller
  const KEYS = { s: 'slower', d: 'faster', r: 'reset', z: 'rewind', x: 'advance', v: 'toggle' };

  let rate = 1;
  let hidden = false;
  const controllers = new Map();

  chrome.storage.local.get({ rate: 1 }, (s) => {
    rate = s.rate;
    controllers.forEach((c, video) => applyRate(video));
  });

  const round = (n) => Math.round(n * 100) / 100;

  function setRate(video, r) {
    rate = round(Math.min(MAX, Math.max(MIN, r)));
    chrome.storage.local.set({ rate });
    applyRate(video);
  }

  function applyRate(video) {
    if (video.playbackRate !== rate) video.playbackRate = rate;
  }

  function act(video, action) {
    switch (action) {
      case 'slower': setRate(video, video.playbackRate - STEP); break;
      case 'faster': setRate(video, video.playbackRate + STEP); break;
      case 'reset': setRate(video, video.playbackRate === 1 ? 1.8 : 1); break;
      case 'rewind': video.currentTime -= SKIP; break;
      case 'advance': video.currentTime += SKIP; break;
      case 'toggle':
        hidden = !hidden;
        controllers.forEach((c) => (c.host.style.display = hidden ? 'none' : ''));
        break;
    }
    controllers.get(video)?.flash();
  }

  function attach(video) {
    if (controllers.has(video) || !video.parentElement) return;

    const parent = video.parentElement;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;top:0;left:0;z-index:2147483647;';
    if (hidden) host.style.display = 'none';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `
      <style>
        #bar { margin:10px; display:inline-flex; align-items:center; gap:2px;
          background:rgba(0,0,0,.6); color:#fff; border-radius:6px; padding:3px 6px;
          font:600 13px/1 system-ui,sans-serif; opacity:.3; transition:opacity .2s;
          user-select:none; cursor:default; }
        #bar:hover, #bar.show { opacity:1; }
        #bar:not(:hover) button { display:none; }
        button { background:transparent; color:#fff; border:1px solid rgba(255,255,255,.4);
          border-radius:4px; padding:2px 7px; margin-left:4px; cursor:pointer; font:inherit; }
        button:hover { background:rgba(255,255,255,.2); }
        #rate { min-width:3.2em; text-align:center; }
      </style>
      <div id="bar">
        <span id="rate"></span>
        <button data-a="rewind" title="Back 10s (Z)">«</button>
        <button data-a="slower" title="Slower (S)">−</button>
        <button data-a="faster" title="Faster (D)">+</button>
        <button data-a="advance" title="Forward 10s (X)">»</button>
        <button data-a="toggle" title="Hide (V)">×</button>
      </div>`;

    const bar = root.getElementById('bar');
    const label = root.getElementById('rate');
    const update = () => (label.textContent = video.playbackRate.toFixed(2) + 'x');

    // Stop clicks reaching the player underneath (which would toggle play/pause).
    for (const ev of ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick']) {
      bar.addEventListener(ev, (e) => e.stopPropagation());
    }
    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a) act(video, a);
    });

    let timer;
    const flash = () => {
      bar.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => bar.classList.remove('show'), 1200);
    };

    parent.appendChild(host);
    controllers.set(video, { host, flash });

    video.addEventListener('ratechange', update);
    // Players often reset speed on source/quality change; put it back.
    for (const ev of ['loadeddata', 'play', 'seeked']) {
      video.addEventListener(ev, () => applyRate(video));
    }
    applyRate(video);
    update();
  }

  function activeVideo() {
    const vids = [...controllers.keys()].filter((v) => v.isConnected);
    return vids.find((v) => !v.paused) || vids.find((v) => v.offsetWidth > 0) || vids[0];
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    const t = e.target;
    if (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName)) return;
    const action = KEYS[e.key.toLowerCase()];
    const video = action && activeVideo();
    if (!video) return;
    e.preventDefault();
    e.stopPropagation();
    act(video, action);
  }, true);

  const scan = () => {
    document.querySelectorAll('video').forEach(attach);
    controllers.forEach((c, v) => {
      if (!v.isConnected) { c.host.remove(); controllers.delete(v); }
    });
  };
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();

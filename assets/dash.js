/*
 * A tiny stand-in for the dashboard runtime the page was first built on.
 * It serves the data in window.HOF_DATA (from data/data.js) and runs the
 * page's calculations, so app.js works unchanged as a static site.
 */
(function () {
  const raw = window.HOF_DATA || {};
  const sources = {
    seasons: raw.seasons,
    nfl_coaches: raw.nfl_coaches,
    coach_photos: raw.coach_photos,
  };
  const calcs = {};
  const cache = {};
  const listeners = [];

  function data(id) {
    if (id in sources) {
      return Array.isArray(sources[id])
        ? { status: 'ok', data: sources[id], meta: [] }
        : { status: 'error', data: [], message: 'Missing data: ' + id, meta: [] };
    }
    const def = calcs[id];
    if (!def) return { status: 'missing', data: [], meta: [] };
    if (!(id in cache)) {
      const inputs = def.inputs.map(data);
      if (inputs.some((x) => x.status !== 'ok')) return { status: 'error', data: [], meta: [] };
      try {
        cache[id] = def.fn(...inputs.map((x) => x.data));
      } catch (err) {
        console.error('Calculation failed:', id, err);
        cache[id] = null;
      }
    }
    return cache[id] == null
      ? { status: 'error', data: [], meta: [] }
      : { status: 'ok', data: cache[id], meta: [] };
  }

  function run(fn) {
    try { fn(); } catch (err) { console.error(err); }
  }

  window.dash = {
    data,
    calc(id, def) { calcs[id] = def; },
    loader() {},
    onData(fn) { listeners.push(fn); run(fn); },
    colors: ['var(--series-1)'],
    refresh() {},
    params() { return {}; },
    setParams() {},
    resetParams() {},
    setLink() {},
  };

  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - lastWidth) < 24) return;
    lastWidth = window.innerWidth;
    listeners.forEach(run);
  });
})();

dash.calc('careers', {
  inputs: ['seasons'],
  title: 'Career totals',
  description: 'Each manager’s record (incl. playoffs), titles, top-3 finishes, playoff rate, HOF points and progress toward induction, summed across seasons.',
  fn: (seasons) => {
    const need = {titles: 2, top3: 5, playoffRate: 0.65, winPct: 0.575};
    const by = {};
    for (const s of seasons) {
      const m = by[s.manager] ??= {manager: s.manager, seasons: 0, completed: 0, active: 0, w: 0, l: 0, t: 0, apw: 0, apl: 0, pf: 0, titles: 0, runnerUps: 0, top3: 0, lastPlace: 0, playoffs: 0, poW: 0, poL: 0, pfTitles: 0};
      const done = !Number(s.inProgress);
      m.seasons += 1; if (!done) m.active = 1;
      m.w += +s.w + +s.pow; m.l += +s.l + +s.pol; m.t += +s.t;
      m.poW += +s.pow; m.poL += +s.pol; m.apw += +s.apw; m.apl += +s.apl; m.pf += +s.pf;
      if (done) {
        m.completed += 1; m.playoffs += +s.playoffs; m.pfTitles += +s.pfTitle;
        m.titles += +(s.finish == 1); m.runnerUps += +(s.finish == 2);
        m.top3 += +(s.finish >= 1 && s.finish <= 3); m.lastPlace += +(s.finish == 12);
      }
    }
    const clamp = (x) => Math.max(0, Math.min(1, x));
    return Object.values(by).map((m) => {
      const winPct = +((m.w + m.t / 2) / (m.w + m.l + m.t)).toFixed(3);
      const allPlayPct = +(m.apw / (m.apw + m.apl)).toFixed(3);
      const playoffRate = m.completed ? +(m.playoffs / m.completed).toFixed(3) : 0;
      const met = [m.titles >= need.titles, m.top3 >= need.top3, playoffRate >= need.playoffRate, winPct >= need.winPct];
      const criteriaMet = met.filter(Boolean).length;
      const hofScore = m.titles * 4 + m.runnerUps + m.playoffs + m.pfTitles - m.lastPlace * 3;
      const progress = +((clamp(m.titles / need.titles) + clamp(m.top3 / need.top3) + clamp(playoffRate / need.playoffRate) + clamp((winPct - 0.4) / (need.winPct - 0.4))) / 4).toFixed(3);
      const tl = need.titles - m.titles, fl = need.top3 - m.top3;
      const gaps = [];
      if (!met[0]) gaps.push(`${tl} more title${tl > 1 ? 's' : ''}`);
      if (!met[1]) gaps.push(`${fl} more top-3 finish${fl > 1 ? 'es' : ''}`);
      if (!met[2]) gaps.push('playoff rate up to 65%');
      if (!met[3]) gaps.push('win % up to .575');
      const status = criteriaMet === 4 ? 'Hall of Famer' : criteriaMet === 3 ? 'On the doorstep' : (m.titles >= 1 || criteriaMet >= 2) ? 'In the hunt' : 'Long shot';
      return {
        manager: m.manager, status, hofScore, progress, criteriaMet,
        need: gaps.length ? 'Needs ' + gaps.join(', ') : 'All criteria met',
        seasons: m.seasons, completed: m.completed, active: m.active,
        record: `${m.w}-${m.l}${m.t ? '-' + m.t : ''}`, winPct, allPlayPct,
        titles: m.titles, runnerUps: m.runnerUps, top3: m.top3, playoffs: m.playoffs, playoffRate,
        poRecord: `${m.poW}-${m.poL}`, pfTitles: m.pfTitles, lastPlace: m.lastPlace, pf: +m.pf.toFixed(2)
      };
    }).sort((a, b) => b.hofScore - a.hofScore || b.progress - a.progress);
  }
});

dash.calc('champions', {
  inputs: ['seasons'],
  title: 'Champions by season',
  description: 'The manager who finished first each completed season, with the runner-up.',
  fn: (seasons) => {
    const years = [...new Set(seasons.map((s) => +s.season))].sort((a, b) => b - a);
    return years.map((y) => {
      const yr = seasons.filter((s) => +s.season === y);
      const c = yr.find((s) => s.finish == 1), ru = yr.find((s) => s.finish == 2);
      return c ? {season: y, champion: c.manager, team: c.team, record: `${c.w}-${c.l}`, seed: +c.seed, runnerUp: ru ? ru.manager : ''} : null;
    }).filter(Boolean);
  }
});

dash.calc('comps', {
  inputs: ['seasons', 'nfl_coaches'],
  title: 'NFL coaching comps',
  description: 'Matches each manager to the NFL coach (3+ seasons) whose percentile ranks on titles, title rate, finals rate, playoff rate, win % and playoff win % are closest, for two pools: careers reaching 2001 or later, and all-time. Each coach is used once per pool.',
  fn: (seasons, nfl_coaches) => {
    const W = {titles: 3, titleRate: 2, finalsRate: 1, playoffRate: 1, winPct: 2, playoffWinPct: 1};
    const keys = Object.keys(W);
    const by = {};
    for (const s of seasons) {
      const m = by[s.manager] ??= {name: s.manager, n: 0, ti: 0, fi: 0, po: 0, w: 0, l: 0, pw: 0, pl: 0};
      m.w += +s.w + +s.pow; m.l += +s.l + +s.pol;
      if (!Number(s.inProgress)) {
        m.n += 1; m.ti += +(s.finish == 1); m.fi += +(s.finish == 1 || s.finish == 2);
        m.po += +s.playoffs; m.pw += +s.pow; m.pl += +s.pol;
      }
    }
    const mgrs = Object.values(by).map((m) => {
      const n = Math.max(m.n, 1);
      return {name: m.name, titles: m.ti, titleRate: m.ti / n, finalsRate: m.fi / n, playoffRate: m.po / n, winPct: m.w / (m.w + m.l), playoffWinPct: m.pw + m.pl ? m.pw / (m.pw + m.pl) : 0};
    });
    const coaches = nfl_coaches.map((c) => {
      const y = +c.seasons, pg = +c.playoffW + +c.playoffL;
      return {...c, name: c.coach, titles: +c.championships, titleRate: c.championships / y, finalsRate: Math.max(+c.conferenceTitles, +c.championships) / y, playoffRate: c.playoffSeasons / y, winPct: +c.winPct, playoffWinPct: pg ? c.playoffW / pg : 0};
    });
    const rank = (pop) => keys.forEach((k) => {
      const v = pop.map((p) => p[k]);
      pop.forEach((p) => { p['p_' + k] = (v.filter((x) => x < p[k]).length + (v.filter((x) => x === p[k]).length - 1) / 2) / (v.length - 1); });
    });
    rank(mgrs);
    const dist = (a, b) => Math.sqrt(keys.reduce((s, k) => s + W[k] * (a['p_' + k] - b['p_' + k]) ** 2, 0) / 10);
    const label = {titles: 'titles', titleRate: 'title rate', finalsRate: 'finals trips', playoffRate: 'playoff rate', winPct: 'win %', playoffWinPct: 'playoff wins'};
    const tier = (m) => m.p_titles * 3 + m.p_titleRate * 2 + m.p_winPct * 2;
    const order = [...mgrs].sort((a, b) => tier(b) - tier(a));
    const match = (era, pool) => {
      const ranked = pool.map((c) => ({...c}));
      rank(ranked);
      const used = new Set();
      return order.map((m) => {
        const c = ranked.filter((x) => !used.has(x.name)).sort((x, y) => dist(m, x) - dist(m, y))[0];
        used.add(c.name);
        const high = keys.filter((k) => m['p_' + k] >= 0.7 && c['p_' + k] >= 0.7).map((k) => label[k]);
        const low = keys.filter((k) => m['p_' + k] <= 0.3 && c['p_' + k] <= 0.3).map((k) => label[k]);
        const why = high.length ? 'Both elite in ' + high.slice(0, 3).join(', ') : low.length ? 'Both near the bottom in ' + low.slice(0, 3).join(', ') : 'Middle-of-the-pack profile across the board';
        return {
          manager: m.name, era, coach: c.name, match: Math.round((1 - dist(m, c)) * 100), why,
          coachYears: `${c.fromYear}–${c.toYear}`, coachTitles: c.titles, coachRecord: `${c.w}-${c.l}${+c.t ? '-' + c.t : ''}`, coachWinPct: c.winPct
        };
      });
    };
    return [...match('modern', coaches.filter((c) => +c.toYear >= 2001)), ...match('all', coaches)];
  }
});

dash.calc('summary', {
  inputs: ['careers', 'champions'],
  title: 'League summary',
  description: 'Hall of Fame count, titles awarded, and the manager closest to induction.',
  fn: (careers, champions) => {
    const open = careers.filter((c) => c.criteriaMet < 4).sort((a, b) => b.progress - a.progress || b.hofScore - a.hofScore);
    return [{
      inducted: careers.filter((c) => c.criteriaMet === 4).length,
      championships: champions.length,
      uniqueChampions: new Set(champions.map((c) => c.champion)).size,
      managers: careers.length,
      closest: open.length ? open[0].manager : '',
      closestNeed: open.length ? open[0].need : ''
    }];
  }
});

(() => {
  const pct = d3.format('.1%');
  const f1 = d3.format('.1f');
  const comma = d3.format(',.0f');
  const enc = (v) => String(v).replace(/%/g, '%25').replace(/&/g, '%26').replace(/=/g, '%3D');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const mark = (e, src, field, mgr, extra) => { e.dataset.source = src; e.dataset.field = field; e.dataset.where = 'manager=' + enc(mgr) + (extra ? '&' + extra : ''); return e; };
  const fail = (box) => { box.classList.remove('dash-skeleton'); box.replaceChildren(el('div', 'fail', 'Failed to load')); };
  const accent = dash.colors[0];

  let sortKey = 'hofScore', sortDir = -1;
  const cols = [
    {k: 'manager', label: 'Manager', cls: 'l'},
    {k: 'seasons', label: 'Seasons'},
    {k: 'record', label: 'Record', sortBy: 'winPct'},
    {k: 'winPct', label: 'Win %', fmt: pct},
    {k: 'titles', label: 'Titles'},
    {k: 'top3', label: 'Top 3'},
    {k: 'playoffRate', label: 'Playoff %', fmt: pct},
    {k: 'runnerUps', label: '2nd', cls: 'hide-n'},
    {k: 'poRecord', label: 'Playoff W-L', cls: 'hide-n', sortBy: 'playoffs'},
    {k: 'pfTitles', label: 'PF leader', cls: 'hide-n'},
    {k: 'lastPlace', label: 'Sackos', cls: 'hide-n'},
    {k: 'allPlayPct', label: 'All-play %', fmt: pct, cls: 'hide-n'},
    {k: 'pf', label: 'Points for', fmt: comma, cls: 'hide-n'},
    {k: 'hofScore', label: 'HOF pts'}
  ];

  const statusCls = {'Hall of Famer': 'st-hof', 'On the doorstep': 'st-door', 'In the hunt': 'st-hunt', 'Long shot': 'st-long'};

  function drawTakeaway(sum) {
    const p = document.getElementById('takeaway');
    if (sum.status !== 'ok') { if (sum.status === 'error') { p.classList.remove('dash-skeleton'); p.textContent = ''; } return; }
    p.classList.remove('dash-skeleton');
    const s = sum.data[0];
    const name = el('b', null, s.closest); name.dataset.source = 'summary'; name.dataset.field = 'closest'; name.dataset.row = '0';
    const need = el('span', null, s.closestNeed.replace(/^Needs/, 'needs')); need.dataset.source = 'summary'; need.dataset.field = 'closestNeed'; need.dataset.row = '0';
    if (!s.closest) { p.textContent = 'Every manager has met the induction criteria.'; return; }
    const lead = s.inducted > 0 ? 'Next up: ' : 'No one has been inducted yet. ';
    p.replaceChildren(lead, name, ' is closest to the Hall and ', need, '.');
  }

  function drawTiles(sum) {
    document.querySelectorAll('#tiles .val').forEach((v) => {
      if (sum.status === 'ok') { v.classList.remove('dash-skeleton'); v.textContent = d3.format(',')(sum.data[0][v.dataset.field]); }
      else if (sum.status === 'error') { v.classList.remove('dash-skeleton'); v.textContent = '—'; }
      else v.textContent = '—';
    });
  }

  function bar(label, valueNode, suffix, frac, met) {
    const w = el('div', 'crit');
    const row = el('div', 'crit-row');
    const v = el('span', 'v'); v.append(valueNode, suffix);
    row.append(el('span', null, label), v);
    const b = el('div', 'bar'); const i = el('i');
    i.style.width = (Math.max(0, Math.min(1, frac)) * 100).toFixed(1) + '%';
    i.style.background = met ? 'var(--color-ok)' : accent;
    b.append(i); w.append(row, b);
    return w;
  }

  let era = 'modern';
  document.querySelectorAll('#era-toggle button').forEach((b) => b.addEventListener('click', () => {
    era = b.dataset.era;
    document.querySelectorAll('#era-toggle button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    drawRoad(dash.data('careers'), dash.data('comps'), dash.data('coach_photos'));
  }));

  function coachFigure(cmp, photos, mgr) {
    const fig = el('div', 'coach');
    fig.append(el('span', 'cl', 'Plays like'));
    const c = cmp.status === 'ok' ? cmp.data.find((x) => x.manager === mgr && x.era === era) : null;
    if (!c) { fig.append(el('div', 'cn dash-skeleton', '—')); return {fig, c: null}; }
    const p = photos.status === 'ok' ? photos.data.find((x) => x.coach === c.coach) : null;
    const img = el('img');
    img.alt = c.coach;
    if (p && String(p.photo).startsWith('data:image/')) img.src = p.photo;
    fig.append(img);
    fig.append(mark(el('div', 'cn', c.coach), 'comps', 'coach', mgr, 'era=' + c.era));
    const m = el('div', 'cm');
    m.append(mark(el('span', null, String(c.match)), 'comps', 'match', mgr, 'era=' + c.era), '% match');
    fig.append(m);
    return {fig, c};
  }

  function drawRoad(car, cmp, photos) {
    const grid = document.getElementById('road-grid');
    if (car.status === 'error') return fail(grid);
    if (car.status !== 'ok') return;
    grid.classList.remove('dash-skeleton');
    grid.replaceChildren(...car.data.map((c) => {
      const card = el('article', 'card rc' + (c.criteriaMet === 4 ? ' is-hof' : ''));
      const top = el('div', 'rc-top');
      const left = el('div');
      left.append(mark(el('div', 'rc-name', c.manager), 'careers', 'manager', c.manager));
      const sub = el('div', 'rc-sub');
      sub.append(mark(el('span', null, String(c.seasons)), 'careers', 'seasons', c.manager), ` season${c.seasons === 1 ? '' : 's'}`);
      left.append(sub);
      const meta = el('div', 'rc-meta');
      meta.style.marginTop = 'var(--cds-gap-sm)';
      const pts = el('span', 'pts');
      pts.append(mark(el('b', null, String(c.hofScore)), 'careers', 'hofScore', c.manager), ' HOF pts');
      meta.append(mark(el('span', 'pill ' + statusCls[c.status], c.status), 'careers', 'status', c.manager), pts);
      left.append(meta);
      const {fig, c: comp} = coachFigure(cmp, photos, c.manager);
      top.append(left, fig);
      card.append(top);
      if (comp) card.append(mark(el('div', 'rc-why', comp.why), 'comps', 'why', c.manager, 'era=' + comp.era));
      const t = bar('Titles', mark(el('span', null, String(c.titles)), 'careers', 'titles', c.manager), ' / 2', c.titles / 2, c.titles >= 2);
      const t3 = bar('Top-3 finishes', mark(el('span', null, String(c.top3)), 'careers', 'top3', c.manager), ' / 5', c.top3 / 5, c.top3 >= 5);
      const pr = bar('Playoff rate', mark(el('span', null, pct(c.playoffRate)), 'careers', 'playoffRate', c.manager), ' / 65%', c.playoffRate / 0.65, c.playoffRate >= 0.65);
      const wp = bar('Win % (incl. playoffs)', mark(el('span', null, pct(c.winPct)), 'careers', 'winPct', c.manager), ' / 57.5%', (c.winPct - 0.4) / 0.175, c.winPct >= 0.575);
      const need = mark(el('div', 'rc-need', c.need), 'careers', 'need', c.manager);
      card.append(t, t3, pr, wp, need);
      return card;
    }));
  }

  function drawCredits(photos) {
    const ul = document.getElementById('credit-list');
    if (photos.status === 'error') return fail(ul);
    if (photos.status !== 'ok') return;
    ul.classList.remove('dash-skeleton');
    ul.replaceChildren(...[...photos.data].sort((a, b) => a.coach.localeCompare(b.coach)).map((p) => {
      const li = el('li');
      li.append(el('b', null, p.coach), ` — ${p.credit}, ${p.license}`);
      return li;
    }));
  }

  function drawHeat(sea, car) {
    const wrap = document.getElementById('heat-wrap');
    const heat = document.getElementById('heat');
    const tt = document.getElementById('tt');
    if (sea.status === 'error' || car.status === 'error') { wrap.classList.remove('dash-skeleton'); heat.replaceChildren(el('div', 'fail', 'Failed to load')); return; }
    if (sea.status !== 'ok' || car.status !== 'ok') return;
    wrap.classList.remove('dash-skeleton');
    const rows = sea.data.map((r) => ({...r, season: +r.season, finish: +r.finish, seed: +r.seed, w: +r.w, l: +r.l, pf: +r.pf, inProgress: +r.inProgress, playoffs: +r.playoffs}));
    const years = [...new Set(rows.map((r) => r.season))].sort((a, b) => a - b);
    const look = new Map(rows.map((r) => [r.manager + '|' + r.season, r]));
    heat.style.gridTemplateColumns = `minmax(7.5rem, 1fr) repeat(${years.length}, minmax(2.25rem, 3rem))`;
    const nodes = [el('div', 'hh', '')];
    years.forEach((y) => nodes.push(el('div', 'hh', "'" + String(y).slice(2))));
    for (const c of car.data) {
      nodes.push(el('div', 'hn', c.manager));
      for (const y of years) {
        const r = look.get(c.manager + '|' + y);
        let cell;
        if (!r) cell = el('div', 'hc none', '');
        else if (r.inProgress) cell = el('div', 'hc live', String(r.seed));
        else {
          cell = el('div', 'hc' + (r.playoffs ? '' : ' miss') + (r.finish === 12 ? ' last' : ''), String(r.finish));
          if (r.playoffs) {
            const strength = r.finish === 1 ? 100 : r.finish <= 3 ? 62 : 30;
            cell.style.background = `color-mix(in srgb, ${accent} ${strength}%, transparent)`;
            cell.style.color = r.finish === 1 ? 'var(--color-bg)' : 'var(--color-fg)';
            if (r.finish === 1) cell.style.fontWeight = '600';
          }
        }
        if (r) {
          cell.addEventListener('mouseenter', () => {
            tt.replaceChildren(
              el('div', 't1', `${y} · ${c.manager}`),
              el('div', null, r.team),
              el('div', null, `${r.w}-${r.l} · ${comma(r.pf)} PF`),
              el('div', null, r.inProgress ? `In progress · seed ${r.seed}` : `Finished ${r.finish} · seed ${r.seed}`)
            );
            tt.style.display = 'block';
            const wb = wrap.getBoundingClientRect(), cb = cell.getBoundingClientRect();
            let x = cb.left - wb.left + wrap.scrollLeft + cb.width / 2 - tt.offsetWidth / 2;
            x = Math.max(0, Math.min(x, wrap.scrollWidth - tt.offsetWidth));
            let yy = cb.top - wb.top - tt.offsetHeight - 6;
            if (yy < 0) yy = cb.bottom - wb.top + 6;
            tt.style.left = x + 'px'; tt.style.top = yy + 'px';
          });
          cell.addEventListener('mouseleave', () => { tt.style.display = 'none'; });
        }
        nodes.push(cell);
      }
    }
    heat.replaceChildren(...nodes);
    const lg = document.getElementById('legend');
    const sw = (bg, label, extra) => { const s = el('span'); const i = el('i'); i.style.background = bg; if (extra) i.style.cssText += extra; s.append(i, label); return s; };
    lg.replaceChildren(
      sw(accent, 'Champion'),
      sw(`color-mix(in srgb, ${accent} 62%, transparent)`, '2nd or 3rd'),
      sw(`color-mix(in srgb, ${accent} 30%, transparent)`, 'Made playoffs'),
      sw('var(--cds-chart-grid)', 'Missed playoffs'),
      sw('transparent', 'Last place', 'box-shadow: inset 0 0 0 1.5px var(--color-bad)'),
      sw('transparent', 'Current seed', 'border: 1px dashed var(--color-border-line)')
    );
  }

  function drawChamps(ch) {
    const box = document.getElementById('champ-box');
    const tb = document.querySelector('#champ-tbl tbody');
    if (ch.status === 'error') return fail(box);
    if (ch.status !== 'ok') return;
    box.classList.remove('dash-skeleton');
    tb.replaceChildren(...ch.data.map((c) => {
      const tr = el('tr');
      tr.append(el('td', null, String(c.season)), el('td', 'l', c.champion), el('td', 'l hide-n', c.team), el('td', null, c.record), el('td', null, String(c.seed)), el('td', 'l hide-n', c.runnerUp));
      return tr;
    }));
  }

  function drawCareers(car) {
    const box = document.getElementById('career-box');
    if (car.status === 'error') return fail(box);
    if (car.status !== 'ok') return;
    box.classList.remove('dash-skeleton');
    const hr = document.querySelector('#career-tbl thead tr');
    hr.replaceChildren(...cols.map((c) => {
      const th = el('th', c.cls || null);
      th.dataset.field = c.k;
      const key = c.sortBy || c.k;
      th.setAttribute('aria-sort', key === sortKey ? (sortDir < 0 ? 'descending' : 'ascending') : 'none');
      const b = el('button', null, c.label);
      b.addEventListener('click', () => {
        if (sortKey === key) sortDir = -sortDir; else { sortKey = key; sortDir = key === 'manager' ? 1 : -1; }
        drawCareers(dash.data('careers'));
      });
      th.append(b);
      return th;
    }));
    const rows = [...car.data].sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sortDir;
    });
    document.querySelector('#career-tbl tbody').replaceChildren(...rows.map((r) => {
      const tr = el('tr');
      cols.forEach((c) => tr.append(el('td', c.cls || null, c.fmt ? c.fmt(r[c.k]) : String(r[c.k]))));
      return tr;
    }));
  }

  dash.onData(() => {
    const sea = dash.data('seasons');
    const car = dash.data('careers');
    const ch = dash.data('champions');
    const sum = dash.data('summary');
    drawTakeaway(sum);
    drawTiles(sum);
    drawRoad(car, dash.data('comps'), dash.data('coach_photos'));
    drawCredits(dash.data('coach_photos'));
    drawHeat(sea, car);
    drawChamps(ch);
    drawCareers(car);
  });
})();

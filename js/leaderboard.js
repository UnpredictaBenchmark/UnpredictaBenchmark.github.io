const FAMILY_COLORS = {
  NVIDIA: '#76b900',
  OpenAI: '#10a37f',
  DeepSeek: '#4d6bfe',
  Meta: '#0668E1',
  Alibaba: '#ff6a00',
  'Mistral AI': '#f54e42',
  Anthropic: '#d4a574',
  AI2: '#2e7d32',
  Microsoft: '#00a4ef',
  xAI: '#1a1a1a',
  Inception: '#7c3aed',
};

const MINI_TOP_N = 5;
const CATEGORY_KEYS = ['code', 'text', 'realworld', 'shuffling'];
const CATEGORY_SHORT = ['Code', 'Text', 'RW', 'Shuf'];

let leaderboardData = null;

const state = {
  sortKey: 'score',
  sortDir: 'desc',
  metric: 'ks',
  sampleSize: 100,
  category: 'overall',
  search: '',
};

async function loadLeaderboardData() {
  if (leaderboardData) return leaderboardData;
  const res = await fetch('data/leaderboard.json');
  leaderboardData = await res.json();
  return leaderboardData;
}

function getKsScore(model, n = 100) {
  return model.ks?.[String(n)] ?? null;
}

function getCategoryMetricValues(model, metricKey) {
  if (!model.categories) return [];
  return CATEGORY_KEYS
    .map(k => model.categories[k]?.[metricKey])
    .filter(v => v !== null && v !== undefined);
}

function getScore(model) {
  if (state.metric === 'ks') {
    if (state.category === 'overall') {
      return getKsScore(model, state.sampleSize);
    }
    return model.categories?.[state.category]?.ks100 ?? null;
  }
  if (state.category === 'overall') {
    const vals = getCategoryMetricValues(model, state.metric);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  if (!model.categories?.[state.category]) return null;
  return model.categories[state.category][state.metric] ?? null;
}

function getSortLabel() {
  if (state.metric === 'ks') {
    if (state.category === 'overall') return `KS@${state.sampleSize}`;
    return `KS@100 (${capitalize(state.category)})`;
  }
  if (state.category === 'overall') return `${state.metric.toUpperCase()} (avg)`;
  return `${state.metric.toUpperCase()} (${capitalize(state.category)})`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function filterModels(data) {
  return data.models.filter(m => {
    if (state.search && !m.name.toLowerCase().includes(state.search.toLowerCase())) return false;
    if (getScore(m) === null && state.category !== 'overall') return false;
    return true;
  });
}

function sortModels(models, data) {
  const dir = state.sortDir === 'asc' ? 1 : -1;
  const metricDir = data.metrics[state.metric].direction;

  return [...models].sort((a, b) => {
    if (state.sortKey === 'name') return a.name.localeCompare(b.name) * dir;
    if (state.sortKey === 'rank') {
      const av = getScore(a);
      const bv = getScore(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const scoreDir = data.metrics[state.metric].direction === 'higher' ? -1 : 1;
      return (av - bv) * scoreDir;
    }

    const av = getScore(a);
    const bv = getScore(b);
    if (av === null && bv === null) return a.name.localeCompare(b.name);
    if (av === null) return 1;
    if (bv === null) return -1;
    const diff = av - bv;
    const scoreDir = metricDir === 'higher' ? -1 : 1;
    return diff * dir * scoreDir;
  });
}

function formatScore(val) {
  if (val === null || val === undefined) return '—';
  if (state.metric === 'ks') return `${val.toFixed(val === 100 ? 0 : 2)}%`;
  return val.toFixed(2);
}

function scoreIntensity(val, data) {
  if (val === null) return 0;
  const meta = data.metrics[state.metric];
  const max = state.metric === 'ks' ? 100 : meta.max;
  const norm = Math.min(val / max, 1);
  return meta.direction === 'higher' ? norm : 1 - Math.min(val / max, 1);
}

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function scoreColor(intensity) {
  if (isDarkTheme()) {
    const r = Math.round(28 + intensity * 50);
    const g = Math.round(36 + intensity * 60);
    const b = Math.round(48 + intensity * 40);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const r = Math.round(248 - intensity * 80);
  const g = Math.round(240 - intensity * 60);
  const b = Math.round(232 - intensity * 100);
  return `rgb(${r}, ${g}, ${b})`;
}

function renderKsProfile(model, data) {
  if (!model.ks) return '<span class="lb-no-profile">—</span>';

  const sizes = data.sampleSizes;
  const values = sizes.map(n => model.ks[String(n)] ?? 0);
  const w = 220;
  const h = 40;
  const pad = { l: 6, r: 6, t: 6, b: 16 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const gradId = `grad-${model.id.replace(/[^a-z0-9]/gi, '')}`;

  const coords = values.map((v, i) => ({
    x: pad.l + (i / (sizes.length - 1)) * innerW,
    y: pad.t + innerH - (v / 100) * innerH,
    v,
  }));

  const linePoints = coords.map(c => `${c.x},${c.y}`).join(' ');
  const areaPoints = `${pad.l},${pad.t + innerH} ${linePoints} ${pad.l + innerW},${pad.t + innerH}`;
  const last = coords[coords.length - 1];

  return `<div class="ks-profile" title="KS@N decay: ${values[0].toFixed(0)}% at N=1 → ${values[values.length - 1].toFixed(1)}% at N=100">
    <svg viewBox="0 0 ${w} ${h}" class="ks-profile-svg" aria-hidden="true">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00A6B8" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#00A6B8" stop-opacity="0.03"/>
        </linearGradient>
      </defs>
      <line x1="${pad.l}" y1="${pad.t + innerH}" x2="${pad.l + innerW}" y2="${pad.t + innerH}" stroke="#dde5f0" stroke-width="1"/>
      <polygon points="${areaPoints}" fill="url(#${gradId})"/>
      <polyline points="${linePoints}" fill="none" stroke="#00A6B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last.x}" cy="${last.y}" r="3.5" fill="#001F5B"/>
      <circle cx="${coords[0].x}" cy="${coords[0].y}" r="2.5" fill="#00A6B8"/>
    </svg>
    <span class="ks-profile-labels"><span>1</span><span>100</span></span>
  </div>`;
}

function renderCategoryBars(model) {
  if (!model.categories) return '<span class="lb-no-profile">—</span>';

  const metric = state.metric === 'ks' ? 'ks100' : state.metric;
  const values = CATEGORY_KEYS.map(k => model.categories[k]?.[metric] ?? null);
  if (values.every(v => v === null)) return '<span class="lb-no-profile">—</span>';

  const isLowerBetter = state.metric !== 'ks';
  const maxVal = isLowerBetter
    ? Math.max(...values.filter(v => v !== null), 0.01)
    : 100;

  const bars = values.map((v, i) => {
    if (v === null) return `<div class="cat-bar-item"><span class="cat-bar-label">${CATEGORY_SHORT[i]}</span><div class="cat-bar-track"></div></div>`;
    const pct = isLowerBetter ? Math.min((1 - v / maxVal) * 100, 100) : Math.min(v, 100);
    return `<div class="cat-bar-item" title="${CATEGORY_SHORT[i]}: ${state.metric === 'ks' ? v.toFixed(1) + '%' : v.toFixed(2)}">
      <span class="cat-bar-label">${CATEGORY_SHORT[i]}</span>
      <div class="cat-bar-track"><span class="cat-bar-fill" style="width:${pct}%"></span></div>
    </div>`;
  }).join('');

  return `<div class="cat-bars">${bars}</div>`;
}

function renderProfile(model, data) {
  if (state.metric === 'ks' && state.category === 'overall') {
    return renderKsProfile(model, data);
  }
  return renderCategoryBars(model);
}

function updateProfileHint(root) {
  const hint = root.querySelector('.leaderboard-hint');
  if (!hint) return;
  if (state.metric === 'ks' && state.category === 'overall') {
    hint.textContent = 'Profile: KS@N decay from N=1 → N=100';
  } else if (state.metric !== 'ks' && state.category === 'overall') {
    hint.textContent = 'Profile: per-category breakdown · Score column shows average';
  } else {
    hint.textContent = 'Profile: per-category breakdown (Code · Text · RW · Shuf)';
  }
}

function renderMiniLeaderboard(data) {
  const list = document.getElementById('mini-lb-list');
  if (!list) return;

  const top = [...data.models]
    .filter(m => getKsScore(m, 100) !== null)
    .sort((a, b) => getKsScore(b, 100) - getKsScore(a, 100))
    .slice(0, MINI_TOP_N);

  const maxScore = getKsScore(top[0], 100) || 100;

  list.innerHTML = top.map((model, i) => {
    const score = getKsScore(model, 100);
    const pct = (score / maxScore) * 100;
    const rank = i + 1;
    const rankClass = rank === 1 ? 'mini-rank-1' : rank === 2 ? 'mini-rank-2' : rank === 3 ? 'mini-rank-3' : '';
    const familyColor = FAMILY_COLORS[model.family] || '#888';

    return `<li class="mini-lb-item ${rankClass}">
      <span class="mini-lb-rank">${rank}</span>
      <div class="mini-lb-info">
        <div class="mini-lb-row">
          <span class="mini-lb-name"><span class="model-dot" style="background:${familyColor}"></span>${model.name}</span>
          <span class="mini-lb-score">${score.toFixed(2)}%</span>
        </div>
        <span class="mini-lb-bar-track"><span class="mini-lb-bar" style="width: ${pct}%"></span></span>
      </div>
    </li>`;
  }).join('');
}

async function initMiniLeaderboard() {
  try {
    const data = await loadLeaderboardData();
    renderMiniLeaderboard(data);
  } catch (err) {
    const list = document.getElementById('mini-lb-list');
    if (list) list.innerHTML = '<li class="mini-lb-error">Unable to load rankings</li>';
    console.error(err);
  }
}

function renderControls(root, data) {
  const controls = root.querySelector('.leaderboard-controls');
  if (!controls) return;

  const sampleSelect = controls.querySelector('#lb-sample');
  const categorySelect = controls.querySelector('#lb-category');

  data.sampleSizes.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = `N = ${n}`;
    if (n === 100) opt.selected = true;
    sampleSelect.appendChild(opt);
  });

  data.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.label;
    categorySelect.appendChild(opt);
  });

  updateControlVisibility(controls);
}

function updateControlVisibility(controls) {
  const sampleWrap = controls.querySelector('[data-control="sample"]');
  const categoryWrap = controls.querySelector('[data-control="category"]');
  const isKs = state.metric === 'ks';
  sampleWrap.hidden = !isKs || state.category !== 'overall';
  categoryWrap.hidden = isKs && state.sampleSize !== 100;
}

function renderTable(root, data) {
  const tbody = root.querySelector('#lb-tbody');
  const scoreHeader = root.querySelector('#lb-score-header');
  const countEl = root.querySelector('#lb-count');
  if (!tbody) return;

  const models = sortModels(filterModels(data), data);
  const ranked = models.filter(m => getScore(m) !== null);

  scoreHeader.textContent = getSortLabel();
  scoreHeader.dataset.sort = 'score';
  countEl.textContent = `${models.length} model${models.length !== 1 ? 's' : ''}`;
  updateProfileHint(root);

  tbody.innerHTML = models.map(model => {
    const score = getScore(model);
    const rank = score !== null ? ranked.indexOf(model) + 1 : '—';
    const intensity = scoreIntensity(score, data);
    const bg = score !== null ? scoreColor(intensity) : 'transparent';
    const rankClass = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : '';
    const familyColor = FAMILY_COLORS[model.family] || '#888';

    return `<tr>
      <td class="lb-rank ${rankClass}">${rank}</td>
      <td class="lb-model">
        <span class="lb-model-name">
          <span class="model-dot" style="background:${familyColor}" title="${model.family}"></span>
          ${model.name}
        </span>
      </td>
      <td class="lb-profile">${renderProfile(model, data)}</td>
      <td class="lb-score" style="background: ${bg}">
        <div class="score-cell">
          <span class="score-value">${formatScore(score)}</span>
          <span class="score-meter"><span class="score-meter-fill" style="width: ${intensity * 100}%"></span></span>
        </div>
      </td>
    </tr>`;
  }).join('');

  updateSortIndicators(root);
}

function updateSortIndicators(root) {
  root.querySelectorAll('[data-sort]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc', 'sort-active');
    if (th.dataset.sort === state.sortKey) {
      th.classList.add('sort-active', state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function bindEvents(root, data) {
  const controls = root.querySelector('.leaderboard-controls');

  controls.querySelector('#lb-metric').addEventListener('change', e => {
    state.metric = e.target.value;
    state.sortKey = 'score';
    state.sortDir = data.metrics[state.metric].direction === 'higher' ? 'desc' : 'asc';
    updateControlVisibility(controls);
    renderTable(root, data);
  });

  controls.querySelector('#lb-sample').addEventListener('change', e => {
    state.sampleSize = Number(e.target.value);
    updateControlVisibility(controls);
    renderTable(root, data);
  });

  controls.querySelector('#lb-category').addEventListener('change', e => {
    state.category = e.target.value;
    updateControlVisibility(controls);
    renderTable(root, data);
  });

  let searchTimer;
  controls.querySelector('#lb-search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      renderTable(root, data);
    }, 150);
  });

  root.querySelector('.leaderboard-table-wrap').addEventListener('click', e => {
    const th = e.target.closest('[data-sort]');
    if (!th) return;
    const key = th.dataset.sort;
    if (state.sortKey === key) {
      state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      state.sortKey = key;
      state.sortDir = key === 'name' ? 'asc' : 'desc';
    }
    renderTable(root, data);
  });
}

async function initFullLeaderboard() {
  const root = document.getElementById('leaderboard-full');
  if (!root) return;

  try {
    const data = await loadLeaderboardData();
    leaderboardRoot = root;
    leaderboardDataCache = data;
    renderControls(root, data);
    renderTable(root, data);
    bindEvents(root, data);
  } catch (err) {
    root.innerHTML = '<p class="leaderboard-error">Failed to load leaderboard data.</p>';
    console.error(err);
  }
}

let leaderboardRoot = null;
let leaderboardDataCache = null;

document.addEventListener('DOMContentLoaded', () => {
  initMiniLeaderboard();
  initFullLeaderboard();
});

document.addEventListener('themechange', () => {
  if (leaderboardRoot && leaderboardDataCache) {
    renderTable(leaderboardRoot, leaderboardDataCache);
  }
});
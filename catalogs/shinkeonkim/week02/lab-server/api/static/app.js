/* 실험 서버 UI
 *
 * 실험은 오래 걸릴 수 있으므로 여기서 기다리지 않는다.
 *   POST /api/runs -> id 를 받고 즉시 폴링으로 넘어간다.
 * 폴링은 done/failed/canceled 가 되면 멈춘다.
 */
'use strict';

const $ = (s) => document.querySelector(s);
const nf = (n) => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('ko-KR');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let META = null, chart = null, poll = null, watching = null;

/* ---------------------------------------------------------------- 폼 만들기 */
function chips(host, items, checkedKeys) {
  host.innerHTML = items.map((it) => `
    <label class="chip${checkedKeys.includes(it.key) ? ' on' : ''}" title="${esc(it.note || '')}">
      <input type="checkbox" value="${esc(it.key)}"${checkedKeys.includes(it.key) ? ' checked' : ''}>
      ${esc(it.label)}
    </label>`).join('');
  host.querySelectorAll('input').forEach((i) =>
    i.addEventListener('change', () => {
      i.closest('.chip').classList.toggle('on', i.checked);
      updatePlan();
    }));
}
const picked = (id) => [...document.querySelectorAll(`#${id} input:checked`)].map((i) => i.value);

function updatePlan() {
  const n = picked('versions').length * picked('engines').length * picked('patterns').length;
  $('#plan').textContent = n ? `${n}칸을 잽니다 (버전 ${picked('versions').length} × 엔진 ${picked('engines').length} × 패턴 ${picked('patterns').length})`
                             : '버전·엔진·패턴을 하나 이상 고르세요';
  $('#go').disabled = n === 0;
}

async function boot() {
  META = await (await fetch('/api/meta')).json();
  $('#envline').textContent =
    `PostgreSQL ${META.versions.join(' / ')} · 말뭉치 ${META.corpus} · ${META.note}`;
  $('#rows').innerHTML = META.row_choices
    .map((n) => `<option value="${n}"${n === 100000 ? ' selected' : ''}>${nf(n)}행</option>`).join('');
  chips($('#versions'), META.versions.map((v) => ({ key: v, label: 'PG ' + v })), [META.versions[0]]);
  chips($('#engines'), META.engines, ['none', 'bigm', 'trgm']);
  chips($('#patterns'), META.patterns, ['infix', 'prefix', 'suffix']);
  updatePlan();
  refreshRuns();
}

/* ---------------------------------------------------------------- 제출 */
$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#formerr').hidden = true;
  const f = e.target;
  const body = {
    keyword: f.keyword.value.trim(),
    rows: +f.rows.value,
    inject_mod: +f.inject_mod.value,
    versions: picked('versions'),
    engines: picked('engines'),
    patterns: picked('patterns'),
  };
  $('#go').disabled = true;
  try {
    const r = await fetch('/api/runs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail));
    watch(j.id);
    refreshRuns();
  } catch (err) {
    $('#formerr').textContent = '시작하지 못했습니다: ' + err.message;
    $('#formerr').hidden = false;
  } finally {
    $('#go').disabled = false;
  }
});

/* ---------------------------------------------------------------- 폴링 */
function watch(id) {
  watching = id;
  $('#current').hidden = false;
  $('#curid').textContent = '#' + id;
  $('#resultwrap').hidden = true;
  $('#curerror').hidden = true;
  $('#barfill').style.width = '0';
  $('#curprogress').textContent = '큐에서 차례를 기다리는 중…';
  if (poll) clearInterval(poll);
  tick();
  poll = setInterval(tick, 1200);
}

async function tick() {
  if (watching == null) return;
  const r = await fetch('/api/runs/' + watching);
  if (!r.ok) return;
  const run = await r.json();
  $('#curstatus').textContent = run.status;
  $('#curstatus').className = 'pill ' + run.status;

  if (run.progress) {
    $('#curprogress').textContent = run.progress + (run.elapsed ? ` · ${run.elapsed}초 경과` : '');
    const m = /^(\d+)\/(\d+)/.exec(run.progress);
    if (m) $('#barfill').style.width = (100 * +m[1] / +m[2]) + '%';
  }

  if (['done', 'failed', 'canceled'].includes(run.status)) {
    clearInterval(poll); poll = null;
    $('#barfill').style.width = '100%';
    $('#curprogress').textContent = run.elapsed ? `${run.elapsed}초 걸렸습니다` : '';
    if (run.error) { $('#curerror').textContent = run.error; $('#curerror').hidden = false; }
    if (run.result) render(run);
    refreshRuns();
  }
}

/* ---------------------------------------------------------------- 결과 */
function render(run) {
  const rows = run.result;
  $('#resultwrap').hidden = false;
  const p = run.params;
  const label = (r) => `PG${r.version} ${r.engine === 'none' ? '무인덱스' : r.engine} ${r.pattern_label}`;

  document.querySelector('#rtable tbody').innerHTML = rows.map((r, i) => {
    // '인덱스가 테이블 전체를 후보로 올렸다' = GIN_SEARCH_MODE_ALL 의 지문
    const blown = r.idx_rows !== null && r.idx_rows >= r.rows * 0.9;
    const clean = r.idx_rows !== null && r.idx_rows === r.answer && r.recheck === 0;
    return `<tr class="${blown ? 'bad' : clean ? 'good' : ''}">
      <td>${r.version}</td><td>${r.engine === 'none' ? '무인덱스' : esc(r.engine)}</td>
      <td><code>${esc(r.pattern_label)}</code></td>
      <td class="num">${nf(r.answer)}<br><small class="muted">${r.selectivity}%</small></td>
      <td class="num">${nf(r.idx_rows)}${blown ? '<br><small class="muted">= 테이블 전체</small>' : ''}</td>
      <td class="num">${nf(r.recheck)}</td>
      <td class="num">${nf(r.buffers)}</td>
      <td class="num">${r.ms === null ? '—' : r.ms + ' ms'}</td>
      <td><small>${esc(r.plan_kind)}</small>${
        r.index_ok ? '' : `<br><small class="warnmark">⚠ ${esc(r.index_used || '인덱스 미사용')}</small>`}</td>
      <td><button class="ghost" data-plan="${i}">플랜</button></td>
    </tr>`;
  }).join('');

  document.querySelectorAll('#rtable button[data-plan]').forEach((b) =>
    b.addEventListener('click', () => {
      const tr = b.closest('tr');
      const next = tr.nextElementSibling;
      if (next && next.classList.contains('planrow')) { next.remove(); return; }
      const r = rows[+b.dataset.plan];
      tr.insertAdjacentHTML('afterend',
        `<tr class="planrow"><td colspan="10"><pre>${esc(r.plan)}</pre></td></tr>`);
    }));

  const cs = getComputedStyle(document.documentElement);
  const C = (n) => cs.getPropertyValue(n).trim();
  if (chart) chart.destroy();
  chart = new Chart($('#chart'), {
    type: 'bar',
    data: {
      labels: rows.map(label),
      datasets: [{
        label: '실행 시간 (ms)',
        data: rows.map((r) => r.ms),
        backgroundColor: rows.map((r) =>
          r.engine === 'none' ? C('--muted') : r.engine === 'bigm' ? C('--bigm') : C('--trgm')),
      }],
    },
    options: {
      maintainAspectRatio: false, indexAxis: 'y',
      scales: { x: { type: 'logarithmic', title: { display: true, text: 'ms (로그)' } } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => {
          const r = rows[c.dataIndex];
          return `${r.ms} ms · 후보 ${nf(r.idx_rows)}행 · Recheck ${nf(r.recheck)} · 버퍼 ${nf(r.buffers)}`;
        } } },
      },
    },
  });

  const wrongIdx = rows.filter((r) => !r.index_ok);
  const worst = rows.filter((r) => r.idx_rows !== null && r.idx_rows >= r.rows * 0.9);
  const best = rows.filter((r) => r.idx_rows !== null && r.idx_rows === r.answer && r.recheck === 0);
  $('#chartcap').innerHTML =
    `검색어 <code>${esc(p.keyword)}</code>(${[...p.keyword].length}글자) · ${nf(rows[0].rows)}행 · ` +
    `정답 ${nf(rows[0].answer)}행(${rows[0].selectivity}%) · 로그 스케일`;
  $('#reading').innerHTML = wrongIdx.length
    ? `<strong>⚠ 의도한 인덱스를 안 탄 칸이 ${wrongIdx.length}개 있습니다.</strong>
       이 값은 비교에 쓸 수 없습니다 — 플랜의 <code>Index Scan on</code> 을 확인하세요.`
    : worst.length
    ? `<strong>빨간 줄</strong>은 인덱스가 <strong>테이블 전체를 후보로 올린 칸</strong>입니다 —
       조각을 하나도 못 만들어 <code>GIN_SEARCH_MODE_ALL</code> 로 떨어진 상태이고,
       <strong>인덱스가 없느니만 못합니다.</strong> 검색어를 한 글자 늘리거나 패턴을
       <code>검색어%</code> 로 바꾸면 사라집니다.`
    : (best.length
        ? `모든 칸에서 인덱스가 후보를 정답까지 좁혔습니다(초록). <strong>검색어를 2글자로 줄여
           <code>pg_trgm</code> 이 무너지는 걸 보세요.</strong>`
        : `후보가 정답보다 많은 칸은 <strong>Recheck 이 그 차이를 힙에서 걸러냈다</strong>는 뜻입니다.`);
}

/* ---------------------------------------------------------------- 목록 */
async function refreshRuns() {
  const { runs } = await (await fetch('/api/runs?limit=25')).json();
  document.querySelector('#runs tbody').innerHTML = runs.map((r) => {
    const p = r.params;
    const cond = `<code>${esc(p.keyword)}</code> · ${nf(p.rows)}행 · PG ${p.versions.join('/')} · ` +
                 `${p.engines.join('/')} · ${p.patterns.length}패턴`;
    return `<tr>
      <td>#${r.id}</td>
      <td><span class="pill ${r.status}">${r.status}</span>${r.progress ? `<br><small class="muted">${esc(r.progress)}</small>` : ''}</td>
      <td>${cond}</td>
      <td class="num">${r.elapsed ? r.elapsed + '초' : '—'}</td>
      <td>
        <button class="ghost" data-open="${r.id}">보기</button>
        ${r.status === 'pending' ? `<button class="ghost" data-cancel="${r.id}">취소</button>` : ''}
      </td></tr>`;
  }).join('');
  document.querySelectorAll('#runs button[data-open]').forEach((b) =>
    b.addEventListener('click', () => watch(+b.dataset.open)));
  document.querySelectorAll('#runs button[data-cancel]').forEach((b) =>
    b.addEventListener('click', async () => {
      await fetch(`/api/runs/${b.dataset.cancel}/cancel`, { method: 'POST' });
      refreshRuns();
    }));
}

setInterval(() => { if (!poll) refreshRuns(); }, 5000);
boot();

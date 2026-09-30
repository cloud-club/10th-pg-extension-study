---
marp: true
html: true
theme: default
size: 16:9
paginate: true
style: |
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
  :root {
    --paper: #f4f0e8;
    --ink: #15161a;
    --muted: #4b5154;
    --rule: #847f77;
    --pg: #005a9c;
    --pg-on-dark: #6db8ff;
    --pg-soft: #dceaf6;
    --my: #944800;
    --my-on-dark: #ffb45c;
    --my-soft: #ffead0;
    --acid: #d9ff42;
    --red: #c9352b;
    --red-on-dark: #ff746e;
    --white: #fffdf8;
  }
  section {
    background: var(--paper);
    color: var(--ink);
    font-family: "Pretendard", "Pretendard Variable", -apple-system, BlinkMacSystemFont,
      "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    font-size: 26px;
    line-height: 1.34;
    padding: 54px 70px 48px;
    letter-spacing: -0.022em;
  }
  section::after {
    color: var(--muted);
    font-size: 14px;
    font-weight: 700;
    right: 36px;
    bottom: 22px;
  }
  h1, h2, h3, p { margin-top: 0; }
  h1 { font-size: 72px; line-height: 1.02; letter-spacing: -0.055em; }
  h2 { font-size: 42px; line-height: 1.08; letter-spacing: -0.045em; margin-bottom: 24px; }
  h3 { font-size: 23px; margin-bottom: 8px; }
  strong { color: inherit; }
  code {
    font-family: "SFMono-Regular", "D2Coding", Menlo, monospace;
    background: rgba(21,22,26,.07);
    color: inherit;
    padding: 1px 5px;
    border-radius: 3px;
  }
  a { color: inherit; text-decoration-color: rgba(21,22,26,.35); }
  .eyebrow {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: .16em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 16px;
  }
  .big { font-size: 48px; line-height: 1.14; font-weight: 850; letter-spacing: -0.05em; }
  .huge { font-size: 82px; line-height: .98; font-weight: 900; letter-spacing: -0.065em; }
  .sub { font-size: 21px; color: #565956; }
  .cite {
    position: absolute;
    left: 70px;
    bottom: 22px;
    color: var(--muted);
    font-size: 13px;
    letter-spacing: 0;
  }
  .cite a { text-decoration: none; }
  .rule { height: 1px; background: var(--rule); margin: 20px 0; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .split-rule > * + * { border-left: 1px solid var(--rule); padding-left: 30px; }
  .label {
    display: inline-block;
    padding: 4px 9px;
    border: 2px solid currentColor;
    font-size: 13px;
    font-weight: 850;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .pg-text { color: var(--pg); }
  .my-text { color: var(--my); }
  .accent { background: var(--acid); color: var(--ink); padding: 0 .1em; }
  section.dark,
  section[data-class~="dark"] { background: var(--ink); color: var(--white); }
  section.dark .eyebrow,
  section.dark .sub,
  section.dark .cite,
  section.dark::after,
  section[data-class~="dark"] .eyebrow,
  section[data-class~="dark"] .sub,
  section[data-class~="dark"] .cite,
  section[data-class~="dark"]::after { color: #c2c5c0; }
  section.dark code,
  section[data-class~="dark"] code { background: rgba(255,255,255,.12); }
  section.dark .pg-text,
  section[data-class~="dark"] .pg-text { color: var(--pg-on-dark); }
  section.dark .my-text,
  section[data-class~="dark"] .my-text { color: var(--my-on-dark); }
  section.dark .horizon .past,
  section[data-class~="dark"] .horizon .past { background: var(--red-on-dark); }
  section.dark .horizon .reader,
  section[data-class~="dark"] .horizon .reader { color: var(--red-on-dark); }
  section.pg-slide,
  section[data-class~="pg-slide"] { background: #e8f1f8; }
  section.mysql-slide,
  section[data-class~="mysql-slide"] { background: #fff0dc; }
  .section-mark {
    position: absolute;
    right: 10px;
    top: 80px;
    font-size: 210px;
    line-height: .8;
    font-weight: 950;
    opacity: .09;
    letter-spacing: -.08em;
  }
  .statement {
    border-top: 3px solid var(--ink);
    padding-top: 18px;
    font-size: 37px;
    font-weight: 800;
    line-height: 1.18;
    word-break: keep-all;
  }
  .lane {
    display: grid;
    grid-template-columns: 120px 1fr;
    border-top: 1px solid var(--rule);
    padding: 13px 0;
    align-items: center;
  }
  .lane:last-child { border-bottom: 1px solid var(--rule); }
  .lane-name { font-weight: 850; font-size: 18px; }
  .events { display: flex; align-items: center; gap: 8px; }
  .event { padding: 8px 12px; background: var(--white); border: 1px solid var(--ink); font-size: 19px; }
  .arrow { color: var(--muted); font-weight: 800; }
  .value { font-size: 39px; font-weight: 900; }
  .snapshot {
    border: 2px solid var(--ink);
    padding: 22px 26px;
    background: var(--white);
    min-height: 200px;
  }
  .snapshot .line { display: flex; justify-content: space-between; border-bottom: 1px solid var(--rule); padding: 10px 0; }
  .snapshot .line:last-child { border: 0; }
  .role {
    min-height: 230px;
    border-top: 6px solid var(--ink);
    padding: 18px 4px 0;
  }
  .role b { font-size: 36px; display: block; margin-bottom: 12px; }
  .heap {
    border: 2px solid var(--pg);
    padding: 14px;
    background: rgba(255,255,255,.62);
  }
  .tuple {
    display: grid;
    grid-template-columns: 150px 1fr 180px;
    align-items: center;
    border: 1px solid var(--ink);
    background: var(--white);
    margin: 10px 0;
    padding: 15px 18px;
  }
  .tuple.old { opacity: .68; border-style: dashed; }
  .meta { font-family: "SFMono-Regular", Menlo, monospace; font-size: 17px; }
  .hot-chain { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 42px; }
  .node { width: 190px; padding: 20px 12px; border: 2px solid var(--ink); background: var(--white); text-align: center; }
  .node.pg { border-color: var(--pg); }
  .node.my { border-color: var(--my); }
  .pin { color: var(--red); font-weight: 900; }
  .vacuum-job { border-top: 6px solid var(--pg); padding-top: 15px; }
  .vacuum-job .num { font-size: 62px; line-height: 1; color: var(--pg); font-weight: 950; }
  .vs {
    width: 70px; height: 70px; border-radius: 50%;
    display: grid; place-items: center; background: var(--ink); color: var(--white);
    font-weight: 900; position: absolute; left: calc(50% - 35px); top: 310px;
  }
  .rebuild {
    height: 16px; background: repeating-linear-gradient(90deg,var(--pg),var(--pg) 16px,transparent 16px,transparent 24px);
    margin: 20px 0;
  }
  .record {
    border: 2px solid var(--my); background: var(--white); padding: 18px 22px;
  }
  .undo {
    border: 1px dashed var(--ink); background: #fff9ef; padding: 14px 18px;
  }
  .undo-chain { display: grid; grid-template-columns: 1.15fr 70px 1fr; align-items: center; margin-top: 28px; }
  .pipeline { display: grid; grid-template-columns: repeat(5,1fr); align-items: stretch; gap: 0; margin-top: 36px; }
  .stage { border: 1px solid var(--ink); padding: 20px 14px; background: var(--white); min-height: 150px; }
  .stage + .stage { border-left: 0; }
  .horizon { height: 8px; background: var(--rule); position: relative; margin: 55px 0 32px; }
  .horizon .past { position: absolute; left: 0; width: 62%; height: 8px; background: var(--red); }
  .horizon .reader { position: absolute; left: 58%; top: -45px; font-size: 18px; font-weight: 850; color: var(--red); }
  .horizon .clean { position: absolute; left: 64%; top: 18px; font-size: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 21px; }
  th { text-align: left; border-bottom: 2px solid var(--ink); padding: 9px 10px; }
  td { border-bottom: 1px solid var(--rule); padding: 9px 10px; }
  .not-equal { font-size: 33px; font-weight: 900; border-top: 1px solid var(--rule); padding: 15px 0; }
  .source-list { font-size: 18px; line-height: 1.35; }
  .source-list li { margin-bottom: 8px; }
  .source-list a { text-decoration: none; }
  .closing {
    display: grid;
    grid-template-columns: 1.15fr .85fr;
    gap: 55px;
    align-items: end;
  }
  .question-mark { font-size: 230px; line-height: .7; color: var(--acid); font-weight: 950; text-align: right; }
---

<!-- _class: dark -->
<!-- _paginate: false -->

<div class="eyebrow">PG Extension Study · Week 3</div>

# 같은 MVCC,<br><span style="color:var(--acid)">다른 버전 관리</span>

<div class="rule" style="background:#747980"></div>

<div class="grid2 split-rule">
<div>

<span class="label pg-text">PostgreSQL</span>

**Heap tuple → VACUUM**

</div>
<div>

<span class="label" style="color:var(--my-on-dark)">MySQL InnoDB</span>

**Undo chain → Purge**

</div>
</div>

<p class="sub" style="margin-top:34px">신웅비 · 2026</p>

---

<div class="eyebrow">00 · Answer first</div>

## 정답부터: 목적은 같고, “과거”의 주소가 다르다

<div class="grid2 split-rule" style="margin-top:45px">
<div>
<span class="label pg-text">PostgreSQL</span>
<p class="big" style="margin-top:18px">이전 행도<br><span class="pg-text">heap tuple</span>로 남긴다</p>
<p class="sub">아무도 보지 않게 되면 VACUUM이 회수한다.</p>
</div>
<div>
<span class="label" style="color:var(--my)">InnoDB</span>
<p class="big" style="margin-top:18px">현재 record에서<br><span class="my-text">Undo</span>로 되감는다</p>
<p class="sub">과거가 불필요해지면 Purge가 처리한다.</p>
</div>
</div>

<div class="cite">PostgreSQL [3][4] · MySQL [6][9]</div>

---

<!-- _class: dark -->

<div class="eyebrow">01 · Why MVCC</div>

## 한 칸뿐인 세계에서는 누군가 기다려야 한다

<div class="grid2 split-rule" style="margin-top:35px">
<div>
<p class="label" style="color:#ff7878">LOCK-ONLY WORLD</p>
<p class="huge" style="font-size:64px;margin:25px 0">READ<br>↕<br>WRITE</p>
<p class="sub">같은 값을 둘이 만지면 한쪽이 잠금 뒤에서 대기한다.</p>
</div>
<div>
<p class="label" style="color:var(--acid)">MULTI-VERSION WORLD</p>
<p class="huge" style="font-size:64px;margin:25px 0">100<br>＋<br>200</p>
<p class="sub">버전을 함께 두고, reader마다 볼 값을 고른다.</p>
</div>
</div>

<div class="cite">MVCC에서 일반 읽기와 쓰기의 비충돌: PostgreSQL [1], InnoDB [7]</div>

---

<div class="eyebrow">02 · One running example</div>

## `100 → 200`, 그런데 T1은 계속 `100`을 본다

<div class="lane">
  <div class="lane-name">T1 · Reader</div>
  <div class="events"><span class="event">BEGIN RR</span><span class="arrow">→</span><span class="event">SELECT <b>100</b></span><span class="arrow">────────────→</span><span class="event">SELECT <b>100</b></span><span class="arrow">→</span><span class="event">COMMIT</span></div>
</div>
<div class="lane">
  <div class="lane-name">T2 · Writer</div>
  <div class="events"><span style="width:245px"></span><span class="event">UPDATE <b>200</b></span><span class="arrow">→</span><span class="event">COMMIT</span></div>
</div>
<div class="lane">
  <div class="lane-name">New reader</div>
  <div class="events"><span style="width:575px"></span><span class="event">SELECT <b>200</b></span></div>
</div>

<p class="statement" style="margin-top:30px">핵심은 `200`이 현재가 된 뒤에도 <span class="accent">T1을 위해 `100`을 보존</span>해야 한다는 것.</p>

<div class="cite">양쪽 모두 REPEATABLE READ로 고정한 비교 예제 [2][7]</div>

---

<div class="eyebrow">03 · Snapshot</div>

## Snapshot은 복사본이 아니라 “입장 명단”이다

<div class="grid2 split-rule">
<div>
<p class="big">데이터를 통째로<br>복사하지 않는다</p>
<p class="sub">행마다 존재하는 버전과 트랜잭션 정보를 그대로 둔다.</p>
</div>
<div class="snapshot">
  <div class="line"><b>T0의 변경</b><span style="color:#23835c;font-weight:850">VISIBLE</span></div>
  <div class="line"><b>T1 자신의 변경</b><span style="color:#23835c;font-weight:850">VISIBLE</span></div>
  <div class="line"><b>T2의 뒤늦은 변경</b><span style="color:var(--red);font-weight:850">INVISIBLE</span></div>
</div>
</div>

<p class="statement" style="margin-top:28px">Snapshot + 버전 메타데이터 → “이 reader가 볼 한 버전”</p>

<div class="cite">PostgreSQL snapshot [1][2] · InnoDB consistent read [7]</div>

---

<div class="eyebrow">04 · The shared contract</div>

## 구현을 보기 전에 네 역할만 기억하자

<div class="grid4" style="margin-top:35px">
<div class="role"><span class="label">NOW</span><b>현재</b><p class="sub">지금 커밋된 값은 어디에 있는가?</p></div>
<div class="role"><span class="label">PAST</span><b>과거</b><p class="sub">이전 값은 어디에 남는가?</p></div>
<div class="role"><span class="label">JUDGE</span><b>판정</b><p class="sub">누가 어떤 버전을 볼 수 있는가?</p></div>
<div class="role"><span class="label">CLEANER</span><b>수거</b><p class="sub">아무도 안 보는 버전을 누가 치우는가?</p></div>
</div>

<p class="statement" style="margin-top:30px">두 엔진의 차이는 주로 <span class="accent">PAST와 CLEANER</span>에서 드러난다.</p>

---

<!-- _class: pg-slide -->

<div class="eyebrow pg-text">PART A · PostgreSQL</div>

<p class="huge" style="margin-top:75px">과거도<br><span class="pg-text">heap 안</span>에 있다</p>

<p class="big" style="margin-top:38px">새 tuple version → dead tuple → VACUUM</p>

<div class="section-mark pg-text">PG</div>

---

<!-- _class: pg-slide -->

<div class="eyebrow pg-text">05 · PostgreSQL heap</div>

## UPDATE는 같은 논리 행의 새 물리 버전을 만든다

<div class="heap">
  <div class="tuple old"><b>tuple A · 100</b><span class="meta">xmin=T0 · xmax=T2</span><span class="meta">ctid → tuple B</span></div>
  <div class="tuple"><b>tuple B · 200</b><span class="meta">xmin=T2 · xmax=0</span><span class="meta">current</span></div>
</div>

<div class="grid2 split-rule" style="margin-top:26px">
<div><b>T1 snapshot</b><br><span class="value pg-text">100</span></div>
<div><b>새 transaction</b><br><span class="value pg-text">200</span></div>
</div>

<div class="cite">row version과 xmin/xmax [3] · HeapTupleHeaderData [11]</div>

---

<!-- _class: pg-slide -->

<div class="eyebrow pg-text">06 · HOT</div>

## HOT도 “덮어쓰기”는 아니다

<div class="hot-chain">
  <div class="node"><span class="label">INDEX</span><p style="margin:18px 0 0"><b>page item</b></p></div>
  <span class="arrow">→</span>
  <div class="node pg"><span class="label pg-text">ROOT</span><p style="margin:18px 0 0"><b>v1 · 100</b></p></div>
  <span class="arrow">→</span>
  <div class="node pg"><span class="label pg-text">HOT</span><p style="margin:18px 0 0"><b>v2 · 200</b></p></div>
</div>

<div class="grid2 split-rule" style="margin-top:50px">
<div><p class="big pg-text">새 heap tuple은 생성</p></div>
<div><p class="big">새 index entry는 생략 가능</p></div>
</div>

<div class="cite">HOT 조건과 최적화 [5]</div>

---

<!-- _class: pg-slide -->

<div class="eyebrow pg-text">07 · Dead, not removable yet</div>

## “현재가 아님”과 “지워도 됨”은 다르다

<div class="grid2 split-rule" style="margin-top:30px">
<div>
<span class="label">T2 COMMITTED</span>
<p class="huge pg-text" style="font-size:92px;margin:30px 0 8px">200</p>
<p class="sub">논리적으로 현재인 값</p>
</div>
<div>
<span class="label" style="color:var(--red)">T1 STILL OPEN</span>
<p class="huge" style="font-size:92px;margin:30px 0 8px">100</p>
<p class="pin">T1의 snapshot이 붙잡고 있음</p>
</div>
</div>

<p class="statement" style="margin-top:30px">이전 tuple은 <span class="accent">어떤 snapshot에도 필요 없을 때</span> 비로소 회수 가능하다.</p>

<div class="cite">이전 row version을 즉시 제거하지 않는 이유 [4]</div>

---

<!-- _class: pg-slide -->

<div class="eyebrow pg-text">08 · Why VACUUM</div>

## VACUUM은 단순한 “쓰레기 삭제”보다 일이 많다

<div class="grid3" style="margin-top:30px">
<div class="vacuum-job"><div class="num">01</div><h3>REUSE</h3><p>dead tuple과 index 공간을 다시 쓸 수 있게 한다.</p></div>
<div class="vacuum-job"><div class="num">02</div><h3>VISIBILITY</h3><p>Visibility Map을 갱신해 다음 vacuum과 index-only scan을 돕는다.</p></div>
<div class="vacuum-job"><div class="num">03</div><h3>FREEZE</h3><p>오래된 XID를 freeze해 wraparound를 막는다.</p></div>
</div>

<p class="statement" style="margin-top:28px">그래서 PostgreSQL에서 VACUUM은 선택적 기능이 아니라<br><span class="accent">지속 운영을 위한 필수 작업</span>이다.</p>

<div class="cite">Routine Vacuuming [4]</div>

---

<!-- _class: pg-slide -->

<div class="eyebrow pg-text">09 · VACUUM ≠ VACUUM FULL</div>

## 재사용과 파일 축소를 분리해서 보자

<div class="grid2 split-rule" style="margin-top:30px">
<div>
<span class="label pg-text">VACUUM</span>
<p class="big" style="margin:22px 0">빈칸에<br>“다시 써도 됨” 표시</p>
<div class="rebuild"></div>
<p class="sub">일반 DML과 병행 · 파일 크기는 보통 유지</p>
</div>
<div>
<span class="label" style="color:var(--red)">VACUUM FULL</span>
<p class="big" style="margin:22px 0">살아 있는 행으로<br>파일 전체 재작성</p>
<div class="rebuild" style="background:var(--red);width:58%"></div>
<p class="sub">ACCESS EXCLUSIVE · 새 복사본 공간 필요</p>
</div>
</div>

<div class="vs">≠</div>
<div class="cite">표준 VACUUM과 VACUUM FULL [4]</div>

---

<!-- _class: mysql-slide -->

<div class="eyebrow my-text">PART B · MySQL InnoDB</div>

<p class="huge" style="margin-top:75px">현재 record에서<br><span class="my-text">Undo로 되감는다</span></p>

<p class="big" style="margin-top:38px">Read View → Roll Pointer → Purge</p>

<div class="section-mark my-text">INNO</div>

---

<!-- _class: mysql-slide -->

<div class="eyebrow my-text">10 · Current + history</div>

## 현재는 clustered index, 과거는 Undo로 재구성

<div class="undo-chain">
<div class="record">
<span class="label" style="color:var(--my)">CURRENT RECORD</span>
<p class="big" style="margin:18px 0 8px">balance = <span class="my-text">200</span></p>
<p class="meta">DB_TRX_ID = T2</p>
<p class="meta">DB_ROLL_PTR = →</p>
</div>
<div class="arrow" style="font-size:45px;text-align:center">→</div>
<div class="undo">
<span class="label">UPDATE UNDO</span>
<p class="big" style="margin:18px 0 8px">balance = 100</p>
<p class="sub">업데이트 전 내용을 재구성할 정보</p>
</div>
</div>

<div class="cite">clustered index [12] · hidden fields와 Undo [6]</div>

---

<!-- _class: mysql-slide -->

<div class="eyebrow my-text">11 · Consistent read</div>

## Read View가 “너무 새로운 record”를 만나면

<div class="pipeline">
<div class="stage"><span class="label">1 · READ</span><p style="margin-top:20px"><b>현재 record<br>200</b></p></div>
<div class="stage"><span class="label">2 · CHECK</span><p style="margin-top:20px"><b>DB_TRX_ID<br>= T2</b></p></div>
<div class="stage" style="background:var(--my-soft)"><span class="label">3 · VIEW</span><p style="margin-top:20px"><b>T2는<br>안 보임</b></p></div>
<div class="stage"><span class="label">4 · ROLL</span><p style="margin-top:20px"><b>Undo를<br>따라감</b></p></div>
<div class="stage" style="background:var(--acid)"><span class="label">5 · RETURN</span><p style="margin-top:20px"><b>100</b></p></div>
</div>

<p class="statement" style="margin-top:35px">Undo는 rollback뿐 아니라 <span class="accent">consistent read의 과거 버전 재구성</span>에도 쓰인다.</p>

<div class="cite">InnoDB Multi-Versioning [6] · Undo Logs [8] · Consistent Read [7]</div>

---

<!-- _class: mysql-slide -->

<div class="eyebrow my-text">12 · Purge</div>

## 아무도 과거를 요구하지 않을 때 history를 비운다

<div class="pipeline">
<div class="stage"><span class="label">DML</span><p style="margin-top:20px"><b>UPDATE<br>DELETE</b></p></div>
<div class="stage"><span class="label">HISTORY</span><p style="margin-top:20px"><b>Undo record<br>delete-mark</b></p></div>
<div class="stage" style="background:#ffe4df"><span class="label">WAIT</span><p style="margin-top:20px"><b>오래된 Read View가<br>필요한가?</b></p></div>
<div class="stage" style="background:var(--my-soft)"><span class="label">PURGE</span><p style="margin-top:20px"><b>history list<br>처리</b></p></div>
<div class="stage" style="background:var(--acid)"><span class="label">FREE</span><p style="margin-top:20px"><b>history에서<br>해제·재사용</b></p></div>
</div>

<p class="statement" style="margin-top:35px">Purge는 VACUUM과 비슷한 수거 역할을 하지만 <span class="accent">같은 명령도, 같은 대상도 아니다.</span></p>

<div class="cite">Purge Configuration [9]</div>

---

<!-- _class: dark -->

<div class="eyebrow">13 · The shared failure mode</div>

## 오래 열린 트랜잭션은 청소선(horizon)을 붙잡는다

<div class="horizon">
  <div class="past"></div>
  <div class="reader">OLD READER · 아직 100이 필요</div>
  <div class="clean">이 오른쪽만 안전하게 회수 가능 →</div>
</div>

<div class="grid2 split-rule" style="margin-top:65px">
<div><span class="label" style="color:#6db8ff">PostgreSQL</span><p class="big" style="margin:20px 0">dead tuple 회수 지연</p><p class="sub">bloat · vacuum 부담</p></div>
<div><span class="label" style="color:var(--my-on-dark)">InnoDB</span><p class="big" style="margin:20px 0">update Undo 회수 지연</p><p class="sub">history list · undo tablespace 성장</p></div>
</div>

<div class="cite">PostgreSQL [4] · InnoDB 장기 consistent read 경고 [6]</div>

---

<div class="eyebrow">14 · Separate axis</div>

## 저장 위치와 snapshot 수명은 다른 문제다

<div class="grid2 split-rule" style="margin-top:35px">
<div>
<span class="label pg-text">POSTGRESQL DEFAULT</span>
<p class="big" style="margin:22px 0">READ COMMITTED</p>
<p>각 SQL 문이 시작할 때 새로운 snapshot</p>
<p class="sub">두 번째 SELECT는 T2의 커밋을 보고 200이 될 수 있다.</p>
</div>
<div>
<span class="label" style="color:var(--my)">INNODB DEFAULT</span>
<p class="big" style="margin:22px 0">REPEATABLE READ</p>
<p>첫 consistent read의 snapshot을 재사용</p>
<p class="sub">두 번째 consistent SELECT도 100을 본다.</p>
</div>
</div>

<p class="statement" style="margin-top:32px">그래서 앞의 비교 예제는 <span class="accent">양쪽 모두 REPEATABLE READ</span>로 맞췄다.</p>

<div class="cite">PostgreSQL isolation [2] · InnoDB consistent read/isolation [7][10]</div>

---

<div class="eyebrow">15 · Side by side</div>

## 같은 계약, 다른 창고와 수거자

<table>
<thead><tr><th>질문</th><th class="pg-text">PostgreSQL</th><th class="my-text">MySQL InnoDB</th></tr></thead>
<tbody>
<tr><td>현재·과거 row</td><td>최신·이전 heap tuple</td><td>clustered record + Undo 재구성</td></tr>
<tr><td>가시성 판정</td><td><code>xmin/xmax</code> + Snapshot</td><td><code>TRX_ID/ROLL_PTR</code> + Read View</td></tr>
<tr><td>정리 방식</td><td>VACUUM / autovacuum</td><td>background Purge</td></tr>
<tr><td>추가 유지 관리</td><td>Visibility Map · XID freeze</td><td>Undo 기반 rollback</td></tr>
</tbody>
</table>

<div class="cite">PostgreSQL [3][4][11] · InnoDB [6][8][9][12]</div>

---

<!-- _class: dark -->

<div class="eyebrow">16 · Do not collapse these</div>

## 닮았다고 같은 것은 아니다

<div class="not-equal"><span style="color:#6db8ff">MySQL</span> ≠ InnoDB <span class="sub">· 엔진 범위를 명시한다</span></div>
<div class="not-equal">WAL / Redo ≠ Undo <span class="sub">· 복구 기록과 과거 버전 재구성을 분리한다</span></div>
<div class="not-equal"><span style="color:#6db8ff">VACUUM</span> ≠ <span style="color:var(--my-on-dark)">Purge</span> <span class="sub">· 수거 대상과 부가 책임이 다르다</span></div>
<div class="not-equal">VACUUM / Purge 완료 ≠ 파일 축소 <span class="sub">· 내부 해제·재사용과 OS 반환은 다르다</span></div>

<div class="cite">[4][6][8][9][14]</div>

---

<!-- _class: dark -->

<div class="eyebrow">17 · Takeaway</div>

<div class="closing">
<div>
<h2 style="font-size:58px">과거를 어디에 두는지가<br>청소 방식을 결정한다</h2>
<p class="big" style="font-size:31px"><span style="color:#6db8ff">Heap → VACUUM</span><br><span style="color:var(--my-on-dark)">Undo → Purge</span></p>
<p class="sub" style="margin-top:36px">그리고 PostgreSQL에서 표준 VACUUM 뒤에도 물리적 bloat를 온라인으로 줄여야 한다면, 다음 질문은 <b style="color:var(--white)">pg_repack</b>이다. [13]</p>
</div>
<div class="question-mark">?</div>
</div>

---

<div class="eyebrow">Sources · Official documentation</div>

## 근거 문서

<div class="grid2 split-rule source-list">
<div>
<h3 class="pg-text">PostgreSQL 18</h3>
<ol>
<li><a href="https://www.postgresql.org/docs/current/mvcc-intro.html">13.1 Introduction — MVCC</a></li>
<li><a href="https://www.postgresql.org/docs/current/transaction-iso.html">13.2 Transaction Isolation</a></li>
<li><a href="https://www.postgresql.org/docs/current/ddl-system-columns.html">5.6 System Columns</a></li>
<li><a href="https://www.postgresql.org/docs/current/routine-vacuuming.html">24.1 Routine Vacuuming</a></li>
<li><a href="https://www.postgresql.org/docs/current/storage-hot.html">66.7 Heap-Only Tuples</a></li>
<li value="11"><a href="https://www.postgresql.org/docs/current/storage-page-layout.html">66.6 Database Page Layout</a></li>
<li value="13"><a href="https://reorg.github.io/pg_repack/">pg_repack — Reorganize with minimal locks</a></li>
</ol>
</div>
<div>
<h3 class="my-text">MySQL 8.4 · InnoDB</h3>
<ol start="6">
<li><a href="https://dev.mysql.com/doc/refman/8.4/en/innodb-multi-versioning.html">17.3 InnoDB Multi-Versioning</a></li>
<li><a href="https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html">17.7.2.3 Consistent Nonlocking Reads</a></li>
<li><a href="https://dev.mysql.com/doc/refman/8.4/en/innodb-undo-logs.html">17.6.6 Undo Logs</a></li>
<li><a href="https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html">17.8.9 Purge Configuration</a></li>
<li><a href="https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html">17.7.2.1 Transaction Isolation Levels</a></li>
<li value="12"><a href="https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html">17.6.2.1 Clustered and Secondary Indexes</a></li>
<li value="14"><a href="https://dev.mysql.com/doc/refman/8.4/en/innodb-file-space.html">17.11.2 File Space Management</a></li>
</ol>
</div>
</div>

<p class="sub" style="margin-top:20px">확인일: 2026-09-12 · 전체 URL과 범위는 <code>citations.json</code></p>

/*
 * 슬라이드 넘침 검사기
 *
 * Marp 가 만든 HTML 을 헤드리스 Chrome 으로 열어, 슬라이드마다
 * "콘텐츠가 실제로 차지한 높이" 와 "슬라이드가 허용하는 높이" 를 비교한다.
 *
 *   node check-overflow.mjs <파일.html> [여유px]
 *
 * 여유px(기본 40)보다 적게 남은 슬라이드를 전부 보고한다.
 * 실제로 넘친 슬라이드가 하나라도 있으면 종료 코드 1.
 *
 * 왜 "여유"를 두는가:
 *   한글 폰트 폴백에 따라 줄 높이가 조금씩 달라져서, 딱 맞게 채운 슬라이드는
 *   보는 사람 환경에서 넘칠 수 있다. 그래서 3회 측정 후 최악값으로 판정하고,
 *   그 위에 여유까지 요구한다.
 *
 * 실행에는 puppeteer-core 와 Chrome 이 필요하다 (build-slides.sh check 가 준비해준다).
 */
import puppeteer from 'puppeteer-core';
import path from 'path';

const file = process.argv[2];
const MARGIN = Number(process.argv[3] ?? 40);
const SAMPLES = 3;

if (!file) {
  console.error('usage: node check-overflow.mjs <파일.html> [여유px]');
  process.exit(2);
}

const executablePath = process.env.CHROME_PATH;
if (!executablePath) {
  console.error('CHROME_PATH 환경변수가 필요합니다.');
  process.exit(2);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--font-render-hinting=none', '--force-device-scale-factor=1'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + path.resolve(file), { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);

  const measure = () => page.evaluate(() => {
    const out = [];
    document.querySelectorAll('section').forEach((s, i) => {
      const st = getComputedStyle(s);
      const padT = parseFloat(st.paddingTop);
      const padB = parseFloat(st.paddingBottom);
      const avail = s.clientHeight - padT - padB;
      const sr = s.getBoundingClientRect();
      const scale = sr.height ? s.clientHeight / sr.height : 1;

      // 자식들의 "실제" 높이를 더해 콘텐츠 총 높이를 구한다.
      //
      // 왜 위치(getBoundingClientRect().bottom)를 안 쓰나:
      //   Marp 는 코드블록을 <marp-pre> 래퍼로 감싸는데, HTML 미리보기에서는
      //   이 래퍼가 실제 렌더링보다 크게 잡힌다(자동 축소용 여유 공간).
      //   그러면 뒤따르는 요소들의 위치가 통째로 밀려 실제보다 과하게 넘친 것으로
      //   측정된다. PDF/PNG 출력과도 어긋난다.
      //   → 래퍼 대신 안쪽 <code> 의 높이 + 패딩을 쓰고, 높이를 직접 합산한다.
      let total = 0;
      let prevMargin = 0;
      for (const c of s.children) {
        const tag = c.tagName.toLowerCase();
        if (tag === 'header' || tag === 'footer') continue;
        const cs = getComputedStyle(c);
        if (cs.position === 'absolute' || cs.position === 'fixed') continue;

        let h = c.getBoundingClientRect().height * scale;
        if (tag === 'marp-pre' || tag === 'pre') {
          const inner = c.querySelector('code');
          if (inner) {
            h = inner.getBoundingClientRect().height * scale
              + (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
              + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
          }
        }
        const mt = parseFloat(cs.marginTop) || 0;
        const mb = parseFloat(cs.marginBottom) || 0;
        total += Math.max(mt, prevMargin) + h;   // 인접 마진 병합
        prevMargin = mb;
      }
      const bottom = total;

      out.push({
        page: Number(s.getAttribute('data-marpit-pagination') || i + 1),
        avail: Math.round(avail),
        used: Math.round(bottom),
        title: (s.querySelector('h1,h2')?.textContent
                || s.querySelector('p,table,pre')?.textContent || '')
               .slice(0, 44).replace(/\s+/g, ' ').trim(),
      });
    });
    return out;
  });

  // 렌더링 편차를 감안해 여러 번 재고 페이지별 최악값을 쓴다
  const worst = new Map();
  for (let i = 0; i < SAMPLES; i++) {
    for (const r of await measure()) {
      const cur = worst.get(r.page);
      if (!cur || r.used > cur.used) worst.set(r.page, r);
    }
    if (i < SAMPLES - 1) await new Promise(r => setTimeout(r, 600));
  }

  const all = [...worst.values()].sort((a, b) => a.page - b.page);
  all.forEach(r => { r.over = r.used - r.avail; });

  const over  = all.filter(r => r.over > 0);
  const tight = all.filter(r => r.over > -MARGIN).sort((a, b) => b.over - a.over);

  if (over.length === 0 && tight.length === 0) {
    console.log(`총 ${all.length}장 - 전부 여유 ${MARGIN}px 이상 ✔`);
  } else {
    console.log(`총 ${all.length}장 | 넘침 ${over.length}장 | 여유 ${MARGIN}px 미만 ${tight.length}장\n`);
    console.log('page   여유px  사용/가용        제목');
    console.log('----  -------  --------------  ------------------------------------');
    for (const r of tight) {
      const mark = r.over > 0 ? '\x1b[31m' : '\x1b[33m';
      console.log(mark + String(r.page).padStart(4), String(-r.over).padStart(8), ' ',
                  `${r.used}/${r.avail}`.padEnd(14), r.title + '\x1b[0m');
    }
    if (over.length) {
      console.log('\n빨간 줄(여유 음수)은 실제로 내용이 잘립니다. 슬라이드를 나누거나 줄이세요.');
    }
  }

  process.exitCode = over.length ? 1 : 0;
} finally {
  await browser.close();
}

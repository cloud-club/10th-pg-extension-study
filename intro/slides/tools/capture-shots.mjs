/*
 * 슬라이드에 넣을 GitHub 화면 캡처
 *
 *   ./build-slides.sh shots        (CHROME_PATH 를 찾아서 이 스크립트를 돌린다)
 *
 * "우리가 lab 에서 만든 규칙이 실제 extension 에서도 그대로다" 를 보여주는 두 장.
 * 헤드리스 Chrome 으로 열어 필요한 영역만 잘라 images/ 에 PNG 로 남긴다.
 *
 * GitHub 화면은 언제든 바뀔 수 있다. 캡처가 어긋나면 anchor 문자열이나
 * 잘라낼 크기(w/h)를 조정하면 된다.
 */
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const executablePath = process.env.CHROME_PATH;
if (!executablePath) { console.error('CHROME_PATH 환경변수가 필요합니다.'); process.exit(2); }

const SHOTS = [
  {
    out: 'images/pgvector-sql.png',
    url: 'https://github.com/pgvector/pgvector/tree/master/sql',
    // 파일 목록 표. 빵부스러기(pgvector / sql) 부터 아래로 잘라낸다.
    anchor: () => document.querySelector('table[aria-labelledby="folders-and-files"]'),
    box: { dx: 0, dy: -112, w: 1090, h: 620 },
  },
  {
    out: 'images/pgvector-src.png',
    url: 'https://github.com/pgvector/pgvector/blob/master/src/vector.c#L821-L852',
    // vector_add() 본문. 주석 "Add vectors" 줄을 기준점으로 잡는다.
    anchor: () => [...document.querySelectorAll('span')]
                    .find(e => e.textContent.trim() === '* Add vectors'),
    box: { dx: -95, dy: -42, w: 1090, h: 660 },
  },
];

const browser = await puppeteer.launch({
  executablePath, headless: 'new',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});

let rc = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 });
  for (const s of SHOTS) {
    process.stdout.write(`  ${s.out.padEnd(26)} → `);
    try {
      await page.goto(s.url, { waitUntil: 'networkidle2', timeout: 60000 });
      const clip = await page.evaluate((fnSrc, box) => {
        const el = new Function('return (' + fnSrc + ')()')();
        if (!el) throw new Error('기준 요소를 찾지 못했습니다');
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x + window.scrollX + box.dx),
                 y: Math.round(r.y + window.scrollY + box.dy),
                 width: box.w, height: box.h };
      }, s.anchor.toString(), s.box);
      // GitHub 코드 화면은 보이는 줄만 그린다(가상 스크롤). 화면 밖을 그대로
      // 캡처하면 빈 이미지가 나오므로, 영역을 뷰포트 안으로 스크롤해서 찍는다.
      // 위쪽 고정 툴바에 가리지 않도록 140px 여유를 두고 내린다.
      await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 140)), clip.y);
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({ path: s.out, clip, captureBeyondViewport: false });
      const kb = (fs.statSync(s.out).size / 1024).toFixed(0);
      console.log(`\x1b[32m${clip.width}x${clip.height} @2x  ${kb}KB\x1b[0m`);
    } catch (e) {
      console.log(`\x1b[31m실패: ${e.message.split('\n')[0]}\x1b[0m`);
      rc = 1;
    }
  }
} finally { await browser.close(); }
process.exit(rc);

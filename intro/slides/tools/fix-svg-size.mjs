/*
 * Mermaid 가 만든 SVG 는 width="100%" 라서 고유 크기(intrinsic size)가 없다.
 * <img src="...svg"> 로 넣으면 브라우저가 크기를 계산하지 못해
 * PDF/PNG 로 내보낼 때 빈 칸으로 나온다.
 *
 * viewBox 값을 읽어 width/height 속성을 채워 넣는다.
 *   node fix-svg-size.mjs images/*.svg
 */
import fs from 'fs';

let changed = 0;
for (const file of process.argv.slice(2)) {
  let s = fs.readFileSync(file, 'utf8');
  const vb = s.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
  if (!vb) { console.error(`  ! viewBox 없음: ${file}`); continue; }
  const w = Math.round(Number(vb[3]));
  const h = Math.round(Number(vb[4]));

  const before = s;
  s = s.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, '$1');
  s = s.replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, '$1');
  s = s.replace(/(<svg\b)/, `$1 width="${w}" height="${h}"`);
  // max-width 인라인 스타일도 제거 (슬라이드에서 확대되지 않는 원인)
  s = s.replace(/(<svg\b[^>]*style=")([^"]*)"/, (m, p, style) =>
        p + style.replace(/max-width:\s*[^;]+;?/g, '').trim() + '"');

  if (s !== before) { fs.writeFileSync(file, s); changed++; }
  console.log(`  ${file.split('/').pop().padEnd(34)} ${w}x${h}`);
}
console.log(`✔ ${changed}개 보정`);

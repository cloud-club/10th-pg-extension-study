// 모든 clotho 애니메이션을 파싱하고 여러 시점의 프레임을 실제로 SVG 로 그려본다.
// 파싱만으로는 "그리다 죽는" 경우나 "끝까지 빈 화면인" 경우를 못 잡는다.
import { parseDocumentOrThrow, buildScene, measureElementBox } from '@kokoa/clotho'
import { serializeScene } from '@kokoa/clotho/svg'
import { readdirSync, readFileSync } from 'node:fs'

const dir = 'src/animations'
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('.')).sort()
let bad = 0
const seen = []
for (const f of files) {
  const raw = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))
  try {
    const doc = parseDocumentOrThrow(raw)
    const stops = [0, 0.05, 0.25, 0.5, 0.75, 0.99].map((r) => Math.round(doc.duration * r))
    let maxNodes = 0
    const blank = []
    const diags = new Set()
    for (const t of stops) {
      const scene = buildScene(doc, t)
      const svg = serializeScene(scene)
      if (!svg.startsWith('<svg')) throw new Error(`t=${t} 에서 svg 가 아니다`)
      ;(scene.diagnostics ?? []).forEach((d) => diags.add(typeof d === 'string' ? d : d.message ?? JSON.stringify(d)))
      const n = scene.nodes.length
      maxNodes = Math.max(maxNodes, n)
      if (n === 0) blank.push(`${Math.round((t / doc.duration) * 100)}%`)
    }
    if (maxNodes === 0) throw new Error('어느 시점에도 그려지는 요소가 없다')
    // 카메라를 쓰는 문서는 장마다 실제로 배율이 붙는지 본다.
    // focus 대상이 아직 등장하지 않았으면 camera-focus 진단이 뜨고 화면이 안 움직인다.
    // 장 전환이 끝난 뒤에 잰다 — 전환 중에 재면 중간값이 나온다
    const zooms = doc.camera?.focus?.length
      ? doc.chapters.map((ch) => buildScene(doc, ch.time + 2400).camera?.zoom ?? 1)
      : []
    if (zooms.length && zooms.every((z) => Math.abs(z - 1) < 0.02)) {
      throw new Error('카메라를 선언했는데 어느 장에서도 배율이 안 붙는다')
    }
    // 배율은 장마다 같아야 한다 — 확대·축소가 반복되면 읽기 어렵다. 카메라는 이동만 한다.
    if (zooms.length) {
      const spread = Math.max(...zooms) - Math.min(...zooms)
      if (spread > 0.02) throw new Error(`장마다 배율이 다르다(${zooms.map((z) => z.toFixed(2)).join('/')}) — 이동만 해야 한다`)
    }
    // 끝 시점이 비어 있으면 마지막에 화면이 사라진다는 뜻이라 따로 표시한다
    const tailBlank = blank.includes('99%')
    const chapters = (doc.chapters ?? []).length
    seen.push(doc.id)
    console.log(
      `  ✔ ${f.padEnd(24)} ${String(doc.duration).padStart(5)}ms · 요소 ${String(doc.elements.length).padStart(2)}` +
      ` · 최대 노드 ${String(maxNodes).padStart(3)} · 챕터 ${chapters}` +
      (blank.length ? `  빈 프레임 ${blank.join(',')}` : '') +
      (tailBlank ? '  ← 마지막이 빈 화면' : '') +
      (zooms.length ? `  카메라 ${zooms.map((z) => z.toFixed(2)).join('/')}` : '') +
      (diags.size ? `  진단 ${[...diags].join('; ')}` : ''),
    )
    if (diags.size) throw new Error(`장면 진단: ${[...diags].join('; ')}`)

    // 초점 상자 안에 세로로 들어와 있는데 가로로 삐져나가는 요소 = 그 장에서 옆이 잘려 보인다.
    // 장에 요소를 빠뜨리거나 마지막 되돌아보기를 좁게 잡으면 실제로 이런 일이 난다.
    const box = {}
    for (const el of doc.elements) {
      try { box[el.id] = measureElementBox(el, doc) } catch { /* 못 재는 타입은 건너뛴다 */ }
    }
    const clipped = []
    for (const fo of doc.camera?.focus ?? []) {
      const bs = fo.elementIds.map((i) => box[i]).filter(Boolean)
      if (!bs.length) continue
      const pad = fo.padding ?? 24
      const x0 = Math.min(...bs.map((b) => b.x)) - pad
      const x1 = Math.max(...bs.map((b) => b.x + b.width)) + pad
      const y0 = Math.min(...bs.map((b) => b.y))
      const y1 = Math.max(...bs.map((b) => b.y + b.height))
      for (const el of doc.elements) {
        const b = box[el.id]
        if (!b) continue
        const on = (el.appearances ?? []).some((a) => a.start <= fo.time && (a.end ?? doc.duration) >= fo.time)
        if (!on) continue
        if (b.y >= y0 - 4 && b.y + b.height <= y1 + 4 && (b.x + b.width > x1 + 1 || b.x < x0 - 1)) {
          clipped.push(`t=${fo.time} ${el.id}`)
        }
      }
    }
    // 같은 시점에 글자끼리 겹치면 읽을 수 없다. 요소를 옮기다 보면 실제로 겹친다.
    const overlaps = []
    const real = doc.elements.filter((e) => !e.id.startsWith('cam'))
    for (let i = 0; i < real.length; i++) {
      for (let j = i + 1; j < real.length; j++) {
        const a = real[i], b = real[j]
        if (a.type !== 'text' && b.type !== 'text') continue   // 상자끼리 겹침은 의도일 수 있다
        const A = box[a.id], B = box[b.id]
        if (!A || !B) continue
        const together = (a.appearances ?? []).some((x) =>
          (b.appearances ?? []).some((y) => x.start < (y.end ?? doc.duration) && y.start < (x.end ?? doc.duration)))
        if (!together) continue
        const ox = Math.min(A.x + A.width, B.x + B.width) - Math.max(A.x, B.x)
        const oy = Math.min(A.y + A.height, B.y + B.height) - Math.max(A.y, B.y)
        if (ox > 6 && oy > 6) overlaps.push(`${a.id}×${b.id}`)
      }
    }
    if (overlaps.length) throw new Error(`글자가 겹친다: ${overlaps.slice(0, 6).join(', ')}${overlaps.length > 6 ? ` 외 ${overlaps.length - 6}개` : ''}`)

    if (clipped.length) throw new Error(`초점 밖으로 잘리는 요소: ${clipped.slice(0, 6).join(', ')}${clipped.length > 6 ? ` 외 ${clipped.length - 6}개` : ''}`)
  } catch (e) {
    bad++
    console.log(`  ✘ ${f.padEnd(24)} ${e.message}`)
  }
}

// 페이지가 참조하는 id 가 전부 존재하는지도 본다
const pages = readdirSync('src/pages', { recursive: true }).filter((f) => String(f).endsWith('.tsx'))
const used = new Set()
for (const f of pages) {
  const src = readFileSync(`src/pages/${f}`, 'utf8')
  for (const m of src.matchAll(/<Clotho\s+id="([^"]+)"/g)) used.add(m[1])
}
const missing = [...used].filter((id) => !seen.includes(id))
const unused = seen.filter((id) => !used.has(id))
console.log(`\n  페이지가 쓰는 애니메이션 ${used.size}개 / 문서 ${seen.length}개`)
if (missing.length) { bad++; console.log(`  ✘ 문서가 없는 참조: ${missing.join(', ')}`) }
if (unused.length) console.log(`  · 어느 페이지에서도 안 쓰는 문서: ${unused.join(', ')}`)
console.log(bad === 0 ? `\n${files.length}개 전부 정상 렌더` : `\n${bad}개 실패`)
process.exit(bad ? 1 : 0)

// 모든 clotho 애니메이션을 파싱하고 여러 시점의 프레임을 실제로 SVG 로 그려본다.
// 파싱만으로는 "그리다 죽는" 경우나 "끝까지 빈 화면인" 경우를 못 잡는다.
import { parseDocumentOrThrow, buildScene } from '@kokoa/clotho'
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
    // 끝 시점이 비어 있으면 마지막에 화면이 사라진다는 뜻이라 따로 표시한다
    const tailBlank = blank.includes('99%')
    const chapters = (doc.chapters ?? []).length
    seen.push(doc.id)
    console.log(
      `  ✔ ${f.padEnd(24)} ${String(doc.duration).padStart(5)}ms · 요소 ${String(doc.elements.length).padStart(2)}` +
      ` · 최대 노드 ${String(maxNodes).padStart(3)} · 챕터 ${chapters}` +
      (blank.length ? `  빈 프레임 ${blank.join(',')}` : '') +
      (tailBlank ? '  ← 마지막이 빈 화면' : '') +
      (diags.size ? `  진단 ${[...diags].join('; ')}` : ''),
    )
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

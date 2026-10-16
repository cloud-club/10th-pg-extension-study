import assert from 'node:assert/strict'
import { SECTIONS, WEEKS, FLAT, findPage, neighbors, href, weekHome } from '../src/content/registry'

assert.equal(new Set(SECTIONS.map((s) => s.slug)).size, SECTIONS.length, '섹션 URL 중복')
assert.equal(new Set(FLAT.map(href)).size, FLAT.length, '페이지 URL 중복')
for (const week of WEEKS) {
  const pages = FLAT.filter((p) => p.section.week === week.slug)
  assert.ok(pages.length, `${week.slug}의 페이지 없음`)
  assert.equal(weekHome(week.slug), href(pages[0]))
  pages.forEach((p, i) => {
    assert.equal(findPage(p.section.slug, p.page.slug)?.page, p.page)
    const { prev, next } = neighbors(p.section.slug, p.page.slug)
    assert.equal(prev?.page ?? null, pages[i - 1]?.page ?? null)
    assert.equal(next?.page ?? null, pages[i + 1]?.page ?? null)
  })
}
for (const s of SECTIONS) {
  assert.ok(WEEKS.some((w) => w.slug === s.week), '등록되지 않은 주차')
  assert.equal(new Set(s.pages.map((p) => p.slug)).size, s.pages.length, '페이지 URL 중복')
}
assert.ok(findPage('start', 'overview'), '기존 진입 링크 유지')
assert.ok(findPage('foundations', 'gin'), '기존 본문 링크 유지')
assert.equal(findPage('missing', 'missing'), null)
console.log(`${WEEKS.length}개 주차 · ${FLAT.length}개 페이지 탐색 검증 통과`)

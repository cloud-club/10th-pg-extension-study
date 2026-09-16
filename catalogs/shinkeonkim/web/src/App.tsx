import { Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { PageNav } from '@/components/layout/PageNav'
import { TooltipProvider } from '@/components/ui/tooltip'
import { findPage, HOME, SECTIONS } from '@/content/registry'

function Loading() {
  return <p className="py-24 text-center text-[13px] text-muted-foreground">불러오는 중…</p>
}

function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-[15px] font-medium">그런 페이지는 없습니다.</p>
      <a href={`#${HOME}`} className="mt-2 inline-block text-[13px] text-primary underline-offset-4 hover:underline">
        개요로 돌아가기
      </a>
    </div>
  )
}

function PageRoute() {
  const { section, page } = useParams()
  const found = findPage(section, page)
  if (!found) return <NotFound />
  const View = found.page.view
  return (
    <Suspense fallback={<Loading />}>
      <View />
      <PageNav section={found.section.slug} page={found.page.slug} />
    </Suspense>
  )
}

/** 섹션만 찍었을 때는 그 섹션의 첫 페이지로 보낸다. */
function SectionRoute() {
  const { section } = useParams()
  const s = SECTIONS.find((x) => x.slug === section || x.routeSlug === section)
  return s ? <Navigate to={`/${s.routeSlug ?? s.slug}/${s.pages[0].slug}`} replace /> : <NotFound />
}

export default function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to={HOME} replace />} />
          <Route path="/:section" element={<SectionRoute />} />
          <Route path="/:section/:page" element={<PageRoute />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
    </TooltipProvider>
  )
}

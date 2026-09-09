import { Navigate } from 'react-router-dom'

/** 실험 06 의 내용은 전문검색 섹션 두 페이지에 나눠 담았다. */
export default function E06() {
  return <Navigate to="/fulltext/tsvector" replace />
}

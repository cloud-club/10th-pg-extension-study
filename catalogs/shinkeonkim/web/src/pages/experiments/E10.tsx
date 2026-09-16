import { Navigate } from 'react-router-dom'

/** 실험 10 의 내용은 GIN 페이지의 "정렬돼 있으면 왜 1글자 검색이 되나" 한 곳에만 둔다. */
export default function E10() {
  return <Navigate to="/foundations/gin#sorted" replace />
}

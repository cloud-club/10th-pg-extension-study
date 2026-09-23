import { Navigate } from 'react-router-dom'

/**
 * 실험 03 의 내용은 pg_bigm 쪽 "연산자 커버리지" 한 곳에만 둔다.
 * 같은 글을 두 URL 에 복제하지 않으려고 여기서는 넘겨보낸다.
 */
export default function E03() {
  return <Navigate to="/pg-bigm/operators" replace />
}

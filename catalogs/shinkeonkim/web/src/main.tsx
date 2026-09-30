import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// HashRouter 를 쓴다 — 정적 파일로 열거나 서브 경로에 올려도 새로고침이 깨지지 않는다.
//
// StrictMode 를 쓰지 않는다. React 18 의 StrictMode 는 개발 모드에서 이펙트를
// 마운트 → 정리 → 재마운트 하는데, clotho 플레이어(@kokoa/clotho 0.2.0)의 스케줄러가
// 그 정리를 넘기지 못해 **개발 서버에서만 애니메이션이 0ms 에 멈춘다.**
// (프로덕션 빌드에서는 정상 재생된다 — StrictMode 가 이펙트를 두 번 돌리지 않으므로.)
// 껐다는 사실을 잊고 다시 켜면 애니메이션이 조용히 멈추므로 여기 적어 둔다.
// 검증: web/scripts/check-animations.mjs (문서 자체는 항상 렌더된다)
createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <App />
  </HashRouter>,
)

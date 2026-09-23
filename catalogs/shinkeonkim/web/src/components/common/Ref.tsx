import { Link, useLocation, useNavigate } from 'react-router-dom'

/**
 * 다른 절을 가리키는 링크.
 *
 * 이 앱은 "§4" 같은 기호로 절을 가리키지 않는다 — 읽는 사람이 그게 어디인지 직접 찾아야 하기 때문이다.
 * 대신 절 이름을 그대로 쓰고 실제로 그 자리로 데려간다.
 *
 *   <Ref to="/foundations/gin#structure">GIN 의 엔트리 트리</Ref>
 *   <Ref to="#corpus">실제 말뭉치로 재본 것</Ref>      ← 같은 페이지 안
 *
 * HashRouter 라 브라우저의 기본 앵커 이동(`href="#id"`)은 라우팅을 깨뜨린다.
 * 그래서 같은 페이지 안에서는 직접 스크롤하면서 라우터 쪽 해시도 같이 갱신하고(주소를 공유할 수 있게),
 * 다른 페이지로 갈 때는 AppShell 이 마운트 후에 앵커를 찾아 이동한다.
 *
 * `behavior: 'smooth'` 는 쓰지 않는다 — 자동화 환경이나 "동작 줄이기" 설정에서 조용히 무시된다.
 */
const CLS = 'text-primary underline-offset-4 hover:underline'

export function Ref({ to, children }: { to: string; children: React.ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [path, id] = to.split('#')
  const samePage = !path || path === pathname

  if (samePage && id) {
    return (
      <a
        href={`#${id}`}
        className={CLS}
        onClick={(e) => {
          e.preventDefault()
          document.getElementById(id)?.scrollIntoView({ block: 'start' })
          navigate(`${pathname}#${id}`, { replace: true })
        }}
      >
        {children}
      </a>
    )
  }
  return <Link to={to} className={CLS}>{children}</Link>
}

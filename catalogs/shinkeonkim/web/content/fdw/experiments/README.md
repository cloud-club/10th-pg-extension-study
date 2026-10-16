# Week 07 · 반복 실험

기능 확인은 [Labs](../labs/README.md), 반복 시간 측정은 이 목록에 둔다. 수치는 실제 results/run.json에서 웹으로 동기화한다. 현재 환경의 결과가 모든 네트워크·서비스 규모에 적용된다는 뜻은 아니다.

| 실험 | 질문 | 지표 |
| --- | --- | --- |
| [01 · 원격/로컬 필터](01-pushdown-and-transfer/README.md) | 같은 정답에서 처리 위치가 비용을 바꾸는가? | 제거 행, Execution Time |
| [02 · fetch_size·행 폭](02-fetch-and-row-width/README.md) | 묶음 크기와 반환 폭의 영향은? | 반환 10000행, Execution Time |
| [03 · 계획·연결 유지](03-planning-and-connections/README.md) | estimate/keep가 짧은 쿼리에 미치는 영향은? | Planning·Execution Time |

## 재현과 증거

각 README의 명령으로 실행한다. 환경 준비 후 실험을 순서대로 실행한다. 같은 공유 환경의 옵션을 동시에 변경하지 않는다. 결과에는 원시 반복값·중앙값·범위·환경이 있다. 웹 동기화는 `web/scripts/sync-fdw-results.py`가 수행한다.

## 실험 범위

같은 호스트 Docker, PostgreSQL 18.6, 합성 책 100000행이다. 조건당 예열 2회·본 측정 10회다. EXPLAIN의 서버 시간이며 앱 풀·결과 렌더링·WAN 지연·실제 바이트·메모리·서비스 p99를 측정하지 않는다. 기능 검증용 statement 로그는 성능 측정 전에 비활성화한다.

## 다음 실험을 결정하는 질문

실제 RTT를 주입하면 fetch_size의 선택 경계가 어떻게 바뀌는가? 동시 세션을 늘렸을 때 어디서 포화되는가? 넓은 결과와 큰 fetch의 RSS 영향은 무엇인가? 실패한 원격 커밋 상태를 업무 ID로 어떻게 확인하는가? 현재 결과로 답할 수 없는 질문은 이 범위 밖임을 분명히 한다.

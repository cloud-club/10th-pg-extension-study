# Week 07 · postgres_fdw Labs

기본 문서로 개념을 쌓고 아래 순서로 직접 확인한다. PostgreSQL 18.6·Docker Compose v2·Python 3 환경이며 추가 Python 패키지는 없다.

| Lab | 확인할 것 | 실제 검증 |
| --- | --- | --- |
| [01 · 연결과 메타데이터](01-connect-and-metadata/README.md) | 기본 01~03. 서버·DB·역할·스키마·테이블을 구분한다. | SQL + verify.py assert |
| [02 · pushdown·JOIN·원격 검색](02-pushdown-and-search/README.md) | 기본 04~05. SELECT·WHERE·JOIN·GROUP BY·EXPLAIN을 읽는다. | SQL + verify.py assert |
| [03 · FETCH 횟수와 네트워크 모델](03-fetch-and-network/README.md) | 기본 06. 반환 행·RTT·fetch_size와 설정 우선순위를 구분한다. | SQL + verify.py assert |
| [04 · 스냅샷·롤백·원격 잠금](04-transactions-and-locks/README.md) | 기본 08. 자동 커밋·BEGIN·COMMIT·ROLLBACK을 이해한다. | SQL + verify.py assert |
| [05 · 세션별 연결·관측·관련 확장](05-connections-and-related/README.md) | 기본 07·09. 세션·idle·연결 유지와 dblink·file_fdw의 역할을 구분한다. | SQL + verify.py assert |

각 디렉터리에서 `./run.sh`를 실행한다. 웹의 각 Lab 페이지에 학습 목표·수동 단계·해설을 모았다. 자동 검증 결과는 각 results/run.json에 저장한다.

모든 Lab은 shared/의 전용 두 DB를 공유한다. setup은 중복 객체를 만들지 않고 기존 행을 보존하며 준비한다. 설정을 바꾸는 Lab과 실험은 순서대로 실행한다. `shared/run.sh down` 또는 각 Lab의 `./run.sh down`으로 전체 전용 환경을 정리한다.

Lab 기능 확인과 성능 반복 측정은 다르다. FETCH 로그 실습은 명령 횟수만 검증하고 로그를 끈 성능 실험은 [experiments](../experiments/README.md)에 둔다.

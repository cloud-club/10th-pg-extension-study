# 국내 기업 사례에서 정하는 조사 질문

## 이 페이지의 읽는 법

기업 이름보다 “왜 다른 DB를 연결했는가 → 어떤 전제에서 어떻게 처리했는가 → 우리는 무엇을 검증해야 하는가”를 따라 읽는다. 기술블로그의 적용 경험과 클라우드 사업자의 사용 가이드는 근거가 다르다. 아래의 조사 질문·학습 연결은 공개 자료를 바탕으로 구성한 이 학습 자료의 해석이다.

2026-10-09에 원문을 확인했다. 우아한형제들 글은 2024-12-12, 매드업 글은 2022-04-01에 공개된 당시 사례다. 서비스 가이드는 확인 시점의 제공 절차이며 내부 서비스 전체의 운영 구성이나 도입 규모를 증명하지 않는다.

## 1. 우아한형제들: 상품 시스템 통합을 SQL로 이관

공개 적용 사례. 배민스토어 상품 정보를 통합 상품 DB로 옮길 때 별도 배치 앱 대신 INSERT … SELECT를 사용했다. 쓰기를 차단한 뒤 RDS 스냅샷으로 이관용 DB를 만들었다. 큰 원본은 필요한 행을 별도 표에 추렸고, 반복 사용 데이터는 로컬에 옮겨 JOIN 부담을 줄였다. 글은 약 4억 행 중 유효 700만 행을 추린 표로 변경한 쿼리가 40분 이상 미완료에서 10분 내 완료로 달라졌다고 보고한다. 이는 작성팀의 당시 관측값이며 이 저장소의 벤치마크가 아니다. [우아한형제들 원문](https://techblog.woowahan.com/20371/)

**따라서 조사할 것:** 이동 전에 원격에서 JOIN·필터를 끝낼 수 있는가? 직접 읽기와 전처리 표·로컬 staging의 전체 비용은 어떻게 다른가? 이관 중 데이터 변경을 어떤 방식으로 막을 것인가?

기초는 [SELECT와 JOIN](docs/basic/04-select-and-joins.md)·[실행 계획](docs/basic/05-explain-and-pushdown.md), 심화는 [비용·통계](docs/advanced/02-cost-statistics-and-joins.md)·[쓰기와 실패](docs/advanced/05-writes-locks-and-retries.md)로 이어진다. [Lab 02](labs/02-pushdown-and-search/HANDS-ON.md)는 처리 위치, [Lab 04](labs/04-transactions-and-locks/HANDS-ON.md)는 트랜잭션의 경계를 확인한다.

## 2. 네이버클라우드: VPC 안의 DB 사이 접속 절차

공식 서비스 사용 가이드. Cloud DB for PostgreSQL은 콘솔 확장 설치, DB 서버 간 ACG, 사용자 접근제어를 안내한다. private domain에서 확인한 IP를 사용해 접근제어를 구성하고 target DB에서 source DB의 server·user mapping·foreign table을 등록해 조회한다. 이는 고객에게 제공한 연결 방법의 근거다. [네이버클라우드 원문](https://guide.ncloud-docs.com/docs/clouddbforpostgresql-postgresqlfdw)

**따라서 조사할 것:** 실제 접속을 시작하는 서버의 주소는 무엇인가? 네트워크 허용, 원격 인증, 표 SELECT 권한은 어디에서 각각 실패할 수 있는가? 사설 IP·DNS·failover 이후의 목적지를 어떻게 검증할 것인가?

[연결·권한](docs/basic/03-connect-and-permissions.md) → [Lab 01](labs/01-connect-and-metadata/HANDS-ON.md) → [운영 설계](docs/advanced/06-source-and-production-design.md) 순서로 읽는다. 공개 가이드 확인과 실제 해당 클라우드에서의 접속 검증은 별개이며, 이 저장소의 Docker 실습이 그 서비스의 ACG·failover까지 검증하지는 않는다.

## 3. 카카오클라우드: 관리형 환경의 FDW 생성 경로

공식 서비스 사용 가이드. 원격 서버·계정 매핑은 제공되는 create_fdw_server를 통해 구성하며, 이 루틴은 template1을 통해 새 DB에 제공된다고 설명한다. 목적지 포트의 outbound 규칙을 확인한 뒤 foreign table을 만든다. 표준 PostgreSQL의 직접 CREATE SERVER 절차와 서비스 제공 경로를 비교할 수 있다. [카카오클라우드 원문](https://docs.kakaocloud.com/service/data-store/postgresql/how-to-guides/postgresql-extension#postgres_fdw)

**따라서 조사할 것:** 누구에게 생성·사용 권한이 있는가? 어느 템플릿에서 만든 DB인가? 서비스 루틴이 만든 mapping·server 옵션을 어떻게 확인하는가? 앱 역할에 허용한 원격 읽기 범위를 어떻게 좁히는가?

[네 가지 객체](docs/basic/02-fdw-and-four-objects.md)·[연결·권한](docs/basic/03-connect-and-permissions.md)·[소스와 운영](docs/advanced/06-source-and-production-design.md)에서 객체의 의미와 서비스별 설정 절차를 구분한다. 이 루틴은 로컬 Lab의 표준 postgres_fdw에 포함된 함수가 아니다.

## 4. 비교 사례 — 매드업: Redshift에서 PostgreSQL 데이터마트로

국내 기업의 데이터 파이프라인 공개 사례. postgres_fdw server 객체를 정의하지만, 예제의 실제 원격 조회는 dblink SQL과 프로시저가 수행한다. DB 간 데이터 이동을 선택하고 결과 타입·열 매핑을 생성하는 코드를 만들었다. 같은 수집 섹션의 중복 실행을 막는 제어도 설명한다. 따라서 “foreign table pushdown으로 Redshift를 운영했다”는 사례로 분류하면 부정확하다. [매드업 원문](https://tech.madup.com/data-mart-1/)

**따라서 조사할 것:** server 객체와 실제 쿼리 실행 API를 구분할 수 있는가? dblink 반환 타입·스키마 변경·오류 추적은 누가 관리하는가? 정기 수집 작업이 겹치면 잠금·세션·재시도는 어떻게 제어하는가?

[관련 확장과 선택](docs/basic/09-related-and-architecture.md)·[Lab 05](labs/05-connections-and-related/HANDS-ON.md)·[관측과 부하](docs/advanced/04-capacity-and-observability.md)에 연결한다. 당시 구현을 현재 PostgreSQL·Redshift 조합의 호환성 보장으로 확대하지 않는다.

## 5. 사례를 보며 먼저 구분할 세 가지

**데이터 흐름:** 원격 표에서 읽어 로컬 일반 표에 INSERT하는 것은 원격 foreign table에 INSERT하는 것과 다르다. batch_size는 foreign table에 보내는 INSERT 묶음 옵션이다. 로컬 목적지 INSERT … SELECT의 성능을 같은 옵션 하나로 해결한다고 생각하지 않는다.

**전처리 비용:** 큰 원본에서 필요한 표를 먼저 만들면 이후 이동은 빨라질 수 있다. 판단하려면 전처리 표 생성, 그 표의 저장 공간·인덱스, 이동, 검증까지 측정한다. 특정 이관 쿼리의 단축과 전체 작업 시간의 단축을 같은 숫자로 보고하지 않는다.

**두 종류의 스냅샷:** RDS 스냅샷으로 복구한 별도 DB와, FDW 원격 트랜잭션의 MVCC 스냅샷은 서로 다르다. 전자는 이관용 데이터 소스와 업무 부하 분리에 관한 설계, 후자는 어떤 행 버전을 읽는지에 관한 규칙이다. 분리한 DB를 읽어도 로컬·원격의 분산 커밋 보장이 추가되는 것은 아니다.

## 6. 이 사례들로 정한 조사 우선순위

| 우선순위 | 조사할 질문 | 확인 방법 | 연결할 학습 |
| --- | --- | --- | --- |
| 1 · 접속 | 로컬 DB 서버가 누구로 어디에 접속하는가? | 목적지·mapping·원격 권한, 단계별 오류 | 연결·권한, Lab 01 |
| 2 · 처리 위치 | 원격 필터·JOIN·집계가 어느 단계에서 끝나는가? | Remote SQL, local Filter, rows·loops, 원격 계획 | 실행 계획, Lab 02 |
| 3 · 이동 비용 | 몇 행·몇 바이트·몇 왕복을 쓰는가? | 반환 폭, 실제 FETCH, RTT, 성능 실험 | 네트워크, Lab 03 |
| 4 · 일관성 | 이관 중 변경과 실패를 어떻게 다루는가? | 변경 차단 정책, snapshot, rollback, 업무 ID | 트랜잭션, Lab 04 |
| 5 · 부하와 수명 | 원격 업무를 얼마나 방해하고 접속은 언제 닫히는가? | 연결 수·active·잠금·CPU/I/O, mapping 수명 | 연결·관측, Lab 05 |

## 7. 다음 실험은 사례의 가설을 검증한다

직접 FDW로 반복 읽는 방식, 원격에서 축소 표를 만든 방식, 로컬 staging 후 결합하는 방식을 **같은 정답**으로 비교한다. 반환 데이터·원격 계획·전체 시간·CPU/I/O·추가 디스크를 함께 기록한다. [JOIN 비교 Lab](join-comparison.md)은 직접 JOIN·키 배열·원격 축소 표·전체 로컬 staging을 같은 정답으로 비교하고 준비 비용을 기록한다. 합성 데이터와 예열된 단일 세션 환경이며 기업의 전체 이관 환경을 재현한 결과는 아니다.

로컬·원격 JOIN을 항상 full scan으로 단정하거나 CTE를 쓰면 pushdown이 보장된다고 해석하지 않는다. 가능한 경로와 선택된 경로는 EXPLAIN으로 확인한다. 함수·mapping·통계·비용·버전이 선택을 바꿀 수 있다. 이 판단 근거는 [FDW 계획 인터페이스](https://www.postgresql.org/docs/18/fdw-planning.html)와 [postgres_fdw 공식 문서](https://www.postgresql.org/docs/18/postgres-fdw.html)에서 확인한다.

[전체 학습 순서](/postgres-fdw/about)로 돌아가거나 [반복 실험과 실제 결과](experiments/README.md)를 읽는다.

## 주의사항을 사실과 조건으로 다시 검토하기
[블로그 주의사항 검토와 실험](blog-review.md)은 이관 사례의 JOIN·CTE·fetch·권한·트랜잭션·정리 설명을 공식 동작과 대조한다. CTE 필터 위치, 로컬 키 배열, 옵션 우선순위와 연결 수명은 전용 DB에서 직접 확인했다. 기업의 당시 성능 수치 자체를 독립 재현한 결과와는 구분한다.

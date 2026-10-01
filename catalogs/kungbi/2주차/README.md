# PostgreSQL이 확장 가능한 DB가 된 배경

> 관계형 모델을 버리지 않으면서 PostgreSQL은 어떻게 새로운 데이터 세계를 받아들였는가?

- 작성: [신웅비 (@kungbi)](https://github.com/kungbi)

이번 자료는 PostgreSQL의 extension 기능을 보기 전에, **왜 PostgreSQL이 타입·함수·연산자·인덱스 접근 방식까지 확장할 수 있는 DBMS로 설계됐는지** 역사와 기술 계보를 따라 설명합니다.

## 공유 자료

| 자료 | 내용 |
| --- | --- |
| [왜 PostgreSQL이 나왔는가?](why-postgresql.md) | INGRES의 한계, POSTGRES의 설계 목표, object-relational 접근과 현대 extension의 연결 |
| [PostgreSQL·MySQL 역사 타임라인](history-timeline.md) | 관계형 모델부터 PostgreSQL·MySQL·MyISAM·InnoDB·MariaDB·Oracle 소유권까지 구분한 계보 |
| [PowerPoint](presentation/postgresql-history-complete.pptx) | 역사·설계 철학·기술 계보를 정리한 27장 발표자료 |
| [PDF](presentation/postgresql-history-complete.pdf) | 배포·열람용 27장 발표자료 |
| [발표 대본](presentation/speaker-notes.md) | 슬라이드별 설명과 24개 출처 |
| [전체 미리보기](presentation/preview-contact-sheet.png) | 27장 전체 흐름을 한 화면에서 확인하는 콘택트시트 |
| [스토리보드](presentation/storyboard.md) | 슬라이드별 질문·핵심 내용·시각 구조 |
| [출처 원장](presentation/citations.json) | 발표자료에서 사용한 출처의 URL과 확인일 |

## 핵심 결론

1. **INGRES → POSTGRES는 단순 버전업이 아니다.** 같은 Berkeley 연구 계보에서 확장성을 중심으로 새로 설계한 후속 시스템이다.
2. **POSTGRES → Postgres95 → PostgreSQL은 직접적인 코드·제품 계보다.** Postgres95는 기존 확장성을 유지하면서 PostQUEL을 SQL로 바꾸고 코드를 정리한 전환점이다.
3. **PostgreSQL의 extension은 갑자기 붙은 패키지 기능이 아니다.** 사용자 정의 타입·함수·연산자·인덱스 방식을 코어 수정 없이 추가하려던 초기 설계 철학의 현대적 패키징이다.
4. **MySQL의 제품·엔진·소유권 계보는 서로 다른 축이다.** `MySQL → MariaDB`, `ISAM → MyISAM`, `Innobase Oy → InnoDB`, `MySQL AB → Sun → Oracle`을 한 줄 계보로 합치면 안 된다.
5. 역사적 출발점은 현재 구조를 이해하는 단서이지, 현대 PostgreSQL과 MySQL의 성능이나 우열을 자동으로 결정하는 근거가 아니다.

## 발표 범위

### 포함

- 관계형 모델과 초기 RDBMS
- IBM System R와 Berkeley INGRES
- POSTGRES의 등장 배경과 object-relational 설계
- 사용자 정의 타입·함수·연산자·인덱스·operator class
- rule·trigger와 코어·extension 경계
- POSTGRES 4.2, Postgres95, PostgreSQL의 공개·커뮤니티 계보
- MySQL의 ISAM·mSQL 출발과 MyISAM·InnoDB·MariaDB 계보
- Oracle·Sun·MySQL AB·Innobase Oy의 소유권 변화

### 후속 학습으로 분리

- PostgreSQL·MySQL의 database/schema 구조
- 프로세스·스레드 모델
- MVCC와 트랜잭션 격리 수준
- PostgreSQL VACUUM과 InnoDB undo/purge
- WAL·redo·undo·binlog
- 복제·백업·운영 및 선택 기준

## 공개 기준

인증 정보·비밀값은 보존하지 않는다. 원문에 관련 값이 있었다면 `[REDACTED]`로 대체한다.

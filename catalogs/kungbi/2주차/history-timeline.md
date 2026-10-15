# PostgreSQL과 MySQL 역사 타임라인

## RDBMS는 어디에서 시작됐나?

하나만 고르면 **관계형 모델은 IBM에서 먼저 나왔다.** IBM San Jose Research Lab의 Edgar F. Codd가 1970년 관계형 모델을 논문으로 제안했다.[9]

다만 실제 RDBMS 구현은 1973년경 두 곳에서 거의 동시에 진행됐다.

- **IBM System R**: Codd의 이론을 실제 산업 수준으로 구현하고 SQL과 cost-based optimizer의 기반을 만듦[9]
- **UC Berkeley INGRES**: 1973년 시작해 1976년 공개된 완전한 관계형 DBMS 구현. 이후 POSTGRES와 PostgreSQL로 이어짐[10]

따라서 질문에 따라 답이 달라진다.

| 질문 | 답 |
| --- | --- |
| 관계형 모델을 처음 제안한 곳 | **IBM**, Edgar F. Codd, 1970년 |
| 초기 RDBMS 연구 구현 | **IBM System R**와 **UC Berkeley INGRES**, 1973년경 병행 |
| PostgreSQL의 직접 조상 | **UC Berkeley INGRES** |
| 최초의 상용 SQL 기반 RDBMS | **Oracle V2**, 1979년[11] |

## 먼저 구분할 세 가지 흐름

```text
[관계형 모델과 제품의 역사]
IBM Codd의 관계형 모델 (1970)
  ├─ 연구 구현 → IBM System R (1973)
  │                └─ 연구 결과가 제품화에 영향 → IBM DB2 (1983)
  ├─ 병렬 연구 → UC Berkeley INGRES (1973)
  │                └─ 새 후속 프로젝트 → POSTGRES → Postgres95 → PostgreSQL
  └─ 별도 상용화 → Oracle V2 (1979) → Oracle Database

[MySQL 스토리지 엔진 계보]
옛 ISAM 엔진 → MyISAM
                ↘ 별도로 도입된 InnoDB → 기본 엔진

[MySQL 제품의 소유권 변화]
MySQL AB ──인수──▶ Sun Microsystems ──인수──▶ Oracle
            2008                         2010
```

> **정정:** `MyISAM → InnoDB`를 같은 엔진의 개선판처럼 보면 안 된다. InnoDB는 MyISAM을 고쳐 만든 후속판이 아니라, MySQL에 별도로 들어온 트랜잭션 스토리지 엔진이다. 이후 MySQL의 기본 엔진이 MyISAM에서 InnoDB로 바뀐 것이다.[6][8]

## 소유권과 기술 계보는 다르다

- **Oracle Database**: Oracle이 1979년 Oracle V2부터 발전시켜 온 자체 RDBMS 제품이다.[11]
- **MySQL**: MySQL AB의 별도 제품이다. 2008년 Sun이 MySQL AB를 인수했고, 2010년 Oracle이 Sun을 인수하면서 Oracle 산하 제품이 됐다.[12][14]
- **PostgreSQL**: 특정 회사 소유가 아니다. 여러 개인과 회사가 함께 코드를 공유·개발하는 커뮤니티 프로젝트다.[16]

따라서 `Oracle Database → MySQL`이라는 기술 계보는 없다. 현재 두 DB가 같은 Oracle 산하에 있을 뿐, 서로 다른 코드베이스와 제품 계보를 유지한다.

## 한눈에 보는 타임라인

| 시기 | IBM·Oracle과 RDBMS 산업 | PostgreSQL 계보 | MySQL·InnoDB와 소유권 |
| --- | --- | --- | --- |
| 1970 | IBM의 Edgar F. Codd가 **관계형 모델** 제안[9] | - | - |
| 1973 | IBM이 관계형 모델을 검증하는 **System R** 프로젝트 시작[9] | UC Berkeley가 **INGRES** 프로젝트 시작[10] | - |
| 1976 | - | UC Berkeley가 완전한 관계형 DBMS **INGRES** 공개[10] | - |
| 1977 | Larry Ellison, Bob Miner, Ed Oates가 Oracle의 전신인 **Software Development Laboratories** 설립[11] | - | - |
| 1978~1980년대 중반 | - | INGRES에 분산 DB, 추상 데이터 타입 등 여러 기능을 실험적으로 추가 | - |
| 1979 | 최초의 상용 SQL 기반 RDBMS **Oracle V2** 출시[11] | - | - |
| 1983 | IBM **DB2** 최초 출하. Oracle의 전신 RSI는 **Oracle Systems Corporation**으로 사명 변경[9][11] | - | - |
| 1986 | - | INGRES를 계속 고치기 어려워 새 후속 시스템 **POSTGRES** 구현 시작[1] | - |
| 1987 | - | POSTGRES 최초 데모 시스템 가동[2] | - |
| 1989 | - | POSTGRES Version 1을 외부 사용자에게 배포[2] | - |
| 1991 | - | Version 3: 여러 storage manager, 개선된 query executor, 새 rule system[2] | - |
| 1994 | - | SQL 인터프리터를 추가한 **Postgres95** 시작[2] | 자체 ISAM 루틴에 mSQL을 연결하려다 성능·유연성이 부족해 새로운 SQL 인터페이스 개발[3] |
| 1995 | - | Postgres95가 오픈소스로 확산 | 스웨덴에서 **MySQL AB** 설립, MySQL 제품화[4][12] |
| 1996 | - | 프로젝트 이름을 **PostgreSQL**로 변경[2] | 초기 MySQL은 단순하고 빠른 데이터 접근에 집중 |
| MySQL 3.23 세대 | - | - | **MyISAM**과 트랜잭션·행 잠금을 지원하는 **InnoDB**가 서로 다른 스토리지 엔진으로 제공됨[6] |
| 2005 | Oracle이 InnoDB 개발사 **Innobase Oy** 인수[15] | - | MySQL AB는 아직 독립 회사였고, Oracle은 MySQL 서버가 아닌 InnoDB 개발사를 먼저 인수 |
| 2008 | - | - | **Sun Microsystems가 MySQL AB 인수**[12][15] |
| 2009 | Oracle이 Sun 인수 계약 발표[13] | - | 일부 원 개발자들이 **MariaDB** 개발을 시작하며 별도 가지가 생김[15] |
| 2010-01-26 | **Oracle이 Sun 인수 완료**[14] | - | Sun이 보유하던 MySQL이 Oracle 산하로 이동[12][14] |
| MySQL 5.5 이후 | - | - | 신규 테이블의 기본 엔진이 **MyISAM에서 InnoDB로 변경**[8][12] |
| 현대 | Oracle은 Oracle Database와 MySQL을 서로 다른 제품으로 제공 | 특정 회사 소유가 아닌 커뮤니티 프로젝트로 개발[16] | Oracle이 MySQL을 소유한다. InnoDB가 기본 엔진이고 MyISAM도 별도 엔진으로 남아 있다.[5][7][16] |

### 회사부터 구분하기

| 회사 | 당시 만들거나 보유한 것 |
| --- | --- |
| **Oracle** | Oracle Database를 개발하던 별도 기업 |
| **Sun Microsystems** | Java·Solaris와 컴퓨터 시스템을 개발하던 별도 기업[13] |
| **MySQL AB** | MySQL Server를 개발·사업화하던 기업[4][12] |
| **Innobase Oy** | MySQL에서 사용할 수 있는 InnoDB 스토리지 엔진을 개발한 기업[15] |

Oracle과 Sun은 원래 서로 다른 회사였다. Sun이 먼저 MySQL AB를 인수했고, 이후 Oracle이 **MySQL만 산 것이 아니라 Sun 회사 전체를 인수**했다.[12][13][14]

### MySQL AB가 InnoDB를 직접 만든 것이 아니다

MySQL은 SQL 처리 부분과 실제 데이터 저장 부분을 여러 **스토리지 엔진**으로 나눌 수 있는 구조다.[8]

```text
MySQL Server
├─ SQL 해석·실행, 접속 처리 등
└─ 스토리지 엔진을 선택해서 사용
   ├─ MyISAM: 기존 MySQL ISAM 계열
   └─ InnoDB: Innobase Oy가 별도로 개발
```

즉, **MySQL AB가 만든 MySQL 서버 안에 다른 회사 Innobase Oy가 만든 InnoDB를 연결해서 사용**한 것이다. MySQL 3.23 세대에는 MyISAM과 InnoDB가 선택 가능한 서로 다른 엔진으로 함께 제공됐다.[6][15]

### 인수 순서

```text
2005
Oracle ──인수──▶ Innobase Oy
                  └─ InnoDB 개발사

2008
Sun Microsystems ──인수──▶ MySQL AB
                              └─ MySQL Server 개발사

2010
Oracle ──인수──▶ Sun Microsystems
                  └─ 이미 MySQL AB를 보유
```

최종적으로 2010년 이후에는 다음 구조가 됐다.

```text
Oracle
├─ Oracle Database: 원래부터 Oracle이 개발한 별도 RDBMS
├─ InnoDB: 2005년 Innobase Oy 인수를 통해 확보
└─ MySQL Server: 2010년 Sun 인수를 통해 확보
```

따라서 사용자가 정리한 순서를 정확히 쓰면 다음과 같다.

1. **Oracle이 Innobase Oy를 인수**한다. (2005)
2. **Sun이 MySQL AB를 인수**한다. (2008)
3. **Oracle이 Sun을 인수**한다. (계약 발표 2009, 완료 2010)

결과적으로 Oracle은 Sun 인수를 통해 **MySQL 서버 개발사를 보유**하게 됐다.[12][13][14]

InnoDB 개발사는 그보다 앞선 별도의 인수를 통해 보유했다.[15]

POSTGRES의 1986년 시작부터 PostgreSQL이라는 이름을 사용한 1996년까지의 흐름은 PostgreSQL 공식 역사에 기록돼 있다.[1][2]

## PostgreSQL 계보

```text
INGRES
  │  관계형 DB의 가능성을 검증
  │  하지만 새로운 기능을 계속 붙이기 어려워짐
  ▼
POSTGRES (1986)
  │  복잡한 객체
  │  사용자 정의 타입·연산자·접근 방식
  │  rule·trigger
  │  관계형 모델 유지
  ▼
Postgres95 (1994)
  │  PostQUEL을 SQL로 교체
  ▼
PostgreSQL (1996)
     POSTGRES 계보 + SQL
```

### INGRES의 출발 철학

INGRES의 핵심 목표는 **관계형 모델을 실제로 사용할 수 있는 다중 사용자 DBMS로 구현하는 것**이었다.[18]

1. **논리와 물리의 분리**: 사용자는 데이터가 디스크에 어떻게 저장됐는지 몰라도 관계 형태로 다룰 수 있어야 한다.
2. **선언적 질의**: QUEL 같은 비절차적 언어로 `어떻게 찾을지`가 아니라 `무엇을 원하는지` 표현한다.
3. **DBMS가 실행 방법을 결정**: 사용자가 저장 구조와 탐색 알고리즘을 직접 지정하지 않고 DBMS가 접근 방법과 질의 처리를 담당한다.
4. **이론을 현실적인 시스템으로 검증**: UNIX와 C 위에서 동작하는 실제 다중 사용자 시스템으로 관계형 모델의 실용성을 보여 준다.[18]

즉 INGRES는 처음부터 PostgreSQL처럼 사용자 정의 타입과 연산자 확장을 중심에 둔 시스템은 아니었다. **관계형 모델·데이터 독립성·선언적 질의**가 먼저였고, 이후 INGRES에서 여러 확장 기능을 실험한 경험이 POSTGRES의 확장 가능한 구조로 이어졌다.[1][18]

### 누가 만들었나?

- **INGRES**: UC Berkeley의 Michael Stonebraker와 Eugene Wong이 시작한 연구팀이 만들었다.[17]
- **POSTGRES**: 같은 UC Berkeley에서 Michael Stonebraker 교수가 이끈 연구팀이 만들었다. 최초 설계 논문의 저자는 Michael Stonebraker와 Lawrence A. Rowe다.[1][2]
- **Postgres95**: 1994년 Andrew Yu와 Jolly Chen이 POSTGRES에 SQL 인터프리터를 추가했다.[2]
- **PostgreSQL**: 1996년 이후 특정 개인이나 회사의 단독 제품이 아니라 오픈소스 커뮤니티가 함께 발전시키고 있다.[2][16]

즉, INGRES와 POSTGRES의 중심에는 모두 Michael Stonebraker가 있었다. 다만 `INGRES → POSTGRES`는 기존 제품의 단순 업그레이드가 아니라, 같은 Berkeley 계보에서 새 목표로 다시 설계한 후속 연구 프로젝트다.[1][17]

### 핵심 변화

- `INGRES → POSTGRES`: 기존 코드 개선이 아니라 새로운 확장형 DBMS를 다시 설계
- `POSTGRES → Postgres95`: 핵심 DB 계보는 유지하면서 SQL 인터프리터 도입
- `Postgres95 → PostgreSQL`: 이름과 버전 체계를 정리하고 오픈소스 프로젝트로 발전

## MySQL과 스토리지 엔진 계보

```text
자체 저수준 ISAM 루틴
  │
  ├─ mSQL을 SQL 인터페이스로 사용하려 함
  │    └─ 요구한 속도·유연성을 충족하지 못함
  │
  ▼
MySQL
  │  새로운 SQL 인터페이스
  │  mSQL과 비슷한 API로 이전 편의 제공
  ▼
초기 ISAM 스토리지 엔진
  │
  ▼
MyISAM
     SQL에 맞게 개선
     큰 파일·인덱스·검색·복구 도구 강화
```

MySQL은 mSQL의 포크가 아니라, mSQL로 해결하려던 문제를 자체 SQL 인터페이스로 다시 구현한 시스템이다.[3]

### InnoDB는 별도 가지

```text
MySQL Server
  ├─ MyISAM: 단순·비트랜잭션·테이블 잠금
  ├─ InnoDB: 트랜잭션·MVCC·행 잠금·외래 키
  └─ 그 밖의 storage engine
```

MySQL은 SQL 처리와 실제 저장을 스토리지 엔진으로 분리한다. 따라서 MyISAM과 InnoDB는 같은 MySQL Server 아래에서 선택 가능한 서로 다른 저장 구현이었다.

```text
ISAM → MyISAM
```

은 **직접적인 개선 계보**지만,

```text
MyISAM → InnoDB
```

는 **직접적인 코드 계보가 아니라 기본 엔진의 세대교체**를 나타낸다.

## 가장 짧은 기억법

```text
PostgreSQL 쪽
INGRES를 더 확장하기 어려움
→ POSTGRES를 새로 설계
→ SQL을 붙여 PostgreSQL

MySQL 쪽
자체 ISAM 데이터에 mSQL을 붙이려 함
→ 부족해서 MySQL을 만듦
→ ISAM을 개선해 MyISAM
→ 별도 트랜잭션 엔진 InnoDB가 기본이 됨

소유권
MySQL AB → Sun → Oracle
PostgreSQL → 특정 회사 소유가 아닌 커뮤니티 프로젝트
```

## Sources

[1] https://dsf.berkeley.edu/papers/ERL-M85-95.pdf — The Design of POSTGRES
[2] https://www.postgresql.org/docs/current/history.html — A Brief History of PostgreSQL
[3] https://dev.mysql.com/doc/refman/8.0/en/history.html — History of MySQL
[4] https://planet.mysql.com/entry?id=23788 — The history of MySQL AB
[5] https://dev.mysql.com/doc/refman/9.2/en/myisam-storage-engine.html — The MyISAM Storage Engine
[6] http://dev.cs.ovgu.de/db/mysql/News-3.23.x.html — MySQL 3.23 Change History (archive)
[7] https://dev.mysql.com/doc/refman/8.4/en/optimizing-myisam.html — Optimizing for MyISAM Tables
[8] https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/mysql-8.4-en.pdf — MySQL 8.4 Reference Manual
[9] https://www.ibm.com/history/relational-database — The relational database - IBM
[10] https://dsf.berkeley.edu/papers/ERL/erl95.html — Database Management - Berkeley
[11] https://docs.oracle.com/cd/E11882_01/server.112/e40540/intro.htm — Introduction to Oracle Database
[12] http://www.oracle.com/technetwork/community/developer-day/keynotemysql-485889.pdf — MySQL Essentials - Oracle
[13] https://www.oracle.com/corporate/pressrelease/oracle-buys-sun-042009.html — Oracle Buys Sun
[14] https://investor.oracle.com/investor-news/news-details/2010/Oracle-Reports-GAAP-EPS-Of-023-Non-GAAP-EPS-Of-038/default.aspx — Oracle Reports Q3 FY2010 Results
[15] https://mariadb.org/wp-content/uploads/2019/11/MySQL-MariaDB-story.pdf — MySQL-MariaDB History
[16] https://www.postgresql.org/about/press/faq — PostgreSQL Frequently Asked Questions
[17] https://eecs.berkeley.edu/news/mike-stonebraker-wins-2020-cc-prize — Mike Stonebraker wins 2020 C&C Prize - Berkeley EECS
[18] https://dl.acm.org/doi/10.1145/320473.320476 — The Design and Implementation of INGRES

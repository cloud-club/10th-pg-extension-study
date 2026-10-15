# PostgreSQL Extension 조사 노트

이번 주에는 PostgreSQL에서 기본 기능 외에 추가 기능을 제공하는 **Extension 구조와 주요 활용 사례**를 조사했습니다.

성능 진단·검색·자동화·벡터 검색 같은 문제가 생겼을 때  
**“이 문제를 Extension으로 해결할 수 있는가?”** 를 판단할 수 있도록 생태계를 정리하는 것이 목적입니다.

---

## 1. Core vs Extension

PostgreSQL의 `JSONB`, `ARRAY`, Full-text Search, B-Tree/GIN/GiST 등은 **Core** 기능입니다.

반면 아래는 Extension으로 붙입니다.

| 영역 | Extension 예시 | 용도 |
| --- | --- | --- |
| 성능 진단 | `pg_stat_statements` | SQL 호출 횟수·실행시간 누적 통계 |
| 성능 진단 | `auto_explain` | 느린 쿼리 실행 계획 자동 기록 |
| 인덱스 분석 | `HypoPG` | 가상 인덱스로 효과 사전 확인 |
| 자동화 | `pg_cron` | DB 내부 주기적 SQL 실행 |
| 파티셔닝 | `pg_partman` | 파티션 생성·관리 자동화 |
| 검색 | `pg_trgm` | 부분·유사 문자열 검색 |
| 검색 | `unaccent` | 검색 문자열 정규화 |
| 벡터 | `pgvector` | Embedding 저장·유사도 검색 |
| 공간정보 | `PostGIS` | 위치·거리·공간 데이터 |
| 시계열 | `TimescaleDB` | 시계열 저장·조회 최적화 |
| 보안 | `pgAudit` | DB 감사 로그 |
| CDC | `wal2json` | WAL 기반 변경 데이터 추출 |

Extension은 함수·연산자·타입·인덱스 접근 방식을 DB 내부 기능처럼 추가합니다.  
`contrib` 로 함께 제공되는 것과, PostGIS·pgvector처럼 별도 프로젝트인 것이 있습니다.

---

## 2. `CREATE EXTENSION` 의 의미

외부 프로그램을 다운로드하는 명령이 아닙니다.  
**서버에 이미 설치된 Extension 파일을 현재 Database에 등록**하는 과정에 가깝습니다.

```sql
CREATE EXTENSION pg_trgm;
```

- DB마다 등록이 필요함 (서버 전체 공유 X)
- Trusted Extension / 높은 권한이 필요한 Extension 구분 존재

```sql
-- 설치 가능 목록
SELECT * FROM pg_available_extensions ORDER BY name;

-- 현재 DB에 설치된 목록
SELECT extname, extversion FROM pg_extension ORDER BY extname;

-- 버전·권한·의존성까지
SELECT * FROM pg_available_extension_versions ORDER BY name, version;
```

---

## 3. `shared_preload_libraries` 가 필요한 경우

모든 Extension이 `CREATE EXTENSION` 만으로 동작하지는 않습니다.

Shared Memory 확보나 Background Worker 등록이 필요하면 서버 시작 시 preload가 필요합니다.

```
shared_preload_libraries = 'pg_stat_statements'
```

설정 변경 후 **재시작**이 필요합니다.  
조사 체크리스트:

- [ ] `CREATE EXTENSION` 만으로 되나
- [ ] 서버 설정이 필요한가
- [ ] 재시작이 필요한가
- [ ] Managed PostgreSQL에서 지원하는가

---

## 4. Managed PostgreSQL 차이

RDS / Aurora / Supabase / Neon / Cloud SQL 은 OS에 Extension을 직접 설치할 수 없습니다.  
**제공자가 열어 둔 Extension만** 사용 가능합니다.

`pg_stat_statements` 는 주요 Managed 서비스에서 대체로 지원합니다.  
상세 표는 [../catalogs/pg_stat_statements.md](../catalogs/pg_stat_statements.md) 

---

## 5. 문제 → 후보 Extension

기능명보다 **문제 상황**으로 기억하는 편이 활용하기 좋습니다.

```
SQL이 전체적으로 느린 것 같다
        → pg_stat_statements
        → 어떤 SQL이 DB 시간을 많이 쓰는지

특정 쿼리가 왜 느린지 보고 싶다
        → EXPLAIN ANALYZE / auto_explain

인덱스를 추가하면 빨라질지 확인하고 싶다
        → HypoPG

LIKE '%keyword%' 검색이 느리다
        → pg_trgm

주기적으로 SQL 작업을 실행하고 싶다
        → pg_cron

Embedding 기반 의미 검색이 필요하다
        → pgvector

위치 / 거리 검색이 필요하다
        → PostGIS
```

---

## 6. 이번 주 심화 후보

첫 심화: **`pg_stat_statements`**  
→ [../catalogs/pg_stat_statements.md](../catalogs/pg_stat_statements.md)

이후 후보: `pg_trgm`, `pg_cron`, `pgvector` (서로 다른 영역으로 카탈로그 확장)

---

## 이번 주 정리

- Extension = 문제 해결 수단으로 보는 기준 정리
- `CREATE EXTENSION` / contrib vs 외부 / preload / Managed 제약 확인
- 심화 1순위: `pg_stat_statements`

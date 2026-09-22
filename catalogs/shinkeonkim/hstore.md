# hstore

> 한 컬럼에 문자열 키-값 묶음을 저장하고 `->` `@>` `?` `||` 연산자와 GIN 인덱스로 조회하는 PostgreSQL contrib 확장이다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 데이터 타입 · 키-값 |
| 검증 환경 | PostgreSQL 16.15 · hstore 1.8 (Redis 비교는 Redis 7.4) |
| 라이선스 | PostgreSQL License (PostgreSQL 본체의 contrib 모듈) |
| 저장소 · 문서 | [postgres/postgres · contrib/hstore](https://github.com/postgres/postgres/tree/REL_16_15/contrib/hstore) · [PostgreSQL 16 문서](https://www.postgresql.org/docs/16/hstore.html) |
| 정리한 사람 | shinkeonkim |
| 회차 | week04 |

---

## 1. Before / After - 없으면 뭐가 불편한가

상품 종류마다 속성이 다르다. 열을 늘리면 `NULL`투성이 넓은 테이블이 되고, EAV(속성 하나 = 행 하나)는 조인이 늘고 크기가 커진다.

**Before (EAV)**

```sql
CREATE TABLE product_attr (product_id int, k text, v text, PRIMARY KEY (product_id, k));
SELECT product_id FROM product_attr WHERE k = 'color' AND v = 'red';
```

**After (hstore)**

```sql
CREATE EXTENSION hstore;
CREATE TABLE product (id serial PRIMARY KEY, name text, attrs hstore NOT NULL DEFAULT '');
CREATE INDEX ON product USING gin (attrs);
SELECT name FROM product WHERE attrs @> 'color=>red';
```

같은 데이터를 저장했을 때 EAV는 hstore의 3~7배를 썼다(키 100개 이상, 실험 01).

## 2. 설치 & 데모

`shared_preload_libraries`나 재시작이 필요 없다. trusted 확장이라 DB `CREATE` 권한이면 설치할 수 있다.

```sql
CREATE EXTENSION hstore;
SELECT 'a=>1, b=>2'::hstore -> 'a';                     -- '1' (값은 text)
SELECT attrs || 'color=>blue' FROM product WHERE id = 1; -- 합치기, 오른쪽이 이긴다
SELECT attrs['color'] FROM product;                      -- 첨자 (hstore 1.8 · PG 14+)
```

키를 지울 때는 `attrs - 'k'::text`다. 따옴표만 있는 리터럴은 hstore로 해석돼 오류가 난다.

## 3. 트레이드오프 - 언제 쓰고 언제 피하나

| | |
| --- | --- |
| 이럴 때 쓴다 | 작고 평평한 문자열 속성 묶음(키 수십 개 이하), 부가 속성, 태그, 설정·플래그. `@>`·`?` 조회 |
| 이럴 때는 피한다 | 숫자·불리언·중첩이 필요(→ jsonb), 자주 필터·정렬하는 핵심 속성(→ 열), 키가 수백 개이거나 자주 바뀌는 큰 맵, 한 행에 몰리는 카운터, 필드 TTL(→ Redis) |
| 비용 | 키 하나를 바꿔도 값 전체를 다시 쓴다: 키 500개에서 UPDATE 1건 WAL 15.8KB(EAV 176B), GIN이 있으면 113.6KB. 키 100개 이상에서 jsonb보다 덜 압축된다 |
| 대안 | 속성별 열 · jsonb · EAV · Redis 해시 |

동시성: 잠금 단위는 행이다. 앱에서 읽어 합친 값을 통째로 쓰면 유실된다(400건 중 남은 키 51~76개). `SET attrs = attrs || …`와 `FOR UPDATE`는 10회 모두 유실 0이다.

## 4. 매니지드 DB 지원 여부

| 서비스 | 지원 | 비고 |
| --- | --- | --- |
| AWS RDS | ○ | PG 16~19에서 hstore 1.8 |
| AWS Aurora | 확인 못 함 | RDS 표와 호환이지만 별도 확인하지 않았다 |
| Supabase | 확인 못 함 | 공식 문서에서 hstore를 찾지 못했다 |
| Neon | ○ | PG 16·17에서 1.8 |
| GCP Cloud SQL | ○ | PG 14 이상 1.8 |
| Azure | ○ | PG 14~18에서 1.8 |

<sub>2026-09-21 확인. `shared_preload_libraries`가 필요 없어 매니지드에서 막히는 경우가 드물다.</sub>

---

## 5. 내부 동작 원리

값 하나는 varlena다: `[헤더][size_: 쌍 개수·플래그][HEntry × 2·쌍][문자열 영역]`. 키는 **(길이, 바이트) 순**으로 정렬해 저장하고 이진 탐색으로 찾는다. HEntry는 길이가 아니라 **문자열 영역 안의 끝 위치**(+ISFIRST·ISNULL 비트)를 담는다. 디스크 바이트를 `pageinspect`로 직접 해독해 확인했다(lab 02). 이 끝 위치 배열이 jsonb(길이 저장)보다 압축이 안 되는 원인이다. GIN은 키를 `K`, 값을 `V`, NULL을 `N` 항목으로 따로 색인하므로 `@>`는 힙에서 재검사한다.

## 6. 벤치마크 / 실습 결과

PostgreSQL 16.15 · Docker(공유 CPU 3개). 상대 비교로 읽는다.

| 조건 | 결과 |
| --- | --- |
| 키 5·20개 한 행의 크기 | hstore = jsonb (바이트까지 같음) |
| 키 500개(값 종류 적음) 한 행의 크기 | hstore 10,027B vs jsonb 1,943B (실험 01, 3회) |
| 20만 행 · 희귀 값 포함 조회 | 순차 13.5ms → GIN 0.9ms. GiST(siglen 16)는 20.2ms로 순차보다 느림 (실험 03, 5회) |
| GIN vs GiST(16) vs btree 식 크기 | 71.9MB · 10.4MB · 1.4MB |
| 동시성: 읽고-쓰기 vs 원자적 `\|\|` (400건) | 남은 키 62.5개(51~70) vs 400 (실험 04, 10회) |
| Redis 대비 쓰기 (클라이언트 8) | 영속화 없음 Redis 2.4배, 엄격한 내구성에서는 hstore 3.2배 (실험 05, 5회) |

---

## 참고 링크

- 웹 학습 자료: `web/#/hstore/about`
- [Docker 실습](week04/hstore/labs/README.md) · [반복 실험](week04/hstore/experiments/README.md)
- [PostgreSQL 16 hstore 문서](https://www.postgresql.org/docs/16/hstore.html) · [contrib/hstore (REL_16_15)](https://github.com/postgres/postgres/tree/REL_16_15/contrib/hstore)
- [Citus · Hstore vs. JSON vs. JSONB](https://www.citusdata.com/blog/2016/07/14/choosing-nosql-hstore-json-jsonb/)
- [Redis hashes](https://redis.io/docs/latest/develop/data-types/hashes/) · [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)

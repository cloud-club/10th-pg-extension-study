# 2주차 PG

[https://www.postgresql.org/docs/18/index.html](https://www.postgresql.org/docs/18/index.html)

**pg_stat_statements**로 느린 쿼리를 찾고 → **auto_explain**으로 그게 어떤 계획으로 도는지 잡고 → **HypoPG**로 인덱스를 만들면 나아질지 미리 실험하고 → 옵티마이저가 여전히 나쁜 계획을 고집하면 **pg_hint_plan**으로 강제하는 흐름

## hypopg

> 실제로 만들지 않는 "가상 인덱스"로, 인덱스를 만들면 쿼리가 빨라질지를 자원 소모 없이 EXPLAIN으로 미리 확인해주는 확장.

| 항목 | 내용 |
|---|---|
| 카테고리 | 성능 진단 (인덱스 튜닝) |
| 버전 | 1.4.3 (2026-06, PostgreSQL 9.2 ~ 19 지원) |
| 라이선스 | PostgreSQL License |
| 저장소 · 문서 | 저장소 [https://github.com/HypoPG/hypopg](https://github.com/HypoPG/hypopg) · 매뉴얼 [https://hypopg.readthedocs.io/](https://hypopg.readthedocs.io/) |
| 정리한 사람 | 전승민 |
| 회차 | week02 |

---

### 1. Before / After — 없으면 뭐가 불편한가

인덱스 하나가 특정 쿼리에 도움이 될지 확인하려면, 원래는 **진짜 인덱스를 만들어봐야** 함.

그런데 큰 테이블에 `CREATE INDEX`를 걸면 빌드하는 동안 CPU·디스크·시간 등 실제 리소스를 소모하고, 프로덕션이라면 락과 부하까지 감수해야 함. 즉, 비용이 매우 큼

HypoPG는 이 실험을 **자원 사용량을 0으로** 만들어줌

**Before** — 진짜 인덱스를 만들어서 확인 (자원·시간 소모)

```sql
-- 인덱스가 없을 때: 순차 스캔
EXPLAIN SELECT val FROM hypo WHERE id = 1;
--  Seq Scan on hypo  (cost=0.00..1791.00 rows=1 width=14)
--    Filter: (id = 1)

-- 효과를 보려면 실제로 만들어야 한다 (큰 테이블이면 오래 걸리고 자원을 씀)
CREATE INDEX ON hypo (id);
EXPLAIN SELECT val FROM hypo WHERE id = 1;

-- 효과가 없거나 아니다 싶으면 다시 지운다
DROP INDEX hypo_id_idx;
```

> EXPLAIN: 쿼리를 실제로 실행해서 데이터를 가져오는 게 아니라, PostgreSQL의 쿼리 처리에 대한 계획서를 나타냄, 읽는 순서를 seq할지, 아니면 index만 읽을지 이런거를 지정하기 위해서…
> cost는 시간(초)이 아니라 PostgreSQL 내부의 **추상적인 비용 단위**. 기준점은 "디스크 페이지 하나를 순차적으로 읽는 비용 = 1.0"
> 즉, 1791.00은 "대략 페이지 1791개어치 읽는 정도의 일"이라는 뜻
> width = 예상되는 행의 크기 (byte 단위)

**After** — 가상 인덱스로 확인

```sql
-- 가상 인덱스 생성: 표준 CREATE INDEX 문을 그대로 함수에 넘김
SELECT * FROM hypopg_create_index('CREATE INDEX ON hypo (id)');
--  indexrelid |      indexname
-- ------------+----------------------
--       18284 | <18284>btree_hypo_id

-- EXPLAIN을 다시 뜨면, 플래너가 이 가상 인덱스를 쓸지 알려줌
EXPLAIN SELECT val FROM hypo WHERE id = 1;
--  Index Scan using <18284>btree_hypo_id on hypo  (cost=0.04..8.06 rows=1 width=10)
--    Index Cond: (id = 1)
```

cost가 `1791.00 → 8.06`으로 떨어지는 걸 확인했으니, 이 인덱스는 만들 가치가 있음.

(실제 디스크에는 아무것도 쓰지 않음)

### 2. 설치 & 데모

가상 인덱스는 어떤 카탈로그에도 저장되지 않고 현재 연결의 개인 메모리에만 존재하므로, 테이블을 부풀리지 않고 동시 접속에도 영향을 주지 않음

 그리고 가상 인덱스는 `EXPLAIN`에서만 쓰이고 `EXPLAIN ANALYZE`(실제 실행)에서는 무시됨

```sql
CREATE EXTENSION hypopg;
```

```sql
-- 실습용 테이블 (인덱스 없음)
CREATE TABLE hypo (id integer, val text);
INSERT INTO hypo SELECT i, 'line ' || i FROM generate_series(1, 100000) i;
VACUUM ANALYZE hypo;

-- 1) 현재는 순차 스캔
EXPLAIN SELECT val FROM hypo WHERE id = 1;
--  Seq Scan on hypo  (cost=0.00..1791.00 rows=1 width=14)

-- 2) 가상 인덱스 생성
SELECT * FROM hypopg_create_index('CREATE INDEX ON hypo (id)');

-- 3) 플래너가 쓸지 확인 → Index Scan으로 바뀜 (cost 급감)
EXPLAIN SELECT val FROM hypo WHERE id = 1;
--  Index Scan using <18284>btree_hypo_id on hypo  (cost=0.04..8.06 rows=1 width=10)

-- 4) 실제 실행(ANALYZE)에서는 가상 인덱스가 무시됨 → 다시 Seq Scan
EXPLAIN ANALYZE SELECT val FROM hypo WHERE id = 1;
--  Seq Scan on hypo  (cost=0.00..1791.00 ...) (actual time=0.046..46.390 rows=1 loops=1)

-- 5) 인덱스가 차지할 예상 크기까지 추정 가능
SELECT index_name, pg_size_pretty(hypopg_relation_size(indexrelid))
  FROM hypopg_list_indexes;
--  <18284>btree_hypo_id | 2544 kB

-- 6) 정리
SELECT hypopg_reset();   -- 모든 가상 인덱스 제거
```

**주요 함수/뷰**

- `hypopg_create_index('CREATE INDEX ...')` : 가상 인덱스 생성
- `hypopg_list_indexes` (뷰) : 생성된 가상 인덱스 목록
- `hypopg_relation_size(oid)` : 가상 인덱스의 예상 크기 추정
- `hypopg_get_indexdef(oid)` : 그 가상 인덱스를 만드는 CREATE INDEX 문 출력
- `hypopg_drop_index(oid)` / `hypopg_reset()` : 개별 / 전체 제거
- `hypopg_hide_index(oid)` : **기존 실제 인덱스를 EXPLAIN에서 숨김** — "이 인덱스를 지우면 플래너가 뭘 쓸까"를 실험 (지원 접근 방식: btree, brin, hash, bloom)

### 3. 트레이드오프 — 언제 쓰고 언제 피하나

|  |  |
|---|---|
| 이럴 때 쓴다 | 최적화할 쿼리를 이미 알고, 어떤 인덱스를 시도할지 후보가 있을 때. 큰 테이블에 실제 인덱스를 만들기 전 사전 검증. 기존 인덱스를 숨겨도 되나 싶을때(`hypopg_hide_index`) "이거 지워도 되나" 판단할 때 |
| 이럴 때는 피한다 | "인덱스가 **실제로** 얼마나 빨라지나"를 시간(ms)으로 측정하고 싶을 때. 가상 인덱스는 플래너의 **비용 추정**만 바꿀 뿐 실행 시간은 재지 못함.  |
| 비용 | 거의 없음. 가상 인덱스는 연결 개인 메모리에만 저장 → 디스크·쓰기 성능·동시성에 영향 없음. `shared_preload_libraries(미리 불러와서 백그라운드에 필요한 확장들)` 불필요, 재시작 불필요. 기본 설정(`use_real_oids=off`)에서는 동시 가상 인덱스 개수가 약 2500개로 제한됨 |
| 대안 | 확장 없이: 실제 `CREATE INDEX` 후 측정하고 아니면 `DROP`(자원 소모). 다른 도구: `dexter` 같은 자동 인덱스 추천 도구(HypoPG를 내부적으로 활용). <br>애플리케이션: 느린 쿼리를 pg_stat_statements로 먼저 특정한 뒤 HypoPG로 처방 검증 |

### 5. (선택) 내부 동작 원리

- HypoPG는 PostgreSQL의 **planner hook** 에 삽입되어, 플래너가 실행 계획을 세울 때 HypoPG가 개입해서 PostgreSQL의 코어는 건들지 않고 플래너에 첨언을 함.
- 가상 인덱스 정의는 실제 카탈로그(DB에 진짜로 존재하는 인덱스 목록:pg_index)가 아니라 해당 **개인 메모리**에 담기므로, 다른 세션에는 보이지 않음
- OID(객체 식별자: 테이블,인덱스에 붙이는 고유 번호) 처리가 특이함.
  - 진짜 객체가 쓰는 번호랑 구분해서 제공됨
  - 기본값(`hypopg.use_real_oids = off`)에서는 PostgreSQL이 향후 사용을 위해 예약해둔 번호 대역(약 14000~16384)에서 OID를 빌려 씀.
  - 이 방식은 락을 덜 잡고 **스탠바이(읽기 전용 복제본)에서도 동작**하는 장점이 있지만, 동시에 가질 수 있는 가상 인덱스가 약 2500개로 제한됨.
    - 예약 과정이기에 lock 경합을 피할 수 있음
    - 스탠바이는 읽기 전용 복제본(주 서버를 복사한, 쓰기 금지 서버): 예약 번호를 가져오는거는 쓰기가 아니기 때문에 가상 인덱스 실험이 가능함
  - 인덱스가 더 많이 필요하면 `use_real_oids = on`으로 바꿔 실제 OID를 쓸 수 있으나, 락을 더 잡고 스탠바이에서는 못 씀.
- `hypopg_relation_size()`가 실제 인덱스 없이도 크기를 추정할 수 있는 이유는, 인덱스 대상 컬럼의 통계(평균 폭, 행 수 등)를 바탕으로 btree 페이지 수를 계산하기 때문
  - btree 인덱스의 크기는 인덱스에 넣을 값이 몇 개고(행 수), 값 하나가 몇 바이트냐(평균 폭)로 대략 계산함

---

### 참고 링크

- 저장소: [https://github.com/HypoPG/hypopg](https://github.com/HypoPG/hypopg)
- 1.4.3 릴리스 공지: [https://www.postgresql.org/about/news/hypopg-143-is-out-3326/](https://www.postgresql.org/about/news/hypopg-143-is-out-3326/)

index-index에 이유

hypopg 삽입 과정 코드


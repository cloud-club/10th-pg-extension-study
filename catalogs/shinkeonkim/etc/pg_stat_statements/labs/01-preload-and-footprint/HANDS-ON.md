# Lab 01 직접 해보기 - preload 가 왜 필수인가

```bash
./run.sh up
./run.sh psql
```

`docker-compose.yml` 을 먼저 열어보세요. `shared_preload_libraries=pg_stat_statements` 가 서버 기동 옵션으로 들어가 있습니다. **이게 없으면 이 lab 전체가 성립하지 않습니다.**

---

## STEP 1 - preload 가 왜 필수인가, 카탈로그엔 뭐가 남나

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SHOW shared_preload_libraries;
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_stat_statements';
```

이 PostgreSQL 버전에 실제로 존재하는 컬럼을 직접 확인하세요 (버전마다 다릅니다 - 외우지 말고 매번 확인하는 습관을 들이세요).

```sql
SELECT ordinal_position, column_name, data_type
FROM   information_schema.columns
WHERE  table_name = 'pg_stat_statements'
ORDER  BY ordinal_position;
```

카탈로그에 남은 흔적을 보세요.

```sql
SELECT d.classid::regclass AS 카탈로그,
       CASE d.classid
         WHEN 'pg_proc'::regclass  THEN (SELECT proname FROM pg_proc  WHERE oid = d.objid)
         WHEN 'pg_class'::regclass THEN (SELECT relname FROM pg_class WHERE oid = d.objid)
       END AS 이름
FROM   pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
WHERE  d.refclassid = 'pg_extension'::regclass AND d.deptype = 'e'
  AND  e.extname = 'pg_stat_statements'
ORDER  BY 1, 2;
```

**함수 3개 + 뷰 2개가 전부입니다.** 그런데 왜 서버 재시작까지 요구할까요? 답은 공유 메모리입니다.

```sql
SELECT name, pg_size_pretty(size), allocated_size
FROM   pg_shmem_allocations WHERE name ILIKE '%stat_statements%';
```

이 영역은 서버가 뜰 때 한 번만 할당됩니다. `_PG_init()` 이 하는 두 가지가 이것을 요구합니다.

```c
/* 1) 훅 체인에 끼어들기 - 모든 세션의 쿼리를 잡으려면 서버 시작 시 등록해야 한다 */
post_parse_analyze_hook, planner_hook, ExecutorStart/End_hook, ProcessUtility_hook

/* 2) 공유 메모리 요청 - 런타임에 늘릴 수 없다 */
RequestAddinShmemSpace(pgss_memsize());
RequestNamedLWLockTranche("pg_stat_statements", 1);
```

**직접 실험해볼 것**: `./run.sh down` 후 `docker-compose.yml` 의 `shared_preload_libraries=pg_stat_statements` 줄을 지우고 `./run.sh up` → `./run.sh psql`. `CREATE EXTENSION pg_stat_statements;` 는 성공하지만 `SELECT * FROM pg_stat_statements;` 는 에러가 납니다. 카탈로그 등록과 실제 동작이 별개라는 걸 가장 확실히 보는 방법입니다. (확인 후 되돌리세요.)

---

## 정리

| | |
|---|---|
| 카탈로그 흔적 | 함수 3개 + 뷰 2개 - 통계 수집은 훅과 공유 메모리를 사용한다 |
| preload 필수 이유 | 훅 체인 등록과 공유 메모리 할당은 서버 기동 시점에만 가능하다 |

## 다음 단계

- 다음 랩: [`../02-normalization-and-queryid/`](../02-normalization-and-queryid)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
- 심화 조사: [`../../docs/`](../../docs)

자동 검증과 별도로 수동 절차를 처음부터 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용합니다.

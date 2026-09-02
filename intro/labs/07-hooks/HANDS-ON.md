# Lab 07 - 직접 해보기 · (d) Hook + 공유 메모리

여기서부터 성격이 달라집니다. **`CREATE EXTENSION` 만으로는 동작하지 않습니다.** 서버가 켜질 때 미리 라이브러리를 올려놔야 하는 부류입니다.

```bash
./run.sh up
./run.sh psql
```

`docker-compose.yml` 을 먼저 열어보세요 - `shared_preload_libraries=pg_stat_statements` 가 서버 기동 옵션으로 들어가 있습니다. **이 설정이 없으면 이 lab 은 성립하지 않습니다.**

---

## STEP 1 - 왜 preload 가 필요한가

```sql
SHOW shared_preload_libraries;
CREATE EXTENSION pg_stat_statements;
SELECT extname, extversion FROM pg_extension WHERE extname='pg_stat_statements';
```

`CREATE EXTENSION` 이 남긴 것을 보세요.

```sql
SELECT d.classid::regclass AS 카탈로그,
       CASE d.classid
         WHEN 'pg_proc'::regclass  THEN (SELECT proname FROM pg_proc  WHERE oid=d.objid)
         WHEN 'pg_class'::regclass THEN (SELECT relname FROM pg_class WHERE oid=d.objid)
       END AS 이름
FROM   pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
WHERE  d.refclassid='pg_extension'::regclass AND d.deptype='e'
  AND  e.extname='pg_stat_statements' ORDER BY 1, 2;
```

**함수 3개와 뷰 2개(`pg_stat_statements`, `pg_stat_statements_info`)가 전부입니다.** lab04~06 에서 쓰던 판별 쿼리로는 이 extension 이 무슨 일을 하는지 **전혀 알 수 없습니다.**

> 진짜 일은 카탈로그가 아니라 **C 코드가 훅에 자기를 끼워넣는 것**으로 일어납니다. `_PG_init()` 에서 `ExecutorStart_hook`, `ProcessUtility_hook` 등을 자기 함수로 바꿔치기하고, 원래 함수 포인터를 저장해뒀다가 이어서 호출합니다 - **체인 방식**이라 여러 extension 이 공존할 수 있습니다. 훅을 걸려면 **모든 백엔드가 같은 코드를 갖고 있어야** 해서 `shared_preload_libraries` 가 필요합니다.

---

## STEP 2 - 쿼리 정규화: 이 extension 의 핵심 아이디어

```sql
SELECT pg_stat_statements_reset() IS NOT NULL AS 통계_초기화;
CREATE TABLE t_demo AS SELECT g AS id, md5(g::text) AS h FROM generate_series(1,50000) g;
```

**상수만 다른 쿼리**를 여러 번 날려보세요.

```sql
SELECT count(*) FROM t_demo WHERE id < 100;
SELECT count(*) FROM t_demo WHERE id < 200;
SELECT count(*) FROM t_demo WHERE id < 300;
SELECT h FROM t_demo WHERE id = 42;
SELECT h FROM t_demo WHERE id = 4242;
```

이제 통계를 보세요.

```sql
SELECT left(query, 50) AS 쿼리, calls AS 호출수,
       round(total_exec_time::numeric, 2) AS 총ms,
       round(mean_exec_time::numeric, 3) AS 평균ms, rows AS 행수
FROM   pg_stat_statements
WHERE  query LIKE '%t_demo%' AND query NOT LIKE '%pg_stat%'
ORDER  BY total_exec_time DESC;
```

**상수가 `$1` 로 바뀌어 있고, 세 번의 호출이 한 행으로 합쳐졌습니다.**

```
SELECT count(*) FROM t_demo WHERE id < $1     calls = 3
SELECT h FROM t_demo WHERE id = $1            calls = 2
```

이게 전부입니다. 로그를 텍스트로 모으는 것과 결정적으로 다른 점은, **파싱 트리 단계에서 상수를 지워 같은 모양의 쿼리를 하나로 묶는다**는 것입니다. 그래서 "어떤 쿼리가 전체 시간을 잡아먹나"를 물어볼 수 있습니다.

같은 모양의 쿼리는 같은 `queryid` 를 갖습니다.

```sql
SELECT queryid, left(query, 45) AS 쿼리, calls
FROM pg_stat_statements WHERE query LIKE '%t_demo%' ORDER BY calls DESC LIMIT 5;
SHOW compute_query_id;
SELECT pid, query_id, left(query, 40) AS query FROM pg_stat_activity WHERE pid = pg_backend_pid();
```

`pg_stat_activity.query_id` 로 **"지금 도는 이 쿼리"와 "통계의 그 쿼리"를 연결**할 수 있습니다.

---

## STEP 3 - 공유 메모리를 실제로 쓴다는 증거

```sql
SELECT name AS 이름, pg_size_pretty(size) AS 크기, allocated_size AS 실제바이트
FROM   pg_shmem_allocations WHERE name ILIKE '%stat_statements%' ORDER BY size DESC;
```

이 영역은 **서버 기동 시점에 한 번 잡습니다.** 나중에 늘릴 수 없어서 `shared_preload_libraries` 가 필요한 두 번째 이유입니다.

공유이므로 **다른 연결에서 실행한 쿼리도 여기서 보입니다.** 직접 확인하세요.

```sql
\! psql -U postgres -d study -c "SELECT count(*) FROM t_demo WHERE id < 12345;" > /dev/null
SELECT left(query, 55) AS 쿼리, calls FROM pg_stat_statements WHERE query LIKE '%id < %' ORDER BY calls DESC LIMIT 3;
```
→ 방금 **다른 프로세스**가 실행한 쿼리가 `calls` 에 더해졌습니다.

설정을 확인하세요.

```sql
SELECT name, setting FROM pg_settings WHERE name LIKE 'pg_stat_statements%' ORDER BY name;
```

| 설정 | 의미 |
|---|---|
| `pg_stat_statements.max` | 추적할 쿼리 개수 (기본 5000). 넘치면 오래된 것부터 버림 |
| `.track` | `top` / `all` / `none` - `all` 은 함수 안의 쿼리까지 |
| `.track_utility` | DDL 도 추적할지 |
| `.save` | 재시작 시 통계를 파일로 보존할지 |

---

## STEP 4 - 실제 운영에서 쓰는 쿼리

**총 시간을 가장 많이 쓴 쿼리** - 튜닝 우선순위는 여기서 시작합니다.

```sql
SELECT left(query, 45) AS 쿼리, calls AS 호출수,
       round(total_exec_time::numeric, 1) AS 총ms,
       round(100 * total_exec_time / nullif(sum(total_exec_time) OVER (), 0))::int AS "전체대비%"
FROM   pg_stat_statements ORDER BY total_exec_time DESC LIMIT 5;
```

> 한 번에 1초 걸리는 쿼리보다 **1ms 짜리를 10만 번 부르는 쪽**이 서버를 더 힘들게 합니다. `mean_exec_time` 이 아니라 `total_exec_time` 으로 정렬하는 이유입니다.

**호출당 읽은 블록 수** - 인덱스가 없는 쿼리를 찾는 지표입니다.

```sql
SELECT left(query, 45) AS 쿼리, calls,
       round((shared_blks_hit + shared_blks_read)::numeric / nullif(calls,0), 1) AS 호출당_블록
FROM   pg_stat_statements WHERE calls > 0 ORDER BY 호출당_블록 DESC NULLS LAST LIMIT 5;
```

**캐시 히트율** - 디스크를 많이 읽는 쿼리.

```sql
SELECT left(query, 40) AS 쿼리, shared_blks_hit AS 캐시히트, shared_blks_read AS 디스크읽기,
       round(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0), 1) AS "히트율%"
FROM   pg_stat_statements WHERE shared_blks_hit + shared_blks_read > 0
ORDER  BY shared_blks_read DESC LIMIT 5;
```

**실행 시간의 편차** - 평균은 괜찮은데 가끔 튀는 쿼리를 잡습니다.

```sql
SELECT left(query, 45) AS 쿼리, calls,
       round(mean_exec_time::numeric, 2) AS 평균ms,
       round(stddev_exec_time::numeric, 2) AS 표준편차,
       round(max_exec_time::numeric, 2) AS 최대ms
FROM   pg_stat_statements WHERE calls > 1 ORDER BY stddev_exec_time DESC NULLS LAST LIMIT 5;
```

---

## 직접 실험해볼 것

**`shared_preload_libraries` 없이도 되는지** 확인해보세요. 호스트에서:

```bash
./run.sh down
# docker-compose.yml 의 shared_preload_libraries 줄을 지우고
./run.sh up
./run.sh psql
```

그리고 `CREATE EXTENSION pg_stat_statements;` → `SELECT * FROM pg_stat_statements;` 을 해보면 **뷰는 만들어지지만 조회가 실패**합니다. 카탈로그 등록과 실제 동작이 별개라는 것을 가장 확실하게 보는 방법입니다.

(확인 후 `docker-compose.yml` 을 되돌리세요.)

---

## 정리

| | |
|---|---|
| 카탈로그 흔적 | 함수 몇 개 + 뷰 - **판별 쿼리로는 정체를 알 수 없음** |
| 진짜 동작 | `_PG_init()` 에서 훅 체인에 끼어들기 + 공유 메모리 |
| 서버 설정 | **`shared_preload_libraries` + 재시작 필수** |
| 매니지드 DB | 대부분 미리 켜져 있음. 임의 추가는 대개 불가 |

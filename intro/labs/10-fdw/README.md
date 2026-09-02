# Lab 10 - (g) FDW: 외부 데이터를 테이블처럼

```bash
./run.sh          # 약 20초
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |
> 처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.


DB 밖의 데이터를 **평범한 테이블처럼** 조회하게 해주는 부류입니다.

| 스크립트 | 다루는 것 |
|---|---|
| `01-file-fdw.sql` | 서버 로컬 CSV 를 테이블로 · 3단계 설정 |
| `02-postgres-fdw.sql` | 원격 PostgreSQL · **푸시다운(pushdown)** |
| `03-fdw-landscape.sql` | FDW 생태계 · 언제 쓰고 언제 피하나 |

## 3단계 설정

```
① FDW            어떻게 읽을지          (extension 이 제공)
② SERVER         어디서 읽을지
③ FOREIGN TABLE  무엇을 어떤 컬럼으로
```

```sql
CREATE SERVER csv_server FOREIGN DATA WRAPPER file_fdw;
CREATE FOREIGN TABLE cities (id int, city text, population bigint)
SERVER csv_server
OPTIONS (filename '/lab/data/cities.csv', format 'csv', header 'true');

SELECT * FROM cities ORDER BY population DESC;   -- 그냥 테이블입니다
```

## 핵심 - 푸시다운

`postgres_fdw` 의 성능은 **"조건을 원격에서 거르느냐"** 에 달려 있습니다.

```
--- 푸시다운 됨 ---
 Foreign Scan on remote.orders_remote
   Remote SQL: SELECT id, amount FROM public.orders_remote
               WHERE ((amount > 90000)) AND ((city = '부산'))

--- 푸시다운 안 됨 (원격이 모르는 로컬 함수) ---
 Foreign Scan on remote.orders_remote
   Filter: (local_only(orders_remote.city) = '부산'::text)
   Remote SQL: SELECT id, city FROM public.orders_remote
```

아래는 **10만 행을 전부 가져와서 로컬에서 거릅니다.** 네트워크가 병목이 됩니다.

> **`EXPLAIN (VERBOSE)` 의 `Remote SQL` 을 항상 확인하세요.** 거기에 `WHERE` 가 없으면 전체를 끌어오고 있다는 뜻입니다.
> 참고: `LANGUAGE sql` 함수는 플래너가 인라인해버려서 오히려 푸시다운됩니다. 스크립트가 `plpgsql` 을 쓴 이유입니다 - 인라인되지 않아야 "원격이 모르는 함수"가 됩니다.

`GROUP BY` 집계도 푸시다운됩니다.

## 언제 쓰고 언제 피하나

| | 상황 |
|---|---|
| 👍 | 레거시 DB 점진적 마이그레이션 - 옛 DB 를 뷰처럼 붙여두고 조금씩 이전 |
| 👍 | 소량 참조 데이터 · 일회성 CSV 분석 · 샤드 통합 조회 |
| 👎 | 대량 데이터 실시간 조인 - 네트워크가 병목 |
| 👎 | 푸시다운이 안 되는 조건 |
| 👎 | 강한 트랜잭션 보장 필요 - 2PC 없이는 원자성이 없음 |

## 성능을 위해 반드시

① `EXPLAIN (VERBOSE)` 로 Remote SQL 확인 ② 외부 테이블도 `ANALYZE` ③ `use_remote_estimate` ④ `fetch_size` 조정 (기본 100행씩 가져옴)

## 그 외

- `file_fdw` 는 **읽기 전용**이고 인덱스가 없습니다. `filename` 은 **서버** 경로입니다 (그래서 superuser 또는 `pg_read_server_files` 권한 필요).
- 서드파티: `mysql_fdw` `mongo_fdw` `oracle_fdw` `parquet_fdw` `multicorn`(Python 으로 직접 작성)

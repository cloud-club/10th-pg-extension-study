# Lab 08 - 직접 해보기 · (e) Extension 이 아닌 모듈

**"PostgreSQL 을 확장하는 것"이 전부 extension 은 아닙니다.** `CREATE EXTENSION` 이 아예 불가능한데도 잘 동작하는 것들이 있습니다.

```bash
./run.sh up
./run.sh psql
```

`docker-compose.yml` 에 `shared_preload_libraries=auto_explain` 이 있습니다. **이게 auto_explain 을 쓰는 유일한 방법입니다.**

---

## STEP 1 - auto_explain 은 extension 이 아닙니다

```sql
SELECT count(*) AS "auto_explain 이 목록에 있나?" FROM pg_available_extensions WHERE name='auto_explain';
```
→ `0`

```sql expect-error
CREATE EXTENSION auto_explain;
```
```
ERROR:  extension "auto_explain" is not available
DETAIL:  Could not open extension control file ".../auto_explain.control": No such file or directory.
```

**왜인지 파일로 확인하세요.**

```sql
\! ls /usr/share/postgresql/16/extension/ | grep -c auto_explain || echo "  control/sql 파일: 0개"
\! ls -l /usr/lib/postgresql/16/lib/auto_explain.so
```

`.so` 는 **있습니다.** `.control` 과 `--<버전>.sql` 이 **없을 뿐**입니다. `CREATE EXTENSION` 은 `.control` 을 찾는 명령이라, 없으면 시작조차 못 합니다.

이런 게 얼마나 있는지 세어보세요.

```sql
\! for f in /usr/lib/postgresql/16/lib/*.so; do b=$(basename "$f" .so); [ -f "/usr/share/postgresql/16/extension/$b.control" ] || echo "  $b"; done | head -12
```

> **정리**: `.so` = 코드, `.control`+`.sql` = **SQL 세계에 등록하기 위한 포장**. auto_explain 은 SQL 객체를 하나도 만들지 않으니 포장할 것이 없습니다. 훅만 걸면 되니까요.

---

## STEP 2 - 카탈로그에 없어도 동작은 합니다

```sql
SHOW shared_preload_libraries;
SELECT name AS 설정, setting AS 값 FROM pg_settings WHERE name LIKE 'auto_explain%' ORDER BY name;
```

**`pg_extension` 에는 없는데 `pg_settings` 에는 있습니다.** GUC 등록은 `_PG_init()` 이 한 것입니다.

쿼리를 하나 돌려보세요.

```sql
CREATE TABLE t_demo AS SELECT g AS id, md5(g::text) AS h FROM generate_series(1,50000) g;
SELECT count(*) FROM t_demo WHERE id BETWEEN 1000 AND 2000;
```

이제 **서버 로그**를 보세요. 실행 계획이 저절로 남아 있습니다.

```sql
\! tail -c 4000 /var/lib/postgresql/data/log/postgresql.log | grep -A8 "t_demo WHERE id BETWEEN" | tail -12
```

`EXPLAIN` 을 붙이지 않았는데 계획이 기록되었습니다. **느린 쿼리를 사후에 잡는 도구**입니다.

### 운영 설정에서 주의할 것

| 설정 | 권장 |
|---|---|
| `auto_explain.log_min_duration` | `-1`(끄기) 또는 `1000`(1초 이상만). **`0` 은 절대 금물** - 모든 쿼리를 기록합니다 |
| `auto_explain.log_analyze` | `on` 이면 실제 시간/행수까지. **오버헤드 있음** |
| `auto_explain.sample_rate` | `0.01` = 1% 만 기록. 부하 큰 서버에서 필수 |
| `auto_explain.log_nested_statements` | 함수 안의 쿼리까지 기록 |
| `auto_explain.log_format` | `text` / `json` / `yaml` - 로그 수집기 연동 시 json |

---

## STEP 3 - 이름은 생각보다 안 맞습니다

반대 방향도 봅시다 - `.so` 가 아예 없는 extension 도 있습니다.

```sql
CREATE EXTENSION intarray;
CREATE EXTENSION intagg;
CREATE EXTENSION pgcrypto;
CREATE EXTENSION unaccent;
```

```sql
SELECT e.extname AS extension,
       coalesce(string_agg(DISTINCT p.probin, ', '), '(없음)') AS 공유_라이브러리,
       CASE WHEN count(p.probin) > 0 THEN 'C extension' ELSE 'SQL-only extension' END AS 종류
FROM   pg_extension e
LEFT   JOIN pg_depend d ON d.refobjid=e.oid AND d.deptype='e' AND d.classid='pg_proc'::regclass
LEFT   JOIN pg_proc p ON p.oid=d.objid
GROUP  BY e.extname ORDER BY 종류, e.extname;
```

`intarray` 의 라이브러리가 `$libdir/_int` 입니다 - **이름이 다릅니다.**

```sql
\! echo "  extension 파일:"; ls /usr/share/postgresql/16/extension/ | grep -E "^int(array|agg)\." | sed 's/^/    /'
\! echo "  라이브러리 파일:"; ls /usr/lib/postgresql/16/lib/ | grep -E "^(_int|intarray|intagg)\.so" | sed 's/^/    /'
```

`intagg` 는 `.so` 가 아예 없습니다 - PostgreSQL **내장 함수를 `LANGUAGE INTERNAL` 로 다시 노출**하기만 하는 extension 입니다 (`intagg--1.1.sql` 을 열어보면 `array_agg_transfn` · `array_unnest` 를 감싸고 있습니다).

> **처음 보는 extension 의 정체를 파악할 때 이름을 믿지 마세요.** `pg_proc.probin` 을 보면 실제로 어떤 라이브러리를 쓰는지 알 수 있습니다.

---

## 정리

세 가지를 구분할 수 있어야 합니다.

| | `.control` | `.so` | 설치 방법 |
|---|---|---|---|
| **모듈** (auto_explain) | ✕ | ○ | `shared_preload_libraries` 만 |
| **C extension** (pgcrypto) | ○ | ○ | `CREATE EXTENSION` |
| **SQL-only extension** (intagg) | ○ | ✕ | `CREATE EXTENSION` |

`shared_preload_libraries` 에 넣는 것과 `CREATE EXTENSION` 하는 것은 **다른 층위의 작업**입니다. lab07 의 pg_stat_statements 는 **둘 다** 필요했고, auto_explain 은 **앞의 것만** 필요합니다.

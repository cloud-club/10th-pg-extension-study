# Lab 01 직접 해보기 - 설치와 트라이그램 해부

```bash
./run.sh up
./run.sh psql
```

## STEP 1 - 설치가 얼마나 쉬운가

```sql
\! ls /usr/share/postgresql/16/extension/ | grep '^pg_trgm'
\! cat /usr/share/postgresql/16/extension/pg_trgm.control
```

`trusted = true` 한 줄을 확인하라. `pg_bigm.control` 에는 이 줄이 없다.

```sql
CREATE EXTENSION pg_trgm;
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_trgm';
```

## STEP 2 - trusted 확장: 수퍼유저가 아니어도 된다

```sql
CREATE ROLE app LOGIN;
GRANT CREATE ON DATABASE study TO app;
GRANT CREATE ON SCHEMA public TO app;

DROP EXTENSION pg_trgm;
SET ROLE app;
SELECT current_user;
CREATE EXTENSION pg_trgm;   -- 성공한다
RESET ROLE;
```

같은 자리에서 `pg_bigm` 은 실패한다:
`ERROR: permission denied to create extension "pg_bigm"` / `HINT: Must be superuser to create this extension.`

## STEP 3 - 패딩이 핵심이다

```sql
SELECT show_trgm('word');   -- {"  w"," wo",ord,"rd ",wor}
SELECT show_trgm('ab');     -- {"  a"," ab","ab "}  <- 2글자여도 패딩 덕에 3개
```

앞에 공백 2개(`LPADDING`), 뒤에 1개(`RPADDING`). 이 비대칭이 lab 04 에서 중요해진다.

## STEP 4 - 한글은 정말 안 되는가

```sql
SELECT show_trgm('가나다라');
--  {0x0dbca6,0x1fb1ac,0x66c945,0xb4c7cf,0xecf7cd}
```

**5개가 정상 생성된다.** 걸러지지 않았다. `0x...` 로 보이는 이유는 `typedef char trgm[3]` 이 정확히 3바이트라 멀티바이트 조각을 CRC32 로 눌러 담기 때문이다.

## STEP 5 - 진짜 차이는 구두점이다

```sql
SELECT show_trgm('192.168.0.1');
--  {"  0","  1"," 0 "," 1 "," 16"," 19",168,192,"68 ","92 "}
```

점이 단어 경계가 되어 `192`/`168`/`0`/`1` 로 쪼개진다. `pg_bigm` 은 `{" 1",.0,.1,0.,"1 ",16,19,2.,68,8.,92}` 로 점을 그대로 담는다.

```sql
SELECT similarity('ABC','abc');   -- 1   (IGNORECASE)
-- pg_bigm 의 bigm_similarity('ABC','abc') 는 0 이다
```

## STEP 6 - 유사도 공식 검산

```sql
SELECT array_length(show_trgm('abcd'),1) AS len1,
       array_length(show_trgm('abce'),1) AS len2,
       (SELECT count(*) FROM unnest(show_trgm('abcd')) a
                        JOIN unnest(show_trgm('abce')) b ON a=b) AS 공통,
       similarity('abcd','abce');
--  5 | 5 | 3 | 0.42857143      ->  3 / (5+5-3) = 3/7   자카드가 맞다
```

## STEP 7 - GUC 3개

```sql
SELECT name, setting, boot_val FROM pg_settings WHERE name LIKE 'pg_trgm%';
```

`_PG_init()` 이 하는 일은 이게 전부다 - 훅도, 워커도, 공유 메모리도 없다.

---

## 다음 단계

- 다음 lab: [`../02-gin-vs-gist/`](../02-gin-vs-gist)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)

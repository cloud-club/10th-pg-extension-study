# Lab 08 - (e) Extension 이 아닌 "모듈"

```bash
./run.sh          # 약 10초
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |
> 처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.


`auto_explain` 은 **`CREATE EXTENSION` 대상이 아닙니다.** 그런데 동작은 합니다. "Extension" 과 "loadable module" 의 차이를 다룹니다.

| 스크립트 | 다루는 것 |
|---|---|
| `01-not-an-extension.sql` | `.so` 는 있는데 `.control` 이 없다 |
| `02-it-still-works.sql` | 그래도 실행 계획이 로그에 남는다 · 운영 설정 |
| `03-so-name-vs-extension-name.sql` | 반대 방향 - `.so` 없는 extension, 이름 불일치 |

## 핵심 구분

```
Extension  =  .control + .sql  (+ .so)
              → 카탈로그에 기록됨, 버전 관리됨, DROP 가능

Module     =  .so 만
              → 카탈로그 기록 없음, 버전 개념 없음
              → LOAD 또는 *_preload_libraries 로만 로드
```

```
--- CREATE EXTENSION 을 시도하면 ---
NOTICE:  extension "auto_explain" is not available

--- 그런데 .so 는 있다 ---
-rwxr-xr-x 1 root root  ... /usr/lib/postgresql/16/lib/auto_explain.so
```

## 그래도 동작한다

`EXPLAIN` 을 붙이지 않은 평범한 쿼리인데 로그에 계획이 남습니다.

```
	Query Text: SELECT count(*) FROM t_demo WHERE id BETWEEN 1000 AND 2000;
	Aggregate  (cost=1302.15..1302.16) (actual time=1.533..1.533 rows=1 loops=1)
	  ->  Seq Scan on t_demo  (actual time=0.034..1.506 rows=1001 loops=1)
	        Rows Removed by Filter: 48999
```

`ExecutorEnd_hook` 에 끼어들었기 때문입니다. **애플리케이션 코드를 한 줄도 바꾸지 않고** 모든 쿼리의 계획을 얻는 방법입니다.

> ⚠️ 이 lab 은 `auto_explain.log_min_duration=0` 으로 **모든 쿼리**를 기록합니다. 실습용입니다. 운영에서는 `1000`(1초 이상) + `sample_rate` 로 시작하세요. 로그가 폭증합니다.

## 반대 방향도 있습니다

```
 extension |  공유_라이브러리  |        종류
-----------+-------------------+--------------------
 intarray  | $libdir/_int      | C extension
 intagg    | (없음)            | SQL-only extension
```

- `intagg` 는 `.so` 가 아예 없습니다 - PostgreSQL **내장** 함수(`array_agg_transfn` · `array_unnest`)를 `LANGUAGE INTERNAL` 로 노출하기만 하는 extension
- `intarray` 의 라이브러리는 `intarray.so` 가 아니라 **`_int.so`** 입니다

**extension 이름 · control 파일 이름 · `.so` 이름은 각각 별개입니다.** 유일한 연결고리는 control 파일의 `module_pathname` 입니다.

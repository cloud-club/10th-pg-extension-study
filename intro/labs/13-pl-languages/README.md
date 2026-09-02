# Lab 13 - (j) 다른 프로그래밍 언어로 함수 짜기

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


**Python 으로 DB 함수를 짭니다.** 이 부류는 지금까지와 다른 카탈로그를 건드립니다 - `pg_language`.

| 스크립트 | 다루는 것 |
|---|---|
| `01-what-it-adds.sql` | `pg_language` 에 항목이 생긴다 · handler 는 C 로 짜여 있다 |
| `02-python-basics.sql` | 함수 작성 · **타입 매핑의 함정** · SETOF · 복합 타입 |
| `03-python-power.sql` | 표준 라이브러리 · `plpy` 로 SQL 실행 · `SD`/`GD` 상태 |
| `04-trusted-vs-untrusted.sql` | **`plpython3u` 의 `u` 가 무슨 뜻인가** |
| `05-when-to-use.sql` | 성능 비교 · 판단 기준 · 주의할 점 |

## PL 언어도 결국 C extension 입니다

```
        handler         | 구현 언어 |  공유 라이브러리
------------------------+-----------+-------------------
 plpython3_call_handler | c         | $libdir/plpython3
 plperl_call_handler    | c         | $libdir/plperl
 plpgsql_call_handler   | c         | $libdir/plpgsql
```

Python 함수를 부르면 → **C handler 가 호출되고** → 그 안에서 Python 인터프리터가 돕니다. `plpgsql` 도 마찬가지입니다. 기본 제공될 뿐 특별한 존재가 아닙니다.

## ⚠️ 타입 매핑의 함정

```
 int         -> int       (1)
 numeric     -> Decimal   (3.5)          ← float 아님. 정밀도 보존
 int[]       -> list      ([1, 2, 3])
 jsonb       -> str       ({"k": "v"})   ← dict 아님!
 date        -> str       (2026-08-31)   ← date 객체 아님!
 timestamptz -> str       (...)
```

**자동 변환되는 것은 숫자 · 문자 · 불리언 · 배열까지입니다.** `jsonb` 와 날짜는 **문자열로 옵니다.** `json.loads()`, `date.fromisoformat()` 을 직접 불러야 합니다. "dict 로 오겠지" 하고 짰다가 `AttributeError` 를 만나는 게 흔한 첫 실수입니다.

## 하이라이트 - `u` 는 untrusted 의 u

```
   언어     | trusted |            의미
------------+---------+-----------------------------
 plpgsql    | t       | 일반 유저도 함수 작성 가능
 plperl     | t       | 일반 유저도 함수 작성 가능
 plpython3u | f       | superuser 만 함수 작성 가능
```

**왜 그런지 직접 해봅니다.**

```sql
CREATE FUNCTION py_read_server_file(path text) RETURNS text
LANGUAGE plpython3u AS $$ ... open(path).read() ... $$;

SELECT py_read_server_file('/etc/hostname');   -- 서버 파일을 읽는다
SELECT py_run_shell();                          -- postgres  ← 쉘도 실행된다
```

**DB 함수 하나가 서버 파일을 읽고 쉘을 실행했습니다.** PostgreSQL 프로세스 권한으로 무엇이든 할 수 있습니다.

일반 유저로 시도하면:
```
NOTICE:  plpython3u -> permission denied for language plpython3u
NOTICE:  plperl (trusted): 함수 생성 성공
```

같은 Perl 이라도 trusted 버전은 막습니다:
```
NOTICE:  plperl 로 파일 읽기 -> 'open' trapped by operation mask at line 1.
```

> 막을 수 없는 언어(Python)는 아예 **untrusted 로만** 제공됩니다. 그래서 클라우드 매니지드 DB 에서는 대개 못 씁니다 (superuser 가 없으므로).

## 성능 - 20만 행에 함수 적용

| 구현 | 시간 |
|---|---|
| 내장 `upper()` | 25 ms |
| `LANGUAGE sql` | 24 ms |
| `LANGUAGE plpgsql` | 57 ms |
| `LANGUAGE plpython3u` | 73 ms |
| `LANGUAGE plperl` | 76 ms |

<sub>한 장비에서 잰 값입니다. 절대값은 2배 넘게 차이 날 수 있으니 **순위**만 보세요 - `./run.sh 05` 로 직접 재보는 게 정확합니다.</sub>

**행마다 인터프리터를 오가는 비용**입니다. SQL 로 표현할 수 있으면 SQL 로 하세요.

또 **인터프리터는 백엔드 프로세스마다 따로 뜹니다.** lab03 의 `.so` 로딩과 같은 구조라 연결이 많으면 그만큼 메모리를 씁니다.

## 언제 쓰고 언제 피하나

| | 상황 |
|---|---|
| 👍 | 표준 라이브러리가 필요할 때 (정규식·날짜·인코딩·URL 파싱) |
| 👍 | 알고리즘이 복잡해 SQL 로 짜면 읽기 어려울 때 |
| 👍 | 큰 테이블을 앱으로 끌어오지 않고 DB 안에서 처리하고 싶을 때 |
| 👎 | SQL 로 표현 가능한 일 (집계·조인·필터) |
| 👎 | 행마다 호출되는 무거운 함수 |
| 👎 | 외부 네트워크 호출 - 트랜잭션이 응답을 기다리게 됨 |
| 👎 | 클라우드 매니지드 DB |

**그 외 주의:** 외부 패키지(numpy 등) 설치가 배포 파이프라인에 끼어듭니다 · 디버거를 붙일 수 없습니다 · Python 버전이 서버 빌드에 묶입니다.

## 다른 언어들

`PL/pgSQL`(기본) · `PL/Perl`(trusted 있음) · `PL/v8`(JavaScript) · `PL/R`(통계) · `PL/Java` · `PL/Rust`(trusted 로 설계된 최신 시도)

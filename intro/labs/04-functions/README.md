# Lab 04 - (a) 함수를 추가하는 Extension

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


가장 단순한 부류입니다. **C 로 짠 함수를 SQL 함수로 노출**하기만 합니다. 새 타입도, 새 인덱스도, 훅도 없습니다.

| 스크립트 | 다루는 것 |
|---|---|
| `01-what-it-adds.sql` | 카탈로그로 이 부류를 판별하는 법 |
| `02-pgcrypto.sql` | 해싱(bcrypt) · HMAC · PGP 대칭키 암호화 |
| `03-tablefunc.sql` | `crosstab` 피벗 · `connectby` 계층 |
| `04-fuzzystrmatch.sql` | `levenshtein` · `soundex` · `metaphone` |

## 판별 기준

```
   extname    | 함수 | 타입 | 연산자 | 연산자클래스 | 인덱스AM
--------------+------+------+--------+--------------+----------
 pgcrypto     |   36 |    0 |      0 |            0 |        0
 fuzzystrmatch|   11 |    0 |      0 |            0 |        0
 tablefunc    |   11 |    3 |      0 |            0 |        0
```

→ **연산자클래스·인덱스AM 이 0 이고 함수가 대부분**이면 이 부류입니다. 이해하기도, 도입하기도 가장 쉽습니다.

<sub>`tablefunc` 의 타입 3개는 `crosstab` 이 돌려줄 결과 행 모양(`tablefunc_crosstab_2/3/4`)일 뿐, "새 데이터 타입"(lab05)과는 성격이 다릅니다. **숫자만 보지 말고 무엇인지 열어보세요** - `\dx+ tablefunc`.</sub>

## 이 lab 이 짚는 실무 포인트

- **pgcrypto** - 암호화 키를 SQL 문에 쓰면 `pg_stat_statements` 와 로그에 남습니다. 가능하면 애플리케이션에서 암호화하고 DB 에는 결과만 넣으세요.
- **tablefunc** - 컬럼이 고정이면 `crosstab` 보다 `FILTER` 절이 더 낫습니다. 두 방식의 결과가 같다는 것을 나란히 보여줍니다.
- **fuzzystrmatch** - `soundex`/`metaphone` 은 **영어 발음 전용**이라 한글에 못 씁니다. 그리고 이 함수들은 **인덱스를 못 탑니다** (Seq Scan). 행이 많으면 lab06 의 pg_trgm 과 조합하세요.

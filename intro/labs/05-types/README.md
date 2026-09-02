# Lab 05 - (b) 타입을 추가하는 Extension

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


**새 데이터 타입**을 만드는 부류입니다. 타입 하나를 추가하려면 최소한 `typinput` / `typoutput`(텍스트 ↔ 내부 표현)을 C 로 구현해야 하고, 보통 `typreceive` / `typsend`(바이너리 프로토콜)까지 함께 만듭니다. 여기에 비교 연산자와 인덱스 지원 함수가 따라붙어 함수 개수가 같이 많아집니다.

| 스크립트 | 다루는 것 |
|---|---|
| `01-what-it-adds.sql` | 타입 컬럼에 숫자가 있는지로 판별 |
| `02-hstore.sql` | key→value · **jsonb 와의 비교** |
| `03-citext.sql` | 대소문자 무관 text · **extension 없이 하는 3가지 대안** |
| `04-ltree.sql` | 계층 경로 · 인접리스트/클로저테이블과 비교 |
| `05-cube-earthdistance.sql` | **extension 이 extension 위에 세워지는 예** (`requires`) |
| `06-intarray.sql` | 정수 배열 연산자 · `_int.so` 이름 불일치 |

## 이 lab 의 관점: "이 타입이 정말 필요한가?"

각 타입마다 **extension 없이 하는 방법**을 나란히 놓고 비교합니다.

- `hstore` vs `jsonb` → 신규 프로젝트면 대개 jsonb
- `citext` vs `lower()` 저장 vs 표현식 유니크 인덱스 → 셋 다 정답이 될 수 있음
- `ltree` vs `parent_id` vs 경로 문자열 vs 클로저 테이블

발표 템플릿의 **"트레이드오프: 언제 쓰고 언제 피하나"** 를 채우는 연습입니다.

## 눈여겨볼 것

`earthdistance` 는 `requires = cube` 입니다. extension 간 의존도 `pg_depend` 에 기록되며, `CREATE EXTENSION earthdistance CASCADE` 가 cube 를 먼저 설치합니다.

`ll_to_earth(위도, 경도)` 는 **PostGIS 의 `ST_Point(경도, 위도)` 와 인자 순서가 반대**입니다.

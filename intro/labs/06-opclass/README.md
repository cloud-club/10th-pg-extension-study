# Lab 06 - (c) 연산자 클래스를 추가하는 Extension

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


**새 인덱스를 만들지 않습니다.** 기존 인덱스(GiST/GIN)에게 "이 타입은 이렇게 색인하라"고 알려줄 뿐입니다.

| 스크립트 | 다루는 것 |
|---|---|
| `01-what-it-adds.sql` | 연산자클래스는 있고 인덱스AM 은 0 |
| `02-pg-trgm.sql` | **`LIKE '%김%'` 에 인덱스 태우기** · 트라이그램 원리 |
| `03-similarity.sql` | 오타 허용 검색 · **GIN vs GiST 선택 기준** |
| `04-btree-gin-gist.sql` | 복합 GIN 인덱스 · **`EXCLUDE` 배제 제약** |
| `05-unaccent.sql` | 악센트 정규화 · IMMUTABLE 래퍼 문제 |

## 하이라이트 1 - pg_trgm

```
--- B-tree 인덱스가 있어도 ---
 Seq Scan on users  (actual rows=25000)
   Filter: (name ~~ '%김철수%')
   Rows Removed by Filter: 175000

--- gin_trgm_ops 를 붙이면 ---
 Bitmap Heap Scan on users
   Recheck Cond: (name ~~ '%김철수%')
   ->  Bitmap Index Scan on idx_users_name_trgm
```

B-tree 는 "앞에서부터 일치"만 처리할 수 있습니다. `'김철수%'` 는 되지만 `'%김철수%'` 는 안 됩니다. pg_trgm 은 문자열을 3글자 조각으로 쪼개 전치 인덱스를 만듭니다.

### ⚠️ 그런데 패턴이 3글자보다 짧으면 인덱스를 못 씁니다

```
[1글자] LIKE '%김%'       →  Seq Scan
[2글자] LIKE '%김철%'     →  Seq Scan
[3글자] LIKE '%김철수%'   →  Bitmap Index Scan   ✅
```

이름 그대로 **tri**-gram, 3글자가 색인 단위이기 때문입니다. `%...%` 는 양쪽이 와일드카드라 앞뒤에 공백을 덧붙일 수도 없어서, 패턴에서 온전한 3글자를 못 뽑으면 인덱스가 무용지물입니다.

**"인덱스를 만들었는데 왜 안 타죠?" 의 아주 흔한 원인입니다.** `02-pg-trgm.sql` 이 세 가지 길이를 나란히 실행해 보여줍니다.

## 하이라이트 2 - btree_gist 로 예약 겹침 막기

```sql
CREATE TABLE reservations (
    room   int,
    period tstzrange,
    EXCLUDE USING gist (room WITH =, period WITH &&)
);
```

같은 방(`=`)의 겹치는 시간(`&&`)을 **DB 가 거부**합니다. 애플리케이션 코드로 "빈 시간인지 확인 후 INSERT" 하면 동시 요청에서 둘 다 통과할 수 있습니다. 제약으로 두면 그 경합이 원천 차단됩니다. `=` 를 GiST 에서 쓰려면 btree_gist 가 필요합니다.

## 대가

트라이그램 인덱스는 원본 컬럼보다 커질 수 있고 쓰기 비용도 늘어납니다. `01`~`03` 에서 인덱스 크기를 직접 출력하니 확인하세요.

# Lab 11 - (h) 내부를 노출하는 진단 Extension

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


**새 기능을 더하지 않습니다.** PostgreSQL 내부 자료구조를 "SQL 로 볼 수 있게" 노출할 뿐입니다. 평소엔 필요 없다가, 문제가 생겼을 때 결정적입니다.

| 스크립트 | 다루는 것 |
|---|---|
| `01-buffercache.sql` | 공유 버퍼에 무엇이 올라와 있나 · `usagecount` |
| `02-pgstattuple.sql` | **bloat** - DELETE → VACUUM → VACUUM FULL 의 차이 |
| `03-pageinspect.sql` | 페이지 raw 바이트 · **MVCC 를 눈으로 보기** |
| `04-visibility-prewarm.sql` | **Index Only Scan 이 되는 이유** · 캐시 예열 |

## 하이라이트 1 - VACUUM 이 실제로 하는 일

```
--- 10만 행 중 1/3 삭제 후 ---
 파일크기 | 살아있는튜플 | 죽은튜플 | 죽은%  | 여유%
----------+--------------+----------+--------+-------
 6672 kB  |        66667 |    33333 |  29.76 |  0.13

--- VACUUM 후 ---
 6672 kB  |        66667 |        0 |        | 31.40      ← 크기 그대로!

--- VACUUM FULL 후 ---
 4448 kB                                                   ← 이제 줄었다
```

**VACUUM 은 공간을 "재사용 가능"하게 만들 뿐 OS 에 돌려주지 않습니다.** 파일을 줄이려면 `VACUUM FULL`(ACCESS EXCLUSIVE 락) 또는 **`pg_repack`**(무락).

## 하이라이트 2 - MVCC 를 눈으로

```sql
UPDATE t_page SET name = 'HELLO' WHERE id = 1;
```
```
 슬롯 | t_xmin | t_xmax | 다음_버전_위치 |   상태
------+--------+--------+----------------+-----------
    1 |    746 |    747 | (0,4)          | 이전 버전
    4 |    747 |      0 | (0,4)          | 살아있음
```

UPDATE 가 **새 행을 만들고** 옛 행에 `t_xmax` 를 채웁니다. `t_ctid` 가 새 버전을 가리킵니다. 이것이 MVCC 의 실체이고, bloat 이 생기는 이유입니다.

## 하이라이트 3 - Index Only Scan 이 안 되는 이유

```
--- VACUUM 전 ---
 Index Only Scan ...  Heap Fetches: 101

--- VACUUM 후 ---
 Index Only Scan ...  Heap Fetches: 0
```

Visibility Map 이 "이 페이지의 모든 행은 누구에게나 보인다"고 보증해야 힙을 건너뜁니다. **VACUUM 이 성능에 직접 영향을 주는 이유** 중 하나입니다.

## 도구 지도

| Extension | 노출하는 것 | 실무 용도 |
|---|---|---|
| `pg_buffercache` | 공유 버퍼 내용 | `shared_buffers` 사이징 |
| `pgstattuple` | bloat / dead tuple | VACUUM·repack 필요성 판단 |
| `pageinspect` | 페이지 raw 구조 | 학습, 데이터 손상 조사 |
| `pg_visibility` | Visibility Map | Index Only Scan 이 안 되는 이유 추적 |
| `pg_prewarm` | 캐시 예열 | 재시작 후 성능 회복 |

> ⚠️ `pageinspect` 는 superuser 전용입니다. `pg_buffercache` 와 `pgstattuple` 은 전체를 훑으므로 큰 테이블에서 부하가 있습니다. 운영에서 자주 돌리지 마세요. (`pgstattuple_approx()` 로 근사치를 빠르게 얻을 수 있습니다)

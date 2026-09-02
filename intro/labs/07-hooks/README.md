# Lab 07 - (d) Hook 과 공유 메모리를 쓰는 Extension

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


**`CREATE EXTENSION` 만으로는 동작하지 않는** 첫 번째 부류입니다. `shared_preload_libraries` 가 필요합니다. 왜 그런지가 이 lab 의 주제입니다.

| 스크립트 | 다루는 것 |
|---|---|
| `01-why-preload.sql` | Hook 등록과 공유메모리 요청이 왜 서버 시작 시점이어야 하나 |
| `02-normalization.sql` | **쿼리 정규화** - 이 extension 의 핵심 아이디어 |
| `03-shared-memory.sql` | `pg_shmem_allocations` 로 실제 할당 확인 · 세션 간 공유 증명 |
| `04-dba-usage.sql` | 운영에서 실제로 쓰는 4가지 쿼리 |

## 핵심 - 쿼리 정규화

```sql
SELECT count(*) FROM t_demo WHERE id < 100;
SELECT count(*) FROM t_demo WHERE id < 200;
SELECT count(*) FROM t_demo WHERE id < 300;
```
```
                  query                    | calls | 총ms  | 평균ms
-------------------------------------------+-------+-------+--------
 SELECT count(*) FROM t_demo WHERE id < $1 |     3 |  7.16 |  2.386
```

**세 쿼리가 하나로 합쳐집니다.** 정규화가 없으면 상수만 다른 쿼리가 수백만 개의 별개 항목이 되어 "무엇이 느린가"를 알 수 없습니다.

## 왜 SPL 이 필수인가

```c
void _PG_init(void) {
    ExecutorEnd_hook = pgss_ExecutorEnd;      /* ① 모든 세션을 잡으려면 서버 시작 시 */
    RequestAddinShmemSpace(pgss_memsize());   /* ② 공유메모리는 시작 시 한 번만 할당 */
}
```

`03-shared-memory.sql` 에서 별도 프로세스로 실행한 쿼리도 같은 통계에 잡히는 것을 확인합니다.

## ⚠️ 카탈로그만으로는 정체를 알 수 없는 부류

```
 카탈로그  | 이름
-----------+---------------------------
 pg_proc   | pg_stat_statements_reset
 pg_class  | pg_stat_statements
```

함수 3개와 뷰 2개뿐입니다. **진짜 일은 카탈로그가 아니라 C 코드가 실행기 안에서** 하고 있습니다. lab04~06 에서 쓴 "카탈로그 집계로 판별하기"가 통하지 않는 예입니다.

## 운영 팁

`04-dba-usage.sql` 에서 다룹니다.

- **평균이 느린 쿼리**가 아니라 **총합이 큰 쿼리**부터 보세요. 1초 × 10번(10초)보다 10ms × 10만번(1000초)이 더 큰 문제입니다.
- 오버헤드가 1~2% 로 작아서 사실상 **항상 켜두는 것이 권장**됩니다.
- 배포 전후를 비교하려면 배포 직전에 `pg_stat_statements_reset()`.

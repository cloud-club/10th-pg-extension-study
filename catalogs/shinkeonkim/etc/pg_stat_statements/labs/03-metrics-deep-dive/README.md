# Lab 03 - calls/시간 말고 나머지 컬럼들

```bash
./run.sh          # 약 15초
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |

pg_stat_statements 는 "느리다"만 말해주지 않습니다. 왜 느린지의 단서(I/O, WAL, 계획 시간, temp 파일, JIT)까지 컬럼으로 갖고 있습니다.

## 다루는 것

| | |
|---|---|
| I/O 히트율 | `shared_blks_hit`/`shared_blks_read` |
| WAL | `wal_records`/`wal_fpi`/`wal_bytes` - 복제·아카이브 비용의 단서 |
| 계획(Plan) 시간 | `track_planning=on` 일 때만 채워지는 `total_plan_time` |
| **함정** | 작은 LIMIT은 top-N 정렬로 temp 사용을 피할 수 있다. 큰 n·행 크기·다른 실행계획에서는 spill할 수 있다 |
| JIT 비용 | 짧은 쿼리에 JIT 이 잘못 켜지면 컴파일 비용이 절약한 실행 시간보다 커질 수 있다 |

## 핵심 - temp 파일 함정

```sql
SET work_mem = '64kB';
SELECT * FROM t_big ORDER BY pad LIMIT 1;   -- ✗ temp 파일이 안 생긴다 (top-N 최적화)
SELECT count(*) FROM (SELECT pad FROM t_big ORDER BY pad) x;  -- ✓ LIMIT 을 빼야 재현된다
```

## 다음 랩

- 이전: [`../02-normalization-and-queryid/`](../02-normalization-and-queryid)
- 다음: [`../04-dba-playbook-and-pitfalls/`](../04-dba-playbook-and-pitfalls)
- 전체 목록: [`../README.md`](../README.md)

## 실행 중 설명과 검증

[LESSON.md](LESSON.md)의 목표·순서·판정 기준·한계를 `run.sh`가 먼저 출력합니다.
`./run.sh explain`은 Docker 없이 안내만 읽습니다. 수동 절차는 [HANDS-ON.md](HANDS-ON.md)를 사용합니다.

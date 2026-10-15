# Lab 04 - 실무 플레이북과 세 가지 함정

```bash
./run.sh          # 약 15초
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |

실무 진단 쿼리 4가지와, 이 lab 을 만들며 실제로 걸렸던 세 가지 함정(eviction/dealloc, 권한, 겹침)을 다룹니다.

## 다루는 것

| | |
|---|---|
| 실무 진단 쿼리 | `total_exec_time` 정렬, N+1 의심(calls), 실행 시간 편차(stddev), 배포 전후 비교 |
| 선택적 리셋 | `pg_stat_statements_reset(userid, dbid, queryid)` (PostgreSQL 14+) |
| **함정 1** | `pg_stat_statements_info.dealloc` 은 "쫓겨난 항목 개수"가 아니라 "GC 실행 횟수" |
| **함정 2** | 권한 없는 사용자에게 쿼리 텍스트는 `NULL` 이 아니라 문자열 `<insufficient privilege>` |

## 핵심 - 두 가지 함정

```
dealloc = 5 라고 해서 "5개만 쫓겨났다"가 아니다.
         entry_dealloc() 은 가득 찰 때마다 max(10, 전체의 5%)를 한 번에 정리하고
         dealloc 카운터는 그 "GC 가 실행된 횟수"만 1씩 올린다.

query = '<insufficient privilege>' 는 NULL 이 아니라 고정 문자열이다.
       WHERE query = ... 로 찾으려 하면 조용히 안 걸린다.
```

## 다음 랩

- 이전: [`../03-metrics-deep-dive/`](../03-metrics-deep-dive)
- 새 lab: [`../05-fastapi-slow-query-monitor/`](../05-fastapi-slow-query-monitor) - 이 진단 쿼리들을 실제 백엔드(FastAPI) 에 붙여보기
- 전체 목록: [`../README.md`](../README.md)

## 실행 중 설명과 검증

[LESSON.md](LESSON.md)의 목표·순서·판정 기준·한계를 `run.sh`가 먼저 출력합니다.
`./run.sh explain`은 Docker 없이 안내만 읽습니다. 수동 절차는 [HANDS-ON.md](HANDS-ON.md)를 사용합니다.

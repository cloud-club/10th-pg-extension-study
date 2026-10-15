# Lab 01 - preload 가 왜 필수인가 · 카탈로그 흔적

```bash
./run.sh          # 약 10초
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |

`pg_stat_statements` 는 카탈로그에 함수 3개 + 뷰 2개만 남기는데, 왜 서버 재시작(`shared_preload_libraries`)까지 요구할까? 이 lab 은 그 답 - 훅 체인과 공유 메모리 - 을 직접 확인합니다.

## 다루는 것

| | |
|---|---|
| preload 여부 확인 | `SHOW shared_preload_libraries` |
| 버전별로 다른 컬럼 목록 | `information_schema.columns` 로 직접 확인 (외우지 않기) |
| 카탈로그 흔적 | `pg_depend` 로 본 함수/뷰 - 함수 3개 + 뷰 2개가 전부 |
| 공유 메모리 증거 | `pg_shmem_allocations` |
| `_PG_init()` 이 하는 두 가지 | 훅 체인 등록 + 공유 메모리 요청 (자세한 코드는 [`../../docs/02-internals-and-source.md`](../../docs/02-internals-and-source.md)) |

## 핵심

```
카탈로그 흔적 = 함수 3개 + 뷰 2개  →  이것만 봐서는 이 익스텐션이 왜 특별한지 알 수 없다
내부 동작    = _PG_init() 이 실행기/플래너 훅에 자기 함수를 끼워넣고, 공유 메모리를 요청한다
             → 둘 다 서버가 시작하는 시점에만 할 수 있는 일이라 shared_preload_libraries 가 강제된다
```

## 다음 랩

- [`../02-normalization-and-queryid/`](../02-normalization-and-queryid) - 쿼리 정규화와 그 함정
- 전체 목록: [`../README.md`](../README.md)

## 실행 중 설명과 검증

[LESSON.md](LESSON.md)의 목표·순서·판정 기준·한계를 `run.sh`가 먼저 출력합니다.
`./run.sh explain`은 Docker 없이 안내만 읽습니다. 수동 절차는 [HANDS-ON.md](HANDS-ON.md)를 사용합니다.

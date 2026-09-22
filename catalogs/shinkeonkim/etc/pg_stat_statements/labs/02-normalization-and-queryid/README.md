# Lab 02 - 쿼리 정규화와 그 함정

```bash
./run.sh          # 약 10초
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |

정규화(리터럴을 `$1`로 지우고 같은 모양의 쿼리를 하나로 묶는 것)가 이 익스텐션의 핵심 아이디어입니다. 이 lab 은 그 원리와, **생각보다 정규화가 안 되는 경우**를 함께 다룹니다.

## 다루는 것

| | |
|---|---|
| 기본 정규화 | 리터럴만 다른 쿼리가 `calls` 하나로 합쳐지는 것 확인 |
| **함정** | `IN (1,2,3)` 과 `IN (1..7)` 이 이 PostgreSQL 버전에서는 **정규화되지 않고 별개 항목**으로 남는다 |
| `queryid` | 같은 모양의 쿼리를 식별하는 지문 - `pg_stat_activity.query_id` 와 조인 가능 |
| `track=all` | 함수/트리거 내부 쿼리까지 잡는 것과 `toplevel` 컬럼으로 구분하는 법 |

## 핵심 - IN 리스트 함정

```sql
SELECT count(*) FROM t_demo WHERE id IN (1, 2, 3);
SELECT count(*) FROM t_demo WHERE id IN (10, 20, 30, 40, 50);
SELECT count(*) FROM t_demo WHERE id IN (100, 200, 300, 400, 500, 600, 700);
```

3개짜리 / 5개짜리 / 7개짜리가 **서로 다른 queryid 세 개**로 남습니다 - "최신 문서의 예제"와 "지금 내 서버의 실제 동작"이 다를 수 있다는 걸 보여주는 사례입니다. 정확한 도입 버전은 [`../../docs/03-version-history.md`](../../docs/03-version-history.md) 참고.

## 다음 랩

- 이전: [`../01-preload-and-footprint/`](../01-preload-and-footprint)
- 다음: [`../03-metrics-deep-dive/`](../03-metrics-deep-dive)
- 전체 목록: [`../README.md`](../README.md)

## 실행 중 설명과 검증

[LESSON.md](LESSON.md)의 목표·순서·판정 기준·한계를 `run.sh`가 먼저 출력합니다.
`./run.sh explain`은 Docker 없이 안내만 읽습니다. 수동 절차는 [HANDS-ON.md](HANDS-ON.md)를 사용합니다.

# Lab 05 - FastAPI 백엔드에서 pg_stat_statements 쓰기

```bash
./run.sh          # 약 30초 (이미지 빌드 포함)
```

01~04 랩이 psql 로 pg_stat_statements 를 직접 들여다봤다면, 이 lab 은 **실제 백엔드 서비스**(FastAPI)가 그걸 어떻게 자기 운영 도구로 써먹는지 보여줍니다. 일부러 버그가 있는 주문 조회 API 를 만들고, 그 버그를 pg_stat_statements 기반 admin 엔드포인트로 잡아냅니다.

이 lab 은 SQL 스크립트가 없습니다 - `run.sh` 가 곧 데모입니다 (`psql` 대신 `curl` 로 API 를 두드립니다).

## 구성

| 서비스 | 포트 | 역할 |
|---|---|---|
| `postgres` | 15924 | `pg_stat_statements` preload, `users`/`orders` 시드 데이터 (8000여 건) |
| `api` | 18924 | FastAPI 앱 - Swagger UI: http://localhost:18924/docs |

## 엔드포인트

| 엔드포인트 | 하는 일 |
|---|---|
| `GET /users/{id}/orders` | **버그**: 유저의 주문을 한 번에 안 가져오고, id 목록을 뽑은 뒤 건마다 별도 쿼리 (N+1) |
| `GET /orders/search?item=` | **버그**: 인덱스 없는 `item` 컬럼을 `LIKE '%...%'` 로 훑는다 |
| `POST /admin/reset-stats` | `pg_stat_statements_reset()` |
| `GET /admin/top-queries` | `total_exec_time` 기준 상위 쿼리 - "우리 서비스의 perf 대시보드" |
| `GET /admin/n-plus-one-suspects` | `calls > 20` 인 쿼리만 추려서 N+1 패턴을 자동으로 의심 |

## 핵심 - 버그를 코드가 아니라 통계로 찾는다

```
1) /users/1/orders 호출  → 내부적으로 SELECT 가 26번(목록 1 + 개별 25) 실행됨
2) /admin/n-plus-one-suspects 호출
   → "SELECT * FROM orders WHERE id = $1" 이 calls=25 로 잡힌다
   → 코드를 한 줄도 안 보고, 로그를 뒤지지도 않고 API 응답만으로 N+1 을 확정할 수 있다
```

이건 [`../../docs/04-production-playbook.md`](../../docs/04-production-playbook.md) 에 정리한 "calls 급증 = N+1 의심" 휴리스틱이 실제 API 트래픽에서도 그대로 통한다는 실증입니다.

## 정리

- 이전 랩: [`../04-dba-playbook-and-pitfalls/`](../04-dba-playbook-and-pitfalls)
- 전체 목록: [`../README.md`](../README.md)
- 자세한 사용법: [`HANDS-ON.md`](HANDS-ON.md)

## 실행 중 설명과 검증

[LESSON.md](LESSON.md)의 목표·순서·판정 기준·한계를 `run.sh`가 먼저 출력합니다.
`./run.sh explain`은 Docker 없이 안내만 읽습니다. 수동 절차는 [HANDS-ON.md](HANDS-ON.md)를 사용합니다.

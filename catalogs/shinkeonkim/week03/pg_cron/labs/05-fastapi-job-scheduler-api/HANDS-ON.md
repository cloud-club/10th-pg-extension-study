# pg_cron lab 05 - 직접 해보기

```bash
./run.sh up
```

두 컨테이너가 뜹니다 - `postgres`(localhost:15934)와 `api`(localhost:18934). Swagger UI 를 열어 직접 두드려보세요:

```bash
open http://localhost:18934/docs
```

또는 curl 로:

## 잡 등록

```bash
curl -s -X POST http://localhost:18934/jobs \
  -H 'Content-Type: application/json' \
  -d '{"name":"demo-heartbeat","schedule":"2 seconds","sql":"INSERT INTO heartbeat DEFAULT VALUES"}'
```

## 목록 조회

```bash
curl -s http://localhost:18934/jobs | python3 -m json.tool
```

## 몇 초 기다렸다가 실행 이력 확인

```bash
sleep 5
curl -s "http://localhost:18934/jobs/demo-heartbeat/runs?limit=5" | python3 -m json.tool
```

부하가 있으면 5초 뒤에도 실행이 끝나지 않을 수 있으므로 이력을 다시 조회합니다. `status: "succeeded"`인 행이 보이면, 백그라운드에서 실제로 돌고 있다는 뜻입니다.

## 비활성화

```bash
curl -s -X PATCH http://localhost:18934/jobs/demo-heartbeat \
  -H 'Content-Type: application/json' -d '{"active": false}'
```

## 잘못된 스케줄 - DB 레이어의 검증이 그대로 올라온다

```bash
curl -s -X POST http://localhost:18934/jobs \
  -H 'Content-Type: application/json' \
  -d '{"name":"bad","schedule":"not-a-cron-expression","sql":"SELECT 1"}'
```
```json
{"detail": "invalid schedule: not-a-cron-expression\nHINT:  Use cron format (e.g. 5 4 * * *), or interval format '[1-59] seconds'"}
```

API 서버가 cron 문법을 다시 검증할 필요가 없습니다 - pg_cron 이 이미 하고 있는 검증을 그대로 통과시켰을 뿐입니다.

## 삭제

```bash
curl -s -X DELETE http://localhost:18934/jobs/demo-heartbeat -w '\n%{http_code}\n'
```

## psql 로 직접 뒷단도 확인하고 싶다면

```bash
psql -h localhost -p 15934 -U postgres -d study -c "SELECT * FROM cron.job;"
```

---

## 정리

| | |
|---|---|
| 이 lab 이 보여주는 것 | pg_cron 을 REST API 뒤로 감싸는 패턴 |
| 핵심 포인트 | DB 레이어의 검증(cron 문법)을 API 레이어에서 재구현하지 않고 그대로 전달 |
| 다음으로 볼 것 | `api/main.py` - 프로덕션이라면 인증/인가, SQL 화이트리스트가 더 필요하다 |

## 다음 단계

- 종합 카탈로그 문서: [`../../README.md`](../../README.md)
- 심화 설명: 웹 `#/pg-cron/recipes`, `#/pg-cron/failures`, `#/pg-cron/limits`

자동 검증과 별도로 수동 절차를 처음부터 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용합니다.

재활성화는 같은 PATCH에 `{"active": true}`를 보냅니다. 실습을 마치면 `./run.sh down`으로 컨테이너와 실습 데이터를 정리합니다.

# Lab 05 · 수동 실습

```bash
./run.sh up
```

`postgres`는 localhost:15934, `api`는 localhost:18934에서 실행된다. Swagger UI는 다음 주소에서 연다.

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

부하가 있으면 5초 뒤에도 실행이 끝나지 않을 수 있으므로 이력을 다시 조회한다. `status: "succeeded"`인 행이 있으면 예약 SQL이 완료된 것이다.

## 비활성화

```bash
curl -s -X PATCH http://localhost:18934/jobs/demo-heartbeat \
  -H 'Content-Type: application/json' -d '{"active": false}'
```

## 잘못된 예약식의 오류 응답

```bash
curl -s -X POST http://localhost:18934/jobs \
  -H 'Content-Type: application/json' \
  -d '{"name":"bad","schedule":"not-a-cron-expression","sql":"SELECT 1"}'
```
```json
{"detail": "invalid schedule: not-a-cron-expression\nHINT:  Use cron format (e.g. 5 4 * * *), or interval format '[1-59] seconds'"}
```

이 예제는 pg_cron의 예약식 검증 오류를 HTTP 400 응답으로 변환한다. API에서 같은 문법 검사를 중복 구현하지 않는다.

## 삭제

```bash
curl -s -X DELETE http://localhost:18934/jobs/demo-heartbeat -w '\n%{http_code}\n'
```

## psql에서 예약 테이블 확인

```bash
psql -h localhost -p 15934 -U postgres -d study -c "SELECT * FROM cron.job;"
```

---

## 정리

| | |
|---|---|
| 실습 내용 | REST API에서 pg_cron 관리 함수 호출 |
| 오류 처리 | pg_cron의 예약식 오류를 HTTP 400 응답으로 변환 |
| 운영 전 추가 사항 | `api/main.py`에 인증·인가와 허용 작업 제한 필요 |

## 다음 단계

- 카탈로그 문서: [`../../README.md`](../../README.md)
- 상세 설명: 웹 `#/pg-cron/recipes`, `#/pg-cron/failures`, `#/pg-cron/limits`

수동 절차를 처음부터 다시 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용한다.

재활성화하려면 같은 PATCH 요청에 `{"active": true}`를 보낸다. 실습을 마치면 `./run.sh down`으로 컨테이너와 실습 데이터를 정리한다.

# Lab 05 직접 해보기 - FastAPI + pg_stat_statements

이 lab 은 psql 워크스루가 아닙니다. `./run.sh up` 으로 띄운 뒤, 브라우저와 `curl` 로 직접 만져보세요.

```bash
./run.sh up
```

기동 후 http://localhost:18924/docs 를 열면 Swagger UI 에서 모든 엔드포인트를 클릭만으로 호출해볼 수 있습니다.

## 1. 통계 초기화

```bash
curl -X POST http://localhost:18924/admin/reset-stats
```

## 2. 버그 엔드포인트를 몇 번 호출한다

```bash
curl http://localhost:18924/users/1/orders | python3 -m json.tool
curl "http://localhost:18924/orders/search?item=keyboard"
curl "http://localhost:18924/orders/search?item=chair"
```

`user_id=1` 은 시드 데이터에서 주문을 25개 갖도록 만들어뒀습니다 - `/users/1/orders` 를 한 번만 호출해도 내부적으로 `SELECT * FROM orders WHERE id = $1` 이 25번 실행됩니다.

## 3. admin 엔드포인트로 잡아낸다

```bash
curl "http://localhost:18924/admin/top-queries?limit=8" | python3 -m json.tool
curl http://localhost:18924/admin/n-plus-one-suspects | python3 -m json.tool
```

`n-plus-one-suspects` 응답에서 `"query": "SELECT * FROM orders WHERE id = $1"` 항목의 `calls` 가 25 근처로 찍히는 것을 확인하세요 - 애플리케이션 로그를 하나도 안 보고 API 트래픽 패턴만으로 N+1 N+1을 의심할 근거를 얻은 것입니다. calls만으로는 정상적인 반복 트래픽과 구분할 수 없으므로 요청당 쿼리 수와 코드를 함께 확인합니다.

## 4. 직접 고쳐보기 (선택)

`api/main.py`의 기존 `@app.get` 데코레이터는 유지하고, `get_user_orders` 함수 전체를 아래처럼 바꾼 뒤 다시 빌드해보세요.

```python
def get_user_orders(user_id: int):
    with get_conn() as conn:
        orders = conn.execute(
            "SELECT * FROM orders WHERE user_id = %s", (user_id,)
        ).fetchall()
    return {"user_id": user_id, "count": len(orders), "orders": orders}
```

```bash
docker compose up --build -d api
curl -X POST http://localhost:18924/admin/reset-stats
curl http://localhost:18924/users/1/orders >/dev/null
curl http://localhost:18924/admin/n-plus-one-suspects | python3 -m json.tool
```

`n-plus-one-suspects` 목록에서 그 쿼리가 사라지는 것(또는 `calls=1` 로 바뀌는 것)을 확인하면 끝입니다.

---

## 정리

| | |
|---|---|
| 이 lab 이 보여주는 것 | pg_stat_statements 는 psql 전용 도구가 아니라, 백엔드 서비스 자신의 admin API 로도 그대로 노출할 수 있다 |
| 실무 적용 | 사내 관리자 페이지/헬스체크 엔드포인트에 `/admin/top-queries` 류의 엔드포인트를 두면, 별도 모니터링 도구 없이도 "지금 뭐가 느린가"에 답할 수 있다 |

## 다음 단계

- 이전 랩: [`../04-dba-playbook-and-pitfalls/`](../04-dba-playbook-and-pitfalls)
- 전체 목록: [`../README.md`](../README.md)
- 종합 카탈로그 문서: [`../../README.md`](../../README.md)

자동 검증과 별도로 수동 절차를 처음부터 실행하려면 `./run.sh down` 후 `./run.sh up`을 사용합니다.

실습을 마치면 `./run.sh down`으로 컨테이너와 실습 데이터를 정리합니다.

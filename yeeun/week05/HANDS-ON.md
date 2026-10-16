# 같이 해보기 — `postgres-json-schema`

| | |
| --- | --- |
| 시간 | 15~20분 |
| 필요 | Docker Desktop |
| 경로 | `yeeun/week05/lab` · 포트 **15505** |
| 목표 | Schema CHECK 동작 + **20k INSERT 성능** 확인 |

```bash
cd yeeun/week05/lab
./run.sh          # 01→04 자동 (벤치 포함)
./run.sh 04       # 벤치만
./run.sh down
```

---

## 이 실습에서 보는 것

| 단계 | 파일 | 내용 |
| --- | --- | --- |
| 01 | `sql/01-setup.sql` | Extension · `product_json_demo` · Schema CHECK |
| 02 | `sql/02-inserts.sql` | 정상 INSERT · Type / required / 추가필드 / minimum 실패 |
| 03 | `sql/03-update.sql` | 정상 UPDATE · 잘못된 UPDATE 거부 |
| 04 | `sql/04-bench.sql` | plain vs Schema CHECK · **20,000 INSERT** |

데모 Schema:

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "price": { "type": "number", "minimum": 0 }
  },
  "required": ["name", "price"],
  "additionalProperties": false
}
```

---

## 실측 결과 (Docker · 2026-10-07)

| 항목 | 값 |
| --- | --- |
| 환경 | PostgreSQL **16.15** (Docker `postgres:16-bookworm`, aarch64) |
| Extension | `postgres-json-schema` **0.1.1** |
| 포트 | `15505` |

### 함수만 호출

| 호출 | 결과 |
| --- | --- |
| `validate_json_schema('{"type":"object"}', '{}')` | `t` |
| `validate_json_schema('{"type":"object"}', '1')` | `f` |

### CHECK + INSERT / UPDATE

| 케이스 | 결과 |
| --- | --- |
| `{"name":"Keyboard","price":50000}` INSERT | 성공 (`id=1`) |
| `"price": "50000"` (string) | `check_violation` |
| `price` 누락 | `check_violation` |
| `"hello":"world"` 추가 | `check_violation` |
| `"price": -1000` | `check_violation` |
| 정상 UPDATE → `price: 45000` | 성공 |
| UPDATE `"price":"오만원"` | `check_violation` (기존 row 유지) |

### 20,000 Row INSERT 성능 (`04-bench`)

같은 payload를 `generate_series(1, 20000)`으로 INSERT.

| 방식 | 시간 | 상대 |
| --- | ---: | --- |
| plain JSONB (CHECK 없음) | **0.069초** (69 ms) | 1× |
| `CHECK` + `validate_json_schema()` | **2.772초** | 약 **40×** |

```text
INSERT / UPDATE
  → CHECK
  → validate_json_schema()   ← row마다
  → 저장
```

공개 사례(다른 환경)에서는 같은 20k에서 `postgres-json-schema` ~5.54초 · `pg_jsonschema` ~0.35초가 나온 적도 있다. lab 수치는 **plain 대비 우리 Docker에서의 비용**을 보는 용도.

### 한 줄 정리

```text
동작: 쓰기 경로와 무관하게 Schema 위반은 check_violation
비용: 대량 쓰기에서는 Validation이 초 단위로 커질 수 있음
     → 핵심 JSONB에만 선택 적용 + 필요 시 다른 Extension 비교
```

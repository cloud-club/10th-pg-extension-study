# postgres-json-schema

> PostgreSQL의 `JSON` / `JSONB` Column에 저장되는 데이터가 미리 정의한 **JSON Schema를 만족하는지 검증**할 수 있도록 하는 Extension

| 항목 | 내용 |
| --- | --- |
| 카테고리 | Data Validation · JSON |
| 주요 목적 | JSON / JSONB 구조 검증 |
| 주요 비교 대상 | Application Validation, PostgreSQL `CHECK` Constraint |
| 핵심 특징 | JSONB의 유연성을 유지하면서 데이터 구조를 DB에서도 검증 |
| 주요 함수 | `validate_json_schema()` |
| JSON Schema | Draft 4 (remote HTTP `$ref` 미지원) |
| 회차 | `week05` |
| 정리한 사람 | 김예은 |
| 저장소 | [gavinwahl/postgres-json-schema](https://github.com/gavinwahl/postgres-json-schema) |

## 한눈에 보는 흐름

```text
JSONB (유연한 구조)
        ↓
잘못된 형태도 “올바른 JSON”이면 저장 가능
        ↓
Application Validation (대부분의 경로만 보호)
        ↓
Batch / Script / Migration / 직접 SQL 은 우회 가능
        ↓
JSON Schema 로 “원하는 구조” 정의
        ↓
validate_json_schema() + CHECK
        ↓
postgres-json-schema
```

| 질문 | 기본 PostgreSQL | + postgres-json-schema |
| --- | --- | --- |
| 올바른 JSON인가? | O (`JSONB`) | O |
| 우리 서비스가 원하는 구조인가? | X (기본은 모름) | O (`CHECK` + Schema) |

---

## 1. 어떤 문제를 해결하는가

```sql
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    option_info JSONB
);
```

상품마다 옵션 형태가 다르면 관계형 Column을 늘리기보다 JSONB가 편할 수 있다.

```json
{ "color": "black", "size": "M" }
{ "capacity": "500ml" }
```

장점: **구조가 유연하다.**  
단점: **원하는 구조를 DB가 자동으로 보장하지 않는다.**

---

## 2. JSONB는 구조를 자동으로 보장하지 않는다

원하는 데이터:

```json
{ "color": "black", "stock": 10 }
```

`option_info JSONB`만으로는 다음도 “올바른 JSON”이라 저장된다.

```json
{ "color": 123, "stock": "많음" }
{ "hello": "world" }
```

| PostgreSQL이 기본적으로 확인 | 확인하지 않음 |
| --- | --- |
| 올바른 JSON인가? | 우리 서비스가 원하는 구조인가? |

---

## 3. JSON vs JSON Schema

| | JSON | JSON Schema |
| --- | --- | --- |
| 역할 | 실제 데이터 | 데이터가 따라야 할 규칙 |
| 예 | `{"name":"Keyboard","price":50000}` | `type/object`, `properties`, `required` … |

Schema 예:

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "price": { "type": "number" }
  },
  "required": ["name", "price"]
}
```

의미: 전체는 object · `name` string · `price` number · 둘 다 필수.

---

## 4. Application Validation만으로 충분한가

```text
Client → API → Application Validation → PostgreSQL
```

대부분은 막히지만, 운영 DB에는 여러 입력 경로가 있다.

```text
Web Application · Batch · 관리자 Script · Migration · 외부 Sync · 직접 SQL
```

Batch가 Application을 우회하면:

```sql
INSERT INTO products(option_info)
VALUES ('{"price": "50000원"}');
```

동일 규칙이 적용되지 않을 수 있다.

> DB에 최종 저장되는 데이터에도 같은 규칙을 걸 수 없을까?

---

## 5. CHECK Constraint

```sql
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    price INTEGER CHECK (price >= 0)
);
```

```text
INSERT/UPDATE → CHECK → TRUE면 저장 / FALSE면 거부
```

---

## 6. JSONB + CHECK의 한계

단순 규칙은 JSONB 함수로도 가능:

```sql
CHECK (jsonb_typeof(option_info->'stock') = 'number')
```

구조가 커지면 (object · required · array items · additionalProperties 금지 …) SQL Expression이 급격히 복잡해진다. → **JSON Schema**를 DB에서 쓰는 쪽이 자연스럽다.

---

## 7. `postgres-json-schema`

핵심 함수:

```sql
validate_json_schema(JSON_SCHEMA, JSON_DATA)  -- TRUE / FALSE
```

`CHECK`와 결합:

```text
JSONB 입력 → validate_json_schema() → CHECK → 저장 / 거부
```

---

## 8. 설치

```sql
CREATE EXTENSION "postgres-json-schema";
```

preload 불필요 (PL/pgSQL Extension). lab: [`../lab/`](../lab/)

---

## 9. 가장 간단한 예제

```sql
CREATE TABLE example (
    id SERIAL PRIMARY KEY,
    data JSONB
);

ALTER TABLE example
ADD CONSTRAINT data_is_valid
CHECK (validate_json_schema('{"type": "object"}', data));
```

| 입력 | 결과 |
| --- | --- |
| `'{}'` | INSERT 성공 |
| `'1'` | CHECK 위반 (object 아님) |

---

## 10. 현실적인 Schema + Table

원하는 데이터:

```json
{ "name": "Keyboard", "price": 50000 }
```

```sql
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    product_info JSONB,
    CHECK (
        validate_json_schema(
            '{
              "type": "object",
              "properties": {
                "name": { "type": "string" },
                "price": { "type": "number" }
              },
              "required": ["name", "price"]
            }',
            product_info
        )
    )
);
```

---

## 11–13. 통과 / 실패 케이스

| 케이스 | 데이터 | 결과 |
| --- | --- | --- |
| 정상 | `name` string + `price` number | 성공 |
| Type 오류 | `"price": "50000"` (string) | 실패 |
| required 누락 | `price` 없음 | 실패 |

```text
Schema: price = number
Data:   price = "50000" (string)
        → Validation 실패
```

---

## 14. `properties` vs `required`

| 키워드 | 의미 |
| --- | --- |
| `properties` | 해당 Property가 **있을 때**의 규칙 |
| `required` | Property가 **반드시 존재**해야 함 |

`properties`만 있으면 “있으면 string”이지 “반드시 있어야 함”이 아니다.

---

## 15. 추가 Property 금지

```json
"additionalProperties": false
```

정의되지 않은 `"hello": "world"` 가 있으면 실패.

---

## 16. Array

```json
{
  "type": "object",
  "properties": {
    "tags": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

| 데이터 | 결과 |
| --- | --- |
| `["keyboard","electronics"]` | 성공 |
| `["keyboard", 123]` | 실패 |

---

## 17. 값 범위

| 키워드 | 예 |
| --- | --- |
| `maxLength` | string 최대 길이 |
| `minimum` | number 최솟값 |
| `minItems` | array 최소 개수 |

Type만이 아니라 구조·값 규칙을 함께 표현한다.

---

## 18–19. 동작 · CHECK와 함께 쓰는 이유

```text
INSERT/UPDATE
  → CHECK
  → validate_json_schema()
  → TRUE 저장 / FALSE 거부
```

함수만 호출하면 검사 결과만 보이고, **앞으로의 저장을 자동으로 막지는 않는다.**  
Table `CHECK`에 넣어야 모든 INSERT/UPDATE에 적용된다.

---

## 20. App Validation과 역할 분담

| 항목 | Application | DB (`postgres-json-schema`) |
| --- | --- | --- |
| 위치 | App | PostgreSQL |
| 친절한 에러 | 쉬움 | 상대적으로 어려움 |
| API 단계에서 즉시 검사 | O | X |
| 직접 SQL / Batch에도 적용 | X | O |
| 최종 무결성 | 제한적 | O |

```text
Client → App Validation (빠른·친절한 오류)
      → PostgreSQL JSON Schema (최종 무결성)
```

---

## 21. 그냥 Column이면 안 되나

구조가 고정이면 일반 Column이 더 자연스럽다.

JSONB가 어울리는 경우: 상품마다 구조가 다름 · 외부 API Payload · Metadata · 구조 변경이 잦음.

```text
JSON Schema를 쓸 수 있다 ≠ 모든 데이터를 JSONB로 만들자
```

---

## 22–23. 실무 예 · 상품 옵션

외부/옵션 JSON이 예상과 다르면 저장 단계에서 걸러낼 수 있다.

```text
외부 API → 수집 App → JSONB → Schema Validation → 저장/거부
```

옵션 Schema 예: `option_name` string · `values` string array · 둘 다 required.

---

## 24–27. 실습 개요

자세한 절차·실측: [`../HANDS-ON.md`](../HANDS-ON.md) · [`../lab/`](../lab/)

데모 Table 핵심 Schema:

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

실패 시나리오: price string · required 누락 · 추가 property · 음수 price · 잘못된 UPDATE.

---

## 28. INSERT / UPDATE 성능 비용

`CHECK`에 넣으면 JSONB가 저장·변경될 때마다 `validate_json_schema()`가 돈다.

```text
INSERT / UPDATE
  → CHECK
  → validate_json_schema()
  → JSON Schema 해석 + 데이터 검증
  → 저장
```

이 Extension은 **PL/pgSQL**로 Schema를 해석한다. 그래서 일반적인 JSONB INSERT보다 CPU 비용이 크고, C/Rust 기반 JSON Schema Extension보다 Validation이 느린 편이다.

```text
상품 1건   → Validation 1회
25,000건   → Validation 25,000회
```

대량 upsert(상품 수집 등) 경로에 무조건 걸면 부담이 커진다. **모든 JSONB에 적용하기보다, 구조가 깨지면 정말 문제인 핵심 JSONB에 선택 적용**하는 편이 낫다.

### lab 실측 · 20,000 Row INSERT (이 레포)

재현: [`../lab/sql/04-bench.sql`](../lab/sql/04-bench.sql) · PostgreSQL 16.15 · Docker aarch64 · Schema는 demo와 동일(단순 object)

| 방식 | 20,000 Row INSERT | 상대 |
| --- | ---: | --- |
| plain JSONB (CHECK 없음) | **약 0.069초** (69 ms) | 1× |
| `CHECK` + `validate_json_schema()` | **약 2.77초** | 약 **40×** |

```text
같은 20,000건이라도 Schema CHECK만으로 수 초 단위로 늘어날 수 있다.
```

수치는 Hardware · PG Version · Schema 복잡도 · JSON 크기 · Batch 형태에 따라 달라진다. 참고용으로만 본다.

### 공개 Benchmark 참고 (다른 Extension과의 비교)

단순 Schema로 20,000 INSERT를 돌린 공개 사례에서는 `postgres-json-schema`가 약 **5.54초**, Rust 기반 `pg_jsonschema`가 약 **0.35초**로 나온 적이 있다(약 15배 차이). 환경이 다르므로 위 lab 수치와 직접 비교하지는 않는다.

성능이 중요한 신규 시스템이라면 `postgres-json-schema`만 보지 말고 C/Rust 구현(`pg_jsonschema`, `is_jsonb_valid` 등)도 같이 비교하는 것이 좋다.

영향이 큰 요인:

```text
JSON 크기 · Schema 복잡도 · Array/Nested 깊이
검증 Property 수 · 초당 INSERT/UPDATE · Batch 크기
```

| 비교적 부담이 작은 편 | Benchmark 후 판단 |
| --- | --- |
| 일반 CRUD · 작은 JSON · 단순한 Schema | 대량 수집 · 높은 Write Throughput · 복잡한 Payload |

---

## 29–30. 장단점

| 장점 | 단점 |
| --- | --- |
| JSONB 구조를 DB에서 검증 | **대량 쓰기에서 성능 부담이 클 수 있음** (PL/pgSQL Validation) |
| 모든 입력 경로에 동일 규칙 | Schema도 App과 함께 관리 |
| 선언적 Validation | 너무 엄격하면 유연성 감소 |
| 구조를 문서처럼 표현 | 친절한 UX 에러는 App이 유리 |
| 저장 단계에서 조기 차단 | 모든 JSONB에 필수는 아님 |

```text
더 강한 무결성  ↕  대량 쓰기 Validation 비용 + Schema 관리
```

아이디어(JSON Schema를 DB Constraint로)는 좋지만, **신규 도입 시에는 더 빠른 현대적 구현도 비교**할 가치가 있다.

---

## 31–33. 언제 / 주의

**고려:** JSONB 사용 + 내부 규칙 존재 + 다중 입력 경로 + 잘못된 구조가 후속에 치명적  
(외부 Payload · Option · Webhook · 설정 · Metadata · Event)

**비고려:** JSONB 거의 없음 · 완전 자유 구조 · 관계형으로 충분 · Schema 잦은 변경 · **대량 Batch INSERT가 핵심 경로** · 단순 로그성 Metadata

주의: 처음부터 모든 Field를 과도하게 고정하기보다 **무결성에 중요한 부분**부터. Schema 변경 시 기존 데이터·Constraint Migration 확인.

---

## 34–35. 한계 · 이름 혼동

- Draft **4** · remote HTTP `$ref` 미지원  
- **오래된 PL/pgSQL 구현** · 유사 Extension으로 `pg_jsonschema` 등이 있음 (함수명이 다름)

| Extension | 대표 함수 | 구현 쪽 메모 |
| --- | --- | --- |
| `postgres-json-schema` | `validate_json_schema()` | PL/pgSQL · 쓰기 비용 큼 |
| `pg_jsonschema` | `jsonb_matches_schema()` 등 | Rust · 공개 bench에서 더 빠른 사례 |
| `is_jsonb_valid` | (C) | 과거 bench에서 대량일수록 처리량 유리한 사례 |

예제를 섞어 쓰지 않도록 주의.

---

## 36. 전체 흐름

```text
JSONB 유연성
  → 잘못된 구조도 저장 가능
  → App Validation (경로 일부만)
  → JSON Schema + validate_json_schema + CHECK
  → INSERT/UPDATE 시 저장/거부
```

---

## 정리

핵심 가치: **JSONB 유연성을 유지하면서 DB에 최소 구조 규칙을 거는 것.**  
비용: 매 쓰기 Validation(대량 INSERT에서 특히 큼) · Schema·App 이중 관리.

> JSONB를 써야 하지만 아무 형태나 저장되면 안 되고, App뿐 아니라 Batch·Migration·직접 SQL에서도 최소 구조를 DB가 보장해야 할 때.

---

## 39. 벤치마크 / 실습 결과

재현: [`../lab/`](../lab/) · [`../HANDS-ON.md`](../HANDS-ON.md)  
환경: PostgreSQL **16.15** · `postgres-json-schema` **0.1.1** · 포트 **15505** · Docker (2026-10-07, aarch64)

### 동작 확인 (01–03)

| 케이스 | 결과 |
| --- | --- |
| object Schema + `'{}'` | `validate_json_schema` → `t` |
| object Schema + `'1'` | `f` |
| 정상 INSERT (`name`+`price`) | 성공 |
| price string / required 누락 / 추가 field / 음수 price | 모두 `check_violation` |
| 정상 UPDATE (`45000`) | 성공 |
| 잘못된 UPDATE (`"오만원"`) | `check_violation` · row 유지 |

실패 INSERT 4건 + 잘못된 UPDATE 1건 후에도 테이블 row 수는 **1**.

### 20k INSERT 성능 (04-bench)

| 방식 | 시간 |
| --- | ---: |
| plain JSONB | **0.069초** |
| `CHECK` + `validate_json_schema` | **2.772초** (~40×) |

```text
쓰기 경로와 무관하게 CHECK + JSON Schema 가 동일하게 적용된다.
대량 쓰기에서는 Validation 비용이 눈에 띄게 커질 수 있다.
```

---

## 참고 자료

- [gavinwahl/postgres-json-schema](https://github.com/gavinwahl/postgres-json-schema)
- [supabase/pg_jsonschema](https://github.com/supabase/pg_jsonschema) · [PGXN pg_jsonschema](https://pgxn.org/dist/pg_jsonschema/) (성능 비교 참고)
- [furstenheim/is_jsonb_valid](https://github.com/furstenheim/is_jsonb_valid)
- JSON Schema Draft 4 · `properties` / `required` / `additionalProperties` / `items` / `minimum`
- PostgreSQL `JSONB` · `CHECK` Constraint

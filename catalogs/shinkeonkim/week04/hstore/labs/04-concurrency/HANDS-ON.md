# Lab 04 · 수동 실습

터미널 두 개가 필요하다.

```bash
./run.sh up
./run.sh psql        # 터미널 A
./run.sh psql        # 터미널 B
```

준비 (A):

```sql
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE TABLE doc (id int PRIMARY KEY, attrs hstore NOT NULL);
INSERT INTO doc VALUES (1, 'a=>1');
```

---

## 1. 같은 행이면 다른 키도 기다린다

A:

```sql
BEGIN;
UPDATE doc SET attrs = attrs || 'b=>2' WHERE id = 1;
```

B (A가 커밋하기 전에):

```sql
UPDATE doc SET attrs = attrs || 'c=>3' WHERE id = 1;    -- 멈춘다
```

A (다른 창에서 확인, 또는 B가 기다리는 동안):

```sql
SELECT pid, state, wait_event_type, wait_event, left(query, 50) FROM pg_stat_activity WHERE wait_event_type = 'Lock';
COMMIT;
SELECT attrs FROM doc WHERE id = 1;                     -- a, b, c 모두 있다
```

---

## 2. 통째로 쓰면 유실된다

```sql
UPDATE doc SET attrs = 'a=>1';
-- A: SELECT attrs FROM doc WHERE id = 1;  → "a"=>"1"
-- B: SELECT attrs FROM doc WHERE id = 1;  → "a"=>"1"
-- A: UPDATE doc SET attrs = '"a"=>"1"'::hstore || 'b=>2' WHERE id = 1;
-- B: UPDATE doc SET attrs = '"a"=>"1"'::hstore || 'c=>3' WHERE id = 1;
SELECT attrs FROM doc WHERE id = 1;                     -- b 가 사라졌다
```

---

## 3. FOR UPDATE 와 REPEATABLE READ

A: `BEGIN; SELECT attrs FROM doc WHERE id = 1 FOR UPDATE;` (커밋하지 않고 둔다)
B: `BEGIN; SELECT attrs FROM doc WHERE id = 1 FOR UPDATE;` → A가 끝날 때까지 기다린다.

B: `BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT 1;` 후 A가 `UPDATE ... COMMIT`, 이어서 B가 같은 행을 `UPDATE` → `could not serialize access due to concurrent update`.

---

## 4. pgbench

```bash
./run.sh shell
bash /lab/scripts/s5-counter-pgbench.sh
```

---

- 이전 랩: [`../03-indexes/`](../03-indexes)
- 종합 문서: [`../../README.md`](../../README.md)

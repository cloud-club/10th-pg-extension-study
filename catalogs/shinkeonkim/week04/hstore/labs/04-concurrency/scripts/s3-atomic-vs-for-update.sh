#!/usr/bin/env bash
# 유실을 막는 두 방법: (1) SET attrs = attrs || ... 원자적 갱신, (2) SELECT ... FOR UPDATE 로 읽기 전에 잠금
source /lab/scripts/common.sh

echo "=== (1) 원자적 갱신: 새 값을 UPDATE 안에서 계산한다 ==="
reset_doc
$P -c "BEGIN; UPDATE doc SET attrs = attrs || 'b=>2' WHERE id = 1; SELECT pg_sleep(2); COMMIT;" > /dev/null &
A=$!
sleep 0.5
$P -c "UPDATE doc SET attrs = attrs || 'c=>3' WHERE id = 1;" &
B=$!
wait $A $B
[ "$(keys_of_doc)" = 3 ] || fail "(1) 원자적 갱신 후 a·b·c 가 모두 남아야 한다"
$P -c "SELECT attrs FROM doc WHERE id = 1;"
echo "  -> B 는 A 가 커밋하길 기다린 뒤, '최신 행'에 대해 식을 다시 계산했다 (READ COMMITTED 의 재평가)."

echo
echo "=== (2) SELECT ... FOR UPDATE: 읽는 순간 행을 잠근다 ==="
reset_doc
$P -c "BEGIN; SELECT attrs FROM doc WHERE id = 1 FOR UPDATE; SELECT pg_sleep(2); UPDATE doc SET attrs = attrs || 'b=>2' WHERE id = 1; COMMIT;" > /dev/null &
A=$!
sleep 0.5
old_b=$($P -At -c "BEGIN; SELECT attrs FROM doc WHERE id = 1 FOR UPDATE; COMMIT;" | head -1)
wait $A
echo "  B 는 A 의 커밋을 기다렸다가 '최신' 값을 읽었다: $old_b"
$P -v old="$old_b" <<'SQL'
UPDATE doc SET attrs = :'old'::hstore || 'c=>3' WHERE id = 1;
SQL
$P -c "SELECT attrs FROM doc WHERE id = 1;"
[ "$(keys_of_doc)" = 3 ] || fail "(2) 후에도 a·b·c 가 모두 남아야 한다"
echo "✔ 두 방법 모두 유실이 없었다"

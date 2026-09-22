#!/usr/bin/env bash
# REPEATABLE READ: 내 스냅샷 이후에 남이 커밋한 행을 갱신하려 하면 오류 (재시도는 앱 몫)
source /lab/scripts/common.sh
reset_doc
echo "세션 B: REPEATABLE READ 로 스냅샷을 잡고 2초 뒤 갱신을 시도한다"
$P -c "BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT count(*) FROM doc; SELECT pg_sleep(2); UPDATE doc SET attrs = attrs || 'c=>3' WHERE id = 1; COMMIT;" > /tmp/rr.out 2>&1 &
B=$!
sleep 0.5
echo "세션 A: 그 사이에 b 를 추가하고 커밋한다"
$P -c "UPDATE doc SET attrs = attrs || 'b=>2' WHERE id = 1;"
wait $B || true
echo
echo "[B 의 결과]"
grep -E "ERROR|HINT" /tmp/rr.out || cat /tmp/rr.out
echo
echo "[최종 행] B 의 변경은 적용되지 않았다:"
$P -c "SELECT attrs FROM doc WHERE id = 1;"
grep -q "could not serialize access" /tmp/rr.out || fail "직렬화 오류(40001)가 나야 한다"
[ "$($P -At -c "SELECT attrs ? 'c' FROM doc WHERE id = 1")" = f ] || fail "B 의 변경은 적용되지 않아야 한다"
echo "✔ REPEATABLE READ 에서 오류로 거절됐다"

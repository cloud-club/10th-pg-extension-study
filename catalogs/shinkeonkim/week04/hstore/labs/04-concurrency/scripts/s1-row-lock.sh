#!/usr/bin/env bash
# 서로 다른 키를 바꾸는데도 같은 행이면 기다리는가? 기다린 뒤 두 변경이 다 남는가?
source /lab/scripts/common.sh
reset_doc
echo "세션 A: 키 b 를 추가하고, 3초 동안 커밋하지 않는다"
$P -c "BEGIN; UPDATE doc SET attrs = attrs || 'b=>2' WHERE id = 1; SELECT pg_sleep(3); COMMIT;" > /dev/null &
A=$!
sleep 1
echo "세션 B: (A 가 커밋하기 전에) 같은 행에서 다른 키 c 를 추가한다"
T0=$(now_ms)
$P -c "UPDATE doc SET attrs = attrs || 'c=>3' WHERE id = 1;" &
B=$!
sleep 1
echo
echo "[관찰] B 는 지금 무엇을 기다리나 (pg_stat_activity):"
$P -c "SELECT state, wait_event_type, wait_event, left(query, 52) AS query FROM pg_stat_activity WHERE datname = 'study' AND wait_event_type = 'Lock';"
wait $A $B
echo "B 가 끝날 때까지 걸린 시간: $(( $(now_ms) - T0 )) ms  (A 가 커밋할 때까지 기다렸다)"
echo
echo "[결과] 두 변경이 모두 남았다:"
$P -c "SELECT attrs FROM doc WHERE id = 1;"
[ "$(keys_of_doc)" = 3 ] || fail "키 a·b·c 3개가 남아야 한다"
echo "✔ B 가 A 를 기다렸고 두 변경이 모두 남았다"

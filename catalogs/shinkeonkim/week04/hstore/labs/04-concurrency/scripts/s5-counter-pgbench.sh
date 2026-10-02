#!/usr/bin/env bash
# pgbench 로 8개 세션이 카운터를 각각 50번(총 400번) 올린다
source /lab/scripts/common.sh
run() {  # $1 = 이름, $2 = 스크립트 본문, 결과값은 RESULT 에 담는다
  $P -c "DROP TABLE IF EXISTS doc; CREATE TABLE doc (id int PRIMARY KEY, attrs hstore NOT NULL); INSERT INTO doc VALUES (1, 'cnt=>0');"
  printf '%s\n' "$2" > /tmp/bench.sql
  pgbench -n -U postgres -c 8 -j 4 -t 50 -f /tmp/bench.sql study > /dev/null 2>&1 || true
  RESULT="$($P -At -c "SELECT attrs -> 'cnt' FROM doc WHERE id = 1")"
  printf "%-32s 최종 cnt = %s / 400\n" "$1" "$RESULT"
}
run "읽고 → 앱에서 +1 → 쓰기 (RMW)" "SELECT (attrs -> 'cnt')::int AS c FROM doc WHERE id = 1 \\gset
UPDATE doc SET attrs = attrs || hstore('cnt', (:c + 1)::text) WHERE id = 1;"
RMW=$RESULT
run "원자적 UPDATE ... || (식 안에서 +1)" "UPDATE doc SET attrs = attrs || hstore('cnt', ((attrs -> 'cnt')::int + 1)::text) WHERE id = 1;"
ATOMIC=$RESULT
[ "$RMW" -lt 400 ] || fail "읽고-쓰기는 400보다 작아야 한다(유실). 실제 $RMW"
[ "$ATOMIC" = 400 ] || fail "원자적 UPDATE 는 정확히 400 이어야 한다. 실제 $ATOMIC"
echo "✔ 읽고-쓰기는 유실($RMW), 원자적 UPDATE 는 400"

#!/usr/bin/env bash
# 동시 세션 실습 공용: 컨테이너 안에서 psql 세션을 여러 개 띄운다.
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"     # NOTICE 잡음 제거
P="psql -X -q -U postgres -d study"
now_ms() { date +%s%3N; }
fail() { echo "✘ 검증 실패: $*"; exit 1; }
keys_of_doc() { $P -At -c "SELECT count(*) FROM each((SELECT attrs FROM doc WHERE id = 1))"; }
reset_doc() {
  $P -c "CREATE EXTENSION IF NOT EXISTS hstore; DROP TABLE IF EXISTS doc; CREATE TABLE doc (id int PRIMARY KEY, attrs hstore NOT NULL); INSERT INTO doc VALUES (1, 'a=>1');"
}

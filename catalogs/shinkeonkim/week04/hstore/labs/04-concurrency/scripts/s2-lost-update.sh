#!/usr/bin/env bash
# 앱이 읽고 → 계산하고 → 통째로 쓰면 어떻게 되나 (ORM 의 load → modify → save)
source /lab/scripts/common.sh
reset_doc
old_a=$($P -At -c "SELECT attrs FROM doc WHERE id = 1")
old_b=$($P -At -c "SELECT attrs FROM doc WHERE id = 1")
echo "세션 A 가 읽은 값: $old_a"
echo "세션 B 가 읽은 값: $old_b   (A 가 쓰기 전이라 같은 값)"
echo
echo "세션 A: 읽은 값에 b=>2 를 합쳐 UPDATE"
$P -v old="$old_a" <<'SQL'
UPDATE doc SET attrs = :'old'::hstore || 'b=>2' WHERE id = 1;
SQL
echo "세션 B: 자기가 읽은 값에 c=>3 을 합쳐 UPDATE"
$P -v old="$old_b" <<'SQL'
UPDATE doc SET attrs = :'old'::hstore || 'c=>3' WHERE id = 1;
SQL
echo
echo "[결과] A 가 넣은 b 가 사라졌다 (lost update):"
$P -c "SELECT attrs FROM doc WHERE id = 1;"
[ "$($P -At -c "SELECT attrs ? 'b' FROM doc WHERE id = 1")" = f ] || fail "b 가 사라져야 한다(유실 재현)"
echo "✔ 유실 갱신이 재현됐다"

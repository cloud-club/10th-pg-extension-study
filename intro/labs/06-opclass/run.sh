#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# lab 공통 실행 스크립트 (모든 lab 디렉토리에 같은 파일이 들어있다)
#
#   ./run.sh            빌드 -> 기동 -> sql/ 전부 실행
#   ./run.sh up         빌드 & 기동만
#   ./run.sh sql        sql/ 만 실행
#   ./run.sh 03         sql/ 에서 "03" 으로 시작하는 스크립트만 실행
#   ./run.sh psql       psql 셸 접속
#   ./run.sh shell      컨테이너 bash 접속
#   ./run.sh logs       서버 로그 follow
#   ./run.sh down       컨테이너 + 볼륨 삭제 (처음부터 다시 하고 싶을 때)
#   ./run.sh migrate    migrations/ 가 있을 때만 의미가 있다 (지금 lab 들엔 없다)
#
# psql / shell / sql / <번호> 는 컨테이너가 안 떠 있으면 알아서 먼저 띄운다.
# 그래서 어느 명령이든 그것 하나만 쳐도 동작한다.
#
# 실행되는 명령을 전부 화면에 찍는다. 어디서 도는 명령인지 표시가 붙는다.
#   [호스트]    내 컴퓨터에서 도는 명령 (docker ...)
#   [컨테이너]  PostgreSQL 컨테이너 안에서 도는 명령 (psql ...)
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

DB="${POSTGRES_DB:-study}"
DBUSER="${POSTGRES_USER:-postgres}"
LAB="$(basename "$PWD")"

# --- 출력 헬퍼 -------------------------------------------------------------
# 실행할 명령을 먼저 보여주고 나서 실행한다. "무엇이 어디서 도는지"가 보이도록.
dim()   { printf '\033[2m%s\033[0m\n' "$*"; }
cyan()  { printf '\033[36m%s\033[0m\n' "$*"; }

host()  {  # 호스트에서 실행 + 에코
  printf '\033[2m  [호스트]   $\033[0m \033[36m%s\033[0m\n' "$*"
  "$@"
}
ctr() {    # 컨테이너 안에서 실행 + 에코 (docker exec 는 감춘다)
  printf '\033[2m  [컨테이너] #\033[0m \033[36m%s\033[0m\n' "$*"
  docker exec -i "$(cid)" "$@"
}

c()   { docker compose "$@"; }
cid()     { c ps -q postgres; }   # 떠 있는 컨테이너 ID (없으면 빈 문자열)
cid_any() { c ps -aq postgres; }  # 멈춘 것까지 포함

banner() {
  echo
  cyan  "=============================================================="
  cyan  "  lab: $LAB"
  dim   "  호스트 $PWD"
  dim   "     -> 컨테이너 /lab/sql  (ext/ 마운트는 lab 마다 다르다 - docker-compose.yml 의 volumes 참고)"
  dim   "  DB     postgres://$DBUSER@localhost:$(compose_port)/$DB"
  cyan  "=============================================================="
}

compose_port() {  # docker-compose.yml 에 적힌 호스트 포트
  grep -oE '"?[0-9]{4,5}:5432"?' docker-compose.yml 2>/dev/null | head -1 | tr -d '"' | cut -d: -f1
}

# --- 기동 ----------------------------------------------------------------
wait_healthy() {
  # 주의: 공식 postgres 이미지는 첫 기동 시 initdb 를 위해 "임시 서버"를 먼저 띄운다.
  # 그 임시 서버는 listen_addresses='' 라서 유닉스 소켓으로만 접속을 받는다.
  # 따라서 유닉스 소켓으로 pg_isready 를 하면 임시 서버에 붙어 성공해버리고,
  # 곧이어 entrypoint 가 그 서버를 내리면서 연결이 끊긴다.
  #   -> FATAL: terminating connection due to administrator command
  # TCP(-h 127.0.0.1)로 확인하면 진짜 서버가 뜬 뒤에만 성공한다.
  printf '\033[2m  [컨테이너] #\033[0m \033[36m%s\033[0m  (준비될 때까지 반복)\n' \
         "pg_isready -h 127.0.0.1 -p 5432 -U $DBUSER -d $DB"
  local ok=0
  for _ in $(seq 1 180); do
    if docker exec "$(cid)" pg_isready -h 127.0.0.1 -p 5432 -U "$DBUSER" -d "$DB" >/dev/null 2>&1; then
      ok=$((ok + 1))
      [ "$ok" -ge 3 ] && { echo "  ✔ PostgreSQL 준비 완료"; return 0; }
    else
      ok=0
    fi
    sleep 1
  done
  echo "  ✘ 기동 실패 - ./run.sh logs 로 확인하세요" >&2
  exit 1
}

up() {
  banner
  dim "  이미지를 빌드하고 컨테이너를 띄운다. Dockerfile 이 이 lab 에 필요한 extension 을 설치한다."
  host docker compose up --build -d
  wait_healthy
}

# 컨테이너가 안 떠 있으면 먼저 띄운다.
# ./run.sh psql 처럼 명령 하나만 쳐도 그것만으로 동작하게 하기 위한 것.
# (docker compose up 은 여러 번 해도 안전하다)
ensure_up() {
  [ -n "$(cid)" ] && return 0
  dim "  컨테이너가 떠 있지 않아 먼저 띄웁니다 (= ./run.sh up)"
  up
}

# --- SQL 실행 ------------------------------------------------------------
# psql 출력을 읽기 좋게 다듬는다.
#
# 색과 빈 줄은 전부 여기서만 넣는다. SQL 스크립트 자체에는 색 코드가 하나도 없어야
# 실습 자료로 읽을 때 방해가 되지 않는다.
#
# 에코된 쿼리를 알아보는 법: psql -e 는 쿼리 원문을 컬럼 0 에서 시작해 찍고,
# 그 원문은 항상 세미콜론으로 끝난다. 반면 명령 태그(CREATE EXTENSION, DO, INSERT 0 1 …)
# 도 컬럼 0 에서 시작하지만 세미콜론이 없다. 그래서 SQL 키워드로 시작하는 줄을
# 세미콜론이 나올 때까지 모아보고, 세미콜론으로 끝나면 쿼리로 판정한다.
prettify() {
  local color=0
  [ -t 1 ] && [ -z "${NO_COLOR:-}" ] && color=1
  awk -v color="$color" '
    function paint(s, c) { return color ? "\033[" c "m" s "\033[0m" : s }
    function flush_buf(is_query,   i) {
      if (n == 0) return
      if (is_query) { print "" }
      for (i = 1; i <= n; i++) print (is_query ? paint(buf[i], "36") : buf[i])
      n = 0
    }
    BEGIN { n = 0 }
    # 섹션 구분: 박스 테두리와 --- 제목 --- 을 눈에 띄게, 앞에 빈 줄
    /^\+-+\+$/            { flush_buf(0); if (!inbox) print ""; inbox = !inbox; print paint($0, "1;33"); next }
    inbox                 { print paint($0, "1;33"); next }
    /^--- .* ---$/        { flush_buf(0); print ""; print paint($0, "1;33"); next }
    /^=+( .* =+)?$/       { flush_buf(0); print ""; print paint($0, "1;33"); next }
    # psql 메타 명령(\dx 등)과 컨테이너 셸 명령도 "실행하는 것"이므로 같은 색
    /^\\/                  { flush_buf(0); print ""; print paint($0, "36"); next }
    /^  \[컨테이너 셸\] \$/ { flush_buf(0); print ""; print paint($0, "36"); next }
    # 명령 태그(DROP TABLE, INSERT 0 1, DO …)는 결과이지 쿼리가 아니다.
    # 대문자와 숫자로만 이루어지고 세미콜론이 없다는 점으로 구분한다.
    # 쿼리를 모으는 중일 때는 그 쿼리의 일부일 수 있으므로 n == 0 일 때만 적용한다.
    n == 0 && /^[A-Z][A-Z0-9 ]*$/ { print; next }
    # 쿼리 후보를 모은다
    n > 0 {
      buf[++n] = $0
      if ($0 ~ /;[[:space:]]*$/) { flush_buf(1) }
      else if ($0 ~ /^[[:space:]]*$/ || $0 ~ /^\(/) { flush_buf(0) }
      next
    }
    # \y(단어 경계)는 GNU awk 전용이라 macOS awk 에서 안 통한다. 이식성 있게 쓴다.
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH|EXPLAIN|DO|SET|RESET|BEGIN|COMMIT|ROLLBACK|VACUUM|ANALYZE|COPY|GRANT|REVOKE|TRUNCATE|COMMENT|CALL|SHOW|PREPARE|EXECUTE|IMPORT|REFRESH)([ \t(;]|$)/ {
      buf[++n] = $0
      if ($0 ~ /;[[:space:]]*$/) flush_buf(1)
      next
    }
    { flush_buf(0); print }
    END { flush_buf(0) }
  '
}

run_file() {  # $1 = 호스트 경로 (예: sql/01-x.sql), 컨테이너에는 /lab/<dir>/ 로 마운트됨
  local host_path="$1" dir base
  dir="$(dirname "$host_path")"; base="$(basename "$host_path")"
  echo
  cyan "-- $host_path --------------------------------------------"
  dim  "   호스트의 ./$host_path 가 컨테이너 /lab/$dir/$base 로 보인다"
  # -e : 실행하는 SQL 문을 결과 앞에 그대로 찍는다 (무슨 쿼리가 도는지 보이도록)
  ctr psql -e -v ON_ERROR_STOP=1 -U "$DBUSER" -d "$DB" -f "/lab/$dir/$base" 2>&1 | prettify
}

run_dir() {   # $1 = migrations | sql
  shopt -s nullglob
  local files=("$1"/*.sql)
  [ ${#files[@]} -gt 0 ] || return 0
  echo
  dim "  ▶ $1/ 의 스크립트 ${#files[@]}개를 번호순으로 실행한다"
  for f in "${files[@]}"; do run_file "$f"; done
}

case "${1:-all}" in
  all)     up; run_dir migrations; run_dir sql
           echo; cyan "-- 끝 --"
           dim "  직접 만져보려면:  ./run.sh psql       (psql 접속)"
           dim "  가이드를 따라가려면: HANDS-ON.md 를 열고 ./run.sh psql"
           dim "  정리하려면:        ./run.sh down      (컨테이너 + 볼륨 삭제)" ;;
  up)      up
           echo; dim "  스크립트는 실행하지 않았습니다. HANDS-ON.md 를 보며 ./run.sh psql 로 직접 진행하세요." ;;
  migrate) if [ -d migrations ]; then ensure_up; run_dir migrations
           else dim "  이 lab 에는 migrations/ 가 없습니다. 실행할 스크립트는 sql/ 에 있습니다 (./run.sh sql)"; fi ;;
  sql)     ensure_up; run_dir sql ;;
  psql)    ensure_up
           printf '\033[2m  [호스트]   $\033[0m \033[36m%s\033[0m\n' \
                  "docker exec -it <컨테이너> psql -U $DBUSER -d $DB"
           dim "  나가려면 \\q"
           docker exec -it "$(cid)" psql -U "$DBUSER" -d "$DB" ;;
  shell)   ensure_up
           printf '\033[2m  [호스트]   $\033[0m \033[36m%s\033[0m\n' "docker exec -it <컨테이너> bash"
           dim "  컨테이너 안. /lab 에 이 디렉토리가 마운트되어 있다. 나가려면 exit"
           docker exec -it "$(cid)" bash ;;
  logs)    # 로그는 "안 뜨는 이유"를 볼 때 쓰므로, 멈춘 컨테이너의 로그도 보여준다.
           if [ -z "$(cid_any)" ]; then
             echo "컨테이너가 아직 만들어지지 않았습니다. 먼저 ./run.sh up 을 실행하세요." >&2; exit 1
           fi
           host docker compose logs -f postgres ;;
  down)    host docker compose down -v ;;
  [0-9]*)
    shopt -s nullglob
    matches=(sql/"$1"*.sql migrations/"$1"*.sql)
    [ ${#matches[@]} -gt 0 ] || { echo "'$1' 로 시작하는 스크립트가 없습니다" >&2; exit 1; }
    ensure_up
    for f in "${matches[@]}"; do run_file "$f"; done ;;
  *) echo "usage: ./run.sh [all|up|migrate|sql|psql|shell|logs|down|<번호>]" >&2; exit 1 ;;
esac

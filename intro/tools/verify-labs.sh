#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# intro/labs 의 14개 lab 을 깨끗한 상태에서 실행하고, 결과가 "맞는지"까지 확인한다.
#
#   ./tools/verify-labs.sh          전부 실행 후 검증
#   ./tools/verify-labs.sh check    이미 있는 로그로 검증만
#
# exit 코드만 보면 "스크립트가 돌았다"까지만 알 수 있습니다.
# 그래서 각 lab 이 실제로 의도한 결과를 냈는지 핵심 출력을 grep 으로 확인합니다.
# (이 검사 덕분에 pg_trgm 이 3글자 미만 패턴에서 인덱스를 못 타는 것을 발견했습니다)
# ---------------------------------------------------------------------------
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
LOGDIR="${TMPDIR:-/tmp}/pg-extension-study-verify"
mkdir -p "$LOGDIR"

c_ok()  { printf '  \033[32m✔\033[0m %s\n' "$*"; }
c_bad() { printf '  \033[31m✘\033[0m %s   (패턴: %s)\n' "$1" "$2"; FAILED=1; }
FAILED=0

run_all() {
  printf '\033[36m▶ 전체 lab 실행 (깨끗한 상태에서)\033[0m\n'
  for d in "$ROOT"/labs/[0-9][0-9]-*/; do
    name="$(basename "$d")"
    week="$(basename "$(dirname "$(dirname "$d")")")"
    log="$LOGDIR/${week}-${name}.log"
    ( cd "$d" || exit 1
      ./run.sh down >/dev/null 2>&1
      S=$(date +%s); ./run.sh > "$log" 2>&1; RC=$?; E=$(date +%s)
      ERRS=$(grep -cE '^psql.*(ERROR|FATAL)' "$log")
      if [ "$RC" -eq 0 ] && [ "$ERRS" -eq 0 ]; then M='\033[32m✔\033[0m'; NOTE=''
      elif grep -qE 'no such host|failed to resolve source metadata|dial tcp|TLS handshake timeout' "$log"; then
        # 코드 문제가 아니라 네트워크/레지스트리 문제 (이미지 pull 실패)
        M='\033[33m⚠\033[0m'; NOTE='  ← 네트워크·이미지 pull 실패. 연결 확인 후 재실행'
      else M='\033[31m✘\033[0m'; NOTE=''
      fi
      printf "  $M %-30s exit=%-3d errors=%-3s %ds%s\n" "$week/$name" "$RC" "$ERRS" $((E-S)) "$NOTE"
      ./run.sh down >/dev/null 2>&1 )
  done
}

check() {  # $1=로그 $2=설명 $3=패턴
  if grep -qE "$3" "$LOGDIR/$1" 2>/dev/null; then c_ok "$2"; else c_bad "$2" "$3"; fi
}

verify() {
  printf '\n\033[36m▶ 결과 검증 (exit 코드가 아니라 실제 출력을 본다)\033[0m\n'
  echo "── lab00 가장 간단한 extension"
  check intro-00-hello-extension.log "hello() 가 인사한다"          "Hello, 세계"
  check intro-00-hello-extension.log "소속 도장(deptype=e)"         "hello \| hello \| e"
  check intro-00-hello-extension.log "1.0→1.1 업그레이드"           "안녕하세요, 세계님"
  check intro-00-hello-extension.log "옛날 방식 old_hello 동작"     "old_hello 의 소속 기록"
  check intro-00-hello-extension.log "old_hello vs hello 대조표"    "패키지로 인식되나"
  check intro-00-hello-extension.log "pg_dump 결과가 다르다"        "CREATE FUNCTION public.old_hello"
  echo "── lab01 CREATE EXTENSION 내부 동작"
  check intro-01-create-extension.log "9.1 이전 방식 재현"          "hstore 가 만든 함수 수"
  check intro-01-create-extension.log "pg_dump 가 함수 57개 뱉음"   "^57$"
  check intro-01-create-extension.log "개별 DROP 거부"              "because extension pgcrypto requires it"
  check intro-01-create-extension.log "BFS 업그레이드 경로"         "1.4--1.5--1.6--1.7--1.8"
  check intro-01-create-extension.log "trusted 로 일반유저 설치"    "trusted=true\).*설치 성공"
  echo "── lab02 PGXS + pg_dump"
  check intro-02-sql-extension.log "extension 은 한 줄만 덤프"      "CREATE EXTENSION IF NOT EXISTS greetkor"
  check intro-02-sql-extension.log "설정 테이블 데이터는 덤프"      "COPY public.greetkor_config"
  echo "── lab03 C extension"
  check intro-03-c-extension.log "Pg_magic_func 심볼"               "Pg_magic_func"
  check intro-03-c-extension.log "on-demand 로딩 증명"              "unrecognized configuration parameter"
  check intro-03-c-extension.log "SPI 로 행 수 세기"                "spi_count"
  echo "── lab04 함수 추가"
  check intro-04-functions.log "bcrypt 해시"                        '\$2a\$08\$'
  check intro-04-functions.log "crosstab == FILTER"                 "개발 \| 200 \| 180 \| 260"
  echo "── lab05 타입 추가"
  check intro-05-types.log "citext 대소문자 중복 거부"              "citext 는 대소문자가 달라도"
  check intro-05-types.log "ltree 계층 조회"                        "electronics.computer.laptop"
  check intro-05-types.log "earthdistance 거리(약 8km)"             "^ 807[0-9]$"
  echo "── lab06 연산자 클래스"
  check intro-06-opclass.log "pg_trgm 전 Seq Scan"                  "Seq Scan on users"
  check intro-06-opclass.log "pg_trgm 후 인덱스 사용"               "Bitmap Index Scan on idx_users_name_trgm"
  check intro-06-opclass.log "3글자 미만은 인덱스 못 씀"            "1~2글자는 Seq Scan, 3글자부터"
  check intro-06-opclass.log "EXCLUDE 로 예약 겹침 거부"            "같은 방의 겹치는 시간대"
  echo "── lab07 Hook + 공유메모리"
  check intro-07-hooks.log "쿼리 정규화"                            "WHERE id < \\\$1"
  check intro-07-hooks.log "공유 메모리 할당"                       "pg_stat_statements hash"
  echo "── lab08 모듈 vs extension"
  check intro-08-modules.log "auto_explain 은 extension 아님"       "is not available"
  check intro-08-modules.log "그래도 계획이 로그에 남음"            "Seq Scan on t_demo"
  check intro-08-modules.log "intarray 는 _int.so"                  'libdir/_int'
  echo "── lab09 Background Worker"
  check intro-09-bgworker.log "pg_cron launcher 프로세스"           "pg_cron launcher"
  check intro-09-bgworker.log "워커가 실제로 INSERT"                "기록된_행수"
  echo "── lab10 FDW"
  check intro-10-fdw.log "CSV 가 테이블로"                          "서울 \|    9400000"
  check intro-10-fdw.log "푸시다운 됨"                              "Remote SQL: SELECT id, amount FROM public.orders_remote"
  check intro-10-fdw.log "푸시다운 안 되는 경우"                    "Filter: \(local_only"
  echo "── lab11 진단"
  check intro-11-diagnostics.log "MVCC 이전 버전 관찰"              "이전 버전"
  check intro-11-diagnostics.log "Index Only Scan Heap Fetches 0"   "Heap Fetches: 0"
  echo "── lab12 인덱스 AM"
  check intro-12-index-am.log "bloom 이 pg_am 에 등록"              "blhandler"
  check intro-12-index-am.log "bloom 인덱스 실제 사용"              "Bitmap Index Scan on idx_events_bloom"
  echo "── lab13 절차적 언어 (PL/Python)"
  check intro-13-pl-languages.log "pg_language 에 항목 추가"       "plpython3u \| f"
  check intro-13-pl-languages.log "handler 가 C 로 구현됨"         "plpython3_call_handler \| c"
  check intro-13-pl-languages.log "jsonb 는 str 로 온다"           "jsonb       -> str"
  check intro-13-pl-languages.log "plpy 로 SQL 실행"               "김철수: 100건"
  check intro-13-pl-languages.log "untrusted 는 쉘 실행 가능"      "쉘 명령을 실행했다"
  check intro-13-pl-languages.log "일반유저는 plpython3u 거부"     "permission denied for language plpython3u"
  check intro-13-pl-languages.log "trusted perl 은 파일 I/O 차단"  "trapped by operation mask"
}

[ "${1:-}" = check ] || run_all
verify
echo
[ $FAILED -eq 0 ] && printf '\033[32m✔ 전부 통과\033[0m\n' || { printf '\033[31m✘ 실패한 검사가 있습니다\033[0m\n'; exit 1; }

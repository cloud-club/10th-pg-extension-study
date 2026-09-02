#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 슬라이드 빌드 스크립트
#
#   ./build-slides.sh              모든 덱 → HTML
#   ./build-slides.sh pdf          모든 덱 → PDF (배포용)
#   ./build-slides.sh pptx         모든 덱 → PPTX
#   ./build-slides.sh watch        고칠 때마다 HTML 자동 재생성
#   ./build-slides.sh serve        localhost:8080 라이브 프리뷰
#   ./build-slides.sh diagrams     diagrams/*.mmd → images/*.svg (Mermaid)
#   ./build-slides.sh shots        GitHub 화면 캡처 → images/pgvector-*.png
#   ./build-slides.sh check        슬라이드 넘침 검사 (내용이 잘리는지)
#   ./build-slides.sh clean        생성물 삭제
#
#   특정 덱만:  ./build-slides.sh html slides-labs
#               ./build-slides.sh check slides
#
# 필요한 것: Node.js. Marp 는 npx 로 자동으로 받아옵니다.
# ---------------------------------------------------------------------------
set -uo pipefail
cd "$(dirname "$0")"

MARP_VERSION="@marp-team/marp-cli@4"
TOOLS_DIR=".slide-tools"          # check / diagrams 용 로컬 의존성 (gitignore 대상)
DIAGRAM_DIR="diagrams"            # Mermaid 소스 (.mmd)
IMAGE_DIR="images"                # 렌더링 결과 (.svg) - 슬라이드가 참조
DECKS=(slides slides-labs slides-operations)
DECK_LIST=()

c_ok()   { printf '\033[32m%s\033[0m\n' "$*"; }
c_err()  { printf '\033[31m%s\033[0m\n' "$*" >&2; }
c_warn() { printf '\033[33m%s\033[0m\n' "$*"; }
c_info() { printf '\033[36m%s\033[0m\n' "$*"; }

# marp 실행기: 로컬 설치 > 전역 설치 > npx (느리지만 설치 불필요)
# 주의: 이 함수 이름을 marp 로 두면 아래 `command -v marp` 가 자기 자신을 찾아버린다.
run_marp() {
  if [ -x "$TOOLS_DIR/node_modules/.bin/marp" ]; then
    "$TOOLS_DIR/node_modules/.bin/marp" "$@"
  elif command -v marp >/dev/null 2>&1; then
    command marp "$@"
  else
    npx -y "$MARP_VERSION" "$@"
  fi
}

require_node() {
  command -v node >/dev/null 2>&1 || {
    c_err "Node.js 가 필요합니다.  brew install node  또는  https://nodejs.org"
    exit 1
  }
}

# 인자로 덱을 지정했으면 그것만, 아니면 전체. 결과는 DECK_LIST 에 담는다.
# (서브셸에서 exit 해도 스크립트가 안 죽으므로, 검증은 메인 셸에서 해야 한다)
resolve_decks() {
  DECK_LIST=()
  if [ "$#" -gt 0 ]; then
    local d
    for d in "$@"; do
      d="${d%.md}"                       # slides.md 로 줘도 되게
      [ -f "$d.md" ] || { c_err "$d.md 가 없습니다"; return 1; }
      DECK_LIST+=("$d")
    done
  else
    DECK_LIST=("${DECKS[@]}")
  fi
}

build() {  # $1=확장자, DECK_LIST 를 대상으로
  local ext="$1" rc=0 log deck
  log="$(mktemp)"
  # 주의: 루프 안에서 돌리는 명령에 </dev/null 을 붙이지 않으면
  #       그 명령이 루프의 stdin 을 먹어버려 한 번만 돌고 끝난다.
  for deck in "${DECK_LIST[@]}"; do
    printf '  %-22s → %s ... ' "$deck.md" "$deck.$ext"
    # PDF/PPTX 는 헤드리스 브라우저로 그리는데, 기본값은 로컬 파일 접근을 막는다.
    # images/*.svg 를 못 읽어 다이어그램이 빈 칸으로 나오므로 허용해준다.
    # (빈 배열 확장은 bash 3.2 + set -u 에서 에러라서 if 로 나눈다)
    local ok=0
    if [ "$ext" = html ]; then
      run_marp "$deck.md" -o "$deck.$ext" </dev/null >"$log" 2>&1 && ok=1
    else
      run_marp "$deck.md" -o "$deck.$ext" --allow-local-files </dev/null >"$log" 2>&1 && ok=1
    fi
    if [ $ok -eq 1 ]; then
      printf '\033[32m%s\033[0m\n' "$(wc -c < "$deck.$ext" | awk '{printf "%.0fKB", $1/1024}')"
    else
      printf '\033[31m%s\033[0m\n' "실패"
      sed 's/^/      /' "$log" | tail -10
      rc=1
    fi
  done
  rm -f "$log"
  return $rc
}

find_chrome() {
  local p
  for p in "${CHROME_PATH:-}" \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "/Applications/Chromium.app/Contents/MacOS/Chromium" \
           "$(command -v google-chrome 2>/dev/null || true)" \
           "$(command -v chromium 2>/dev/null || true)"; do
    [ -n "$p" ] && [ -x "$p" ] && { echo "$p"; return 0; }
  done
  return 1
}

run_mmdc() { "$TOOLS_DIR/node_modules/.bin/mmdc" -p "$TOOLS_DIR/puppeteer-cfg.json" "$@"; }

setup_mermaid() {
  local chrome install_log
  chrome="$(find_chrome)" || {
    c_err "Chrome/Chromium 을 찾지 못했습니다. CHROME_PATH 환경변수로 지정하세요."; exit 1; }
  if [ ! -x "$TOOLS_DIR/node_modules/.bin/mmdc" ]; then
    c_info "Mermaid CLI 를 처음 설치합니다 ($TOOLS_DIR/) - 1~2분 걸립니다"
    mkdir -p "$TOOLS_DIR"
    [ -f "$TOOLS_DIR/package.json" ] || \
      printf '%s\n' '{ "name": "slide-tools", "private": true }' > "$TOOLS_DIR/package.json"
    install_log="$(mktemp)"
    if ! ( cd "$TOOLS_DIR" && npm install --silent @mermaid-js/mermaid-cli ) >"$install_log" 2>&1; then
      c_err "설치 실패:"; sed 's/^/  /' "$install_log" | tail -10; rm -f "$install_log"; exit 1
    fi
    rm -f "$install_log"
  fi
  # mmdc 가 쓸 브라우저를 알려준다 (번들 Chromium 을 따로 받지 않도록)
  printf '{ "executablePath": "%s", "args": ["--no-sandbox"] }\n' "$chrome" \
    > "$TOOLS_DIR/puppeteer-cfg.json"
}

setup_check_tools() {
  local chrome install_log
  chrome="$(find_chrome)" || {
    c_err "Chrome/Chromium 을 찾지 못했습니다. CHROME_PATH 환경변수로 지정하세요."
    exit 1
  }
  # 주의: node_modules/puppeteer-core 존재 여부로 판단하면 안 된다.
  #       mermaid-cli 가 puppeteer-core 를 의존성으로 끌고 오기 때문에
  #       diagrams 를 먼저 돌린 뒤에는 이미 있는 것으로 보여 marp 설치를 건너뛴다.
  #       실제로 필요한 실행 파일(.bin/marp)로 판단한다.
  if [ ! -x "$TOOLS_DIR/node_modules/.bin/marp" ] \
     || [ ! -d "$TOOLS_DIR/node_modules/puppeteer-core" ]; then
    c_info "넘침 검사 도구를 처음 설치합니다 ($TOOLS_DIR/) - 1~2분 걸립니다"
    mkdir -p "$TOOLS_DIR"
    # npm init -y 는 디렉토리명(.slide-tools)이 유효한 패키지명이 아니라 실패한다.
    # 최소 package.json 을 직접 써준다.
    # 주의: 무조건 덮어쓰면 앞서 설치한 의존성(mermaid-cli)이 package.json 에서
    #       사라지고, 다음 npm install 때 prune 되어 mmdc 가 없어진다. 없을 때만 만든다.
    [ -f "$TOOLS_DIR/package.json" ] || \
      printf '%s\n' '{ "name": "slide-tools", "private": true }' > "$TOOLS_DIR/package.json"
    install_log="$(mktemp)"
    if ! ( cd "$TOOLS_DIR" && npm install --silent puppeteer-core "$MARP_VERSION" ) \
         >"$install_log" 2>&1; then
      c_err "설치 실패:"; sed 's/^/  /' "$install_log" | tail -10
      rm -f "$install_log"; exit 1
    fi
    rm -f "$install_log"
  fi
  cp tools/check-overflow.mjs "$TOOLS_DIR/check-overflow.mjs"
  export CHROME_PATH="$chrome"
}

# ---------------------------------------------------------------------------
CMD="${1:-html}"
[ "$#" -gt 0 ] && shift

case "$CMD" in
  html|pdf|pptx)
    require_node
    resolve_decks "$@" || exit 1
    # 슬라이드가 참조하는 SVG 가 하나도 없으면 먼저 만들어준다
    if [ -d "$DIAGRAM_DIR" ] && ! ls "$IMAGE_DIR"/*.svg >/dev/null 2>&1; then
      c_info "다이어그램이 없어 먼저 생성합니다"
      "$0" diagrams || exit 1
    fi
    c_info "▶ $CMD 생성"
    if build "$CMD"; then
      c_ok "✔ 완료"
      # 주의: [ cond ] && { ... } 를 분기의 마지막 문장으로 두면
      #       조건이 거짓일 때 그 상태(1)가 그대로 스크립트 종료 코드가 된다.
      #       (pdf 를 만들었는데 exit 1 이 나오는 원인이었다)
      if [ "$CMD" = html ]; then
        echo
        echo "  열기:  open ${DECK_LIST[0]}.html    (방향키 이동 · F 전체화면 · P 발표자 노트)"
      fi
    else
      c_err "일부 실패"; exit 1
    fi
    ;;

  watch)
    require_node
    resolve_decks "$@" || exit 1
    c_info "▶ 감시 모드 - 저장할 때마다 HTML 을 다시 만듭니다 (Ctrl+C 종료)"
    files=(); for d in "${DECK_LIST[@]}"; do files+=("$d.md"); done
    run_marp --watch "${files[@]}"
    ;;

  serve)
    require_node
    c_info "▶ http://localhost:8080 에서 미리보기 (Ctrl+C 종료)"
    run_marp --server .
    ;;

  check)
    require_node
    resolve_decks "$@" || exit 1
    setup_check_tools
    c_info "▶ 넘침 검사 (슬라이드 밖으로 나가는 내용이 있는지)"
    # 주의: 평소 보는 HTML(bespoke 템플릿)은 현재 슬라이드만 배치하므로
    #       숨겨진 슬라이드의 치수가 실제와 다르게 나온다.
    #       모든 슬라이드를 나란히 배치하는 bare 템플릿으로 따로 만들어 측정한다.
    check_rc=0
    measure_html="$(mktemp -t marp-measure).html"
    for deck in "${DECK_LIST[@]}"; do
      echo
      echo "──────── $deck ────────"
      if ! run_marp "$deck.md" --template bare -o "$measure_html" </dev/null >/dev/null 2>&1; then
        c_err "측정용 HTML 생성 실패"; check_rc=1; continue
      fi
      node "$TOOLS_DIR/check-overflow.mjs" "$measure_html" "${MARGIN:-40}" </dev/null || check_rc=1
    done
    rm -f "$measure_html"
    [ $check_rc -eq 0 ] && { echo; c_ok "✔ 잘리는 슬라이드 없음"; } \
                        || { echo; c_err "✘ 잘리는 슬라이드가 있습니다"; }
    exit $check_rc
    ;;

  shots)
    # 슬라이드에 넣는 pgvector GitHub 화면 캡처.
    # puppeteer-core + Chrome 이 필요해서 check 와 같은 도구를 재사용한다.
    require_node
    setup_check_tools
    c_info "▶ GitHub 화면 캡처 ($DIAGRAM_DIR 과 달리 원본이 외부 사이트다)"
    cp tools/capture-shots.mjs "$TOOLS_DIR/capture-shots.mjs"
    if node "$TOOLS_DIR/capture-shots.mjs" </dev/null; then c_ok "✔ 완료"
    else c_err "일부 실패 - GitHub 화면이 바뀌었을 수 있습니다 (tools/capture-shots.mjs 의 anchor 확인)"; exit 1; fi
    ;;

  diagrams)
    require_node
    setup_mermaid
    c_info "▶ 다이어그램 렌더링 ($DIAGRAM_DIR/*.mmd → $IMAGE_DIR/*.svg)"
    mkdir -p "$IMAGE_DIR"
    dia_rc=0; dia_n=0
    shopt -s nullglob
    for src in "$DIAGRAM_DIR"/*.mmd; do
      out="$IMAGE_DIR/$(basename "${src%.mmd}").svg"
      # 소스가 결과보다 새 것일 때만 다시 그린다 (--force 로 전체 재렌더)
      if [ "${1:-}" != "--force" ] && [ -f "$out" ] && [ "$out" -nt "$src" ]; then
        printf '  %-34s (변경 없음)\n' "$(basename "$src")"; continue
      fi
      printf '  %-34s → ' "$(basename "$src")"
      if run_mmdc -i "$src" -o "$out" -b transparent </dev/null >/dev/null 2>&1; then
        # Mermaid SVG 는 width="100%" 라 고유 크기가 없다.
        # 그대로 두면 PDF/PNG 로 내보낼 때 빈 칸으로 나온다. → viewBox 로 채워준다.
        node tools/fix-svg-size.mjs "$out" </dev/null >/dev/null 2>&1
        vb=$(grep -o 'viewBox="[^"]*"' "$out" | head -1 | sed 's/viewBox="//;s/"//')
        printf '\033[32m%s\033[0m\n' "$(echo "$vb" | awk '{printf "%dx%d", $3, $4}')"
        dia_n=$((dia_n+1))
      else
        printf '\033[31m실패\033[0m\n'; dia_rc=1
      fi
    done
    [ $dia_rc -eq 0 ] && c_ok "✔ ${dia_n}개 렌더링" || { c_err "일부 실패"; exit 1; }
    ;;

  clean)
    # 주의: ./*.html 로 지우면 이 디렉토리에 있던 다른 HTML 까지 날아간다.
    #       반드시 "우리가 만든 덱"만 골라서 지운다.
    resolve_decks "$@" || exit 1
    removed=0
    for deck in "${DECK_LIST[@]}"; do
      for ext in html pdf pptx; do
        if [ -f "$deck.$ext" ]; then
          rm -f "$deck.$ext"; echo "  삭제: $deck.$ext"; removed=$((removed + 1))
        fi
      done
    done
    if [ "$removed" -eq 0 ]; then c_ok "✔ 지울 생성물이 없습니다"
    else c_ok "✔ 생성물 ${removed}개를 삭제했습니다 (.md 원본은 그대로)"; fi
    ;;

  -h|--help|help)
    awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"
    ;;

  *)
    c_err "알 수 없는 명령: $CMD"
    echo "사용법: ./build-slides.sh [html|pdf|pptx|watch|serve|diagrams|shots|check|clean] [덱이름...]" >&2
    exit 1
    ;;
esac

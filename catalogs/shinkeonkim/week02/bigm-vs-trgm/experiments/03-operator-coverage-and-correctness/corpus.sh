#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 한글 말뭉치 준비 스크립트 (실험용 공통 부품)
#
# 각 실험의 bench.sh 에서 `source corpus.sh` 로 불러 쓴다. 실험 디렉터리마다
# 이 파일의 복사본이 들어있다 - 이 저장소의 lab/experiment 는 각자 독립적으로
# 돌아가야 하므로 run.sh 와 마찬가지로 의도적으로 중복시킨다.
#
#   fetch_corpus            말뭉치를 ./.corpus/nsmc-docs.txt 로 준비한다 (캐시됨)
#   $CORPUS_FILE            준비된 파일 경로
#   $CORPUS_SOURCE          "nsmc" 또는 "synthetic" - README 에 어느 쪽으로 쟀는지 적기 위해
#
# ---------------------------------------------------------------------------
# 왜 NSMC 인가
#
#   Korpora(https://github.com/ko-nlp/Korpora)가 소개하는 한국어 말뭉치 중에서
#   NSMC(Naver Sentiment Movie Corpus)를 골랐다. 이유는 두 가지다.
#
#     1) 라이선스가 CC0(퍼블릭 도메인)이다. 재배포·자동 다운로드에 제약이 없다.
#        (Korpora 가 소개하는 다른 말뭉치 상당수는 별도 동의 절차나 로그인이 필요하다)
#     2) raw URL 로 바로 받을 수 있어 컨테이너 빌드/벤치 스크립트에 그대로 넣을 수 있다.
#
#   출처: https://github.com/e9t/nsmc  (ratings_train 15만 + ratings_test 5만)
#   실제로 받아서 확인한 규모: 199,993행, 평균 35.3글자, 최대 158글자.
#
#   말뭉치 파일 자체는 저장소에 커밋하지 않는다(.gitignore). 네트워크가 없으면
#   합성 데이터로 폴백하므로 오프라인에서도 실험은 돈다 - 다만 그때는
#   CORPUS_SOURCE 가 "synthetic" 이 되므로 결과를 적을 때 반드시 구분해야 한다.
# ---------------------------------------------------------------------------

CORPUS_DIR="${CORPUS_DIR:-.corpus}"
CORPUS_FILE="$CORPUS_DIR/nsmc-docs.txt"
CORPUS_SOURCE="unknown"

NSMC_BASE="https://raw.githubusercontent.com/e9t/nsmc/master"

_corpus_synthetic() {
  # 네트워크가 없을 때의 폴백. 어휘 풀이 작으면 특정 키워드가 전체의 절반과
  # 매치되는 식으로 선택도가 망가지므로(pg_bigm/experiments/02 가 겪은 문제),
  # 폴백에서도 문장을 조합해 다양성을 확보한다.
  local subj=(사람 영화 배우 감독 음악 각본 연출 편집 촬영 조명 미술 의상 분장 음향 특수효과)
  local adj=(좋은 나쁜 훌륭한 어색한 담백한 과장된 섬세한 투박한 참신한 진부한)
  local verb=(인상적이다 아쉽다 놀랍다 무난하다 지루하다 흥미롭다 어리둥절하다 만족스럽다)
  local i j k n=0
  : > "$CORPUS_FILE"
  for i in "${subj[@]}"; do for j in "${adj[@]}"; do for k in "${verb[@]}"; do
    echo "$j $i 의 표현이 $k 라고 느꼈다 (문장 $n)" >> "$CORPUS_FILE"
    n=$((n + 1))
  done; done; done
  # 위 조합은 1,200줄이다. 실험이 요구하는 행 수는 seed 쪽에서 순환 참조로 채운다.
  CORPUS_SOURCE="synthetic"
}

fetch_corpus() {
  mkdir -p "$CORPUS_DIR"

  if [ -s "$CORPUS_FILE" ]; then
    CORPUS_SOURCE="nsmc(캐시)"
    echo "  말뭉치 캐시 사용: $CORPUS_FILE ($(wc -l < "$CORPUS_FILE" | tr -d ' ')행)"
    return 0
  fi

  echo "  한글 말뭉치(NSMC, CC0)를 내려받는다 - 최초 1회만 받고 이후엔 캐시를 쓴다"
  local ok=1
  for f in ratings_train ratings_test; do
    if ! curl -sSL --max-time 120 -o "$CORPUS_DIR/$f.txt" "$NSMC_BASE/$f.txt"; then
      ok=0; break
    fi
    [ -s "$CORPUS_DIR/$f.txt" ] || { ok=0; break; }
  done

  if [ "$ok" = 1 ]; then
    # 원본은 "id \t document \t label" 탭 구분 + 헤더 1줄이다.
    # 검색 대상이 되는 document 컬럼만 뽑고, 빈 문서는 버린다.
    awk -F'\t' 'NR>1 && $2 != "" {print $2}' \
      "$CORPUS_DIR/ratings_train.txt" "$CORPUS_DIR/ratings_test.txt" > "$CORPUS_FILE"
    rm -f "$CORPUS_DIR/ratings_train.txt" "$CORPUS_DIR/ratings_test.txt"
    CORPUS_SOURCE="nsmc"
    echo "  ✔ NSMC $(wc -l < "$CORPUS_FILE" | tr -d ' ')행 준비 완료"
  else
    echo "  ✘ 말뭉치를 받지 못했습니다 (네트워크?). 합성 데이터로 폴백합니다."
    echo "    -> 결과를 기록할 때 반드시 '합성 데이터'라고 명시할 것"
    _corpus_synthetic
  fi
}

# 컨테이너 안으로 말뭉치를 복사한다 (bind mount 대신 docker cp 를 쓰는 이유:
# 실험마다 compose 파일에 volume 을 추가하지 않아도 되고, 캐시 디렉터리가
# 컨테이너 권한 문제를 일으키지 않는다)
copy_corpus_into() {  # $1 = 컨테이너 이름
  docker cp "$CORPUS_FILE" "$1:/tmp/corpus.txt"
}

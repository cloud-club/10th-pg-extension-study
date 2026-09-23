"""말뭉치 준비 — 다른 실험들과 같은 NSMC(CC0) 를 쓴다.

각 bench.sh 의 corpus.sh 와 같은 데이터를 써야 여기서 잰 값과 카탈로그의 값을
나란히 놓고 볼 수 있다. 네트워크가 없으면 합성 문장으로 폴백하되,
그 경우 결과에 반드시 'synthetic' 이라고 표시한다 — 합성 데이터가 결론을
바꾼 적이 있어서다(experiments/02 참고).
"""
from __future__ import annotations
import os, urllib.request

DATA_DIR = os.environ.get("DATA_DIR", "/data")
CORPUS = os.path.join(DATA_DIR, "corpus.txt")
BASE = "https://raw.githubusercontent.com/e9t/nsmc/master"
_source = "unknown"


def _synthetic():
    subj = ["사람","영화","배우","감독","음악","각본","연출","편집","촬영","조명","미술","의상"]
    adj  = ["좋은","나쁜","훌륭한","어색한","담백한","과장된","섬세한","투박한","참신한","진부한"]
    verb = ["인상적이다","아쉽다","놀랍다","무난하다","지루하다","흥미롭다","만족스럽다"]
    n = 0
    with open(CORPUS, "w", encoding="utf-8") as f:
        for i in subj:
            for j in adj:
                for k in verb:
                    f.write(f"{j} {i} 의 표현이 {k} 라고 느꼈다 (문장 {n})\n")
                    n += 1
    return "synthetic"


def ensure() -> tuple[str, int]:
    """말뭉치 파일 경로와 줄 수를 돌려준다. 최초 1회만 받고 이후엔 캐시."""
    global _source
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(CORPUS) or os.path.getsize(CORPUS) == 0:
        try:
            lines = []
            for name in ("ratings_train.txt", "ratings_test.txt"):
                with urllib.request.urlopen(f"{BASE}/{name}", timeout=120) as r:
                    raw = r.read().decode("utf-8", "replace").split("\n")
                # 원본은 "id \t document \t label" + 헤더 1줄
                for ln in raw[1:]:
                    parts = ln.split("\t")
                    if len(parts) >= 2 and parts[1].strip():
                        lines.append(parts[1].replace("\r", "").strip())
            with open(CORPUS, "w", encoding="utf-8") as f:
                f.write("\n".join(lines) + "\n")
            _source = "nsmc"
        except Exception:
            _source = _synthetic()
    elif _source == "unknown":
        _source = "nsmc(캐시)"
    with open(CORPUS, encoding="utf-8") as f:
        n = sum(1 for _ in f)
    return CORPUS, n


def source() -> str:
    # 재기동 직후엔 아직 ensure() 를 안 불렀어도 캐시 파일은 남아 있다.
    # 그때 'unknown' 이라고 표시하면 사용자가 데이터를 의심하게 되므로 파일을 보고 답한다.
    if _source == "unknown" and os.path.exists(CORPUS) and os.path.getsize(CORPUS) > 0:
        return "nsmc(캐시)"
    return _source

"""hstore(week04) clotho 애니메이션 문서.

build.py 의 DOCS 에 `docs(kit)` 결과가 합쳐진다. 헬퍼(txt/box)와 색은 build.py 것을 그대로 받는다.

수치는 손으로 적지 않는다. 실험 결과 요약(src/data/hstore-experiments.json)과 실습 출력에서 읽어 오며,
파일이 없으면 애니메이션을 만들지 않고 멈춘다 — 출처 없는 숫자가 화면에 올라가지 않게 하는 장치다.
"""
from __future__ import annotations
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
STATS = os.path.join(HERE, "..", "data", "hstore-experiments.json")


def load_stats():
    if not os.path.exists(STATS):
        raise SystemExit("hstore 실험 요약이 없다: python3 scripts/sync-hstore-results.py 를 먼저 실행하세요.")
    with open(STATS, encoding="utf-8") as f:
        return json.load(f)


def rnd(n):
    """JS의 Math.round와 같은 반올림(0.5는 항상 위로). Python의 :.0f는 은행가 반올림(62.5→62)이라
    페이지의 fmtNum(62.5→63)과 어긋날 수 있어, 웹에 나오는 중앙값은 전부 이 함수로 맞춘다."""
    return math.floor(float(n) + 0.5)


def kb(n):
    """바이트를 읽기 좋게. 1000 미만은 B, 그 위는 KB(소수 한 자리)."""
    n = float(n)
    return f"{rnd(n):,} B" if n < 1000 else f"{n / 1000:,.1f} KB"


class Story:
    """장(chapter)마다 같은 자리에 장면을 갈아 끼우는 애니메이션 빌더.

    장 안의 요소는 그 장이 끝나면 사라진다. 제목(title)만 처음부터 끝까지 남는다.
    """

    def __init__(self, kit, id, title, description, width, height):
        self.k = kit
        self.id, self.title, self.description = id, title, description
        self.W, self.H = width, height
        self.els, self.chapters, self.t = [], [], 0
        self.count = 0

    def chapter(self, label, subtitle, dur):
        ch = Chapter(self, self.t, self.t + dur)
        self.chapters.append({"id": f"ch{len(self.chapters)}", "time": self.t, "label": label, "subtitle": subtitle})
        self.t += dur
        return ch

    def build(self):
        end = self.t
        title = self.k["txt"]("title", 40, 42, self.title, 22, self.k["INK"], 0, end, "700")
        return {
            "clothoVersion": 1, "id": self.id, "title": self.title, "description": self.description,
            "duration": end, "canvas": {"width": self.W, "height": self.H, "background": self.k["BG"]},
            "elements": [title] + self.els, "chapters": self.chapters,
            "settings": {"loop": False, "autoplay": True, "showChapterList": True},
        }


class Chapter:
    def __init__(self, story, start, end):
        self.s, self.start, self.end = story, start, end
        self.k = story.k

    def _id(self):
        self.s.count += 1
        return f"e{self.s.count}"

    def box(self, x, y, w, h, fill, label=None, delay=0, size=17, color=None, stroke=None, until=None):
        self.s.els.append(self.k["box"](self._id(), x, y, w, h, fill, self.start + delay, until or self.end,
                                        label, label_color=color or self.k["ON_FILL"], label_size=size,
                                        stroke=stroke))

    def text(self, x, y, content, delay=0, size=16, color=None, weight=None, anchor="start", until=None):
        self.s.els.append(self.k["txt"](self._id(), x, y, content, size, color or self.k["INK"],
                                        self.start + delay, until or self.end, weight, anchor))


# ---------------------------------------------------------------------------
# 1) 저장 구조: 문자열 → 정렬된 쌍 → 바이트
#    수치(크기 42, 디스크 39, HEntry 끝 위치)는 lab 02 의 pageinspect 출력과 같다.
# ---------------------------------------------------------------------------
def doc_storage_layout(k):
    INK, MUTED, BIGM, OK, WARN, PANEL, DIM, ON_FILL, PAD, TRGM, TSV = (
        k[n] for n in ("INK", "MUTED", "BIGM", "OK", "WARN", "PANEL", "DIM", "ON_FILL", "PAD", "TRGM", "TSV"))
    s = Story(k, "hstore-storage-layout", "hstore 한 값이 디스크에 놓이는 방식",
              "입력 문자열 → 중복 제거·정렬 → HEntry 배열 → 문자열 영역. 크기는 lab 02 의 pageinspect 출력과 같다.",
              940, 520)

    c = s.chapter("1. 입력", "hstore_in() 이 문자열을 (키, 값) 쌍으로 파싱한다", 5500)
    c.text(40, 100, "이 문자열을 hstore 로 저장한다", 200, 16, MUTED)
    c.box(40, 118, 860, 56, PANEL, "'ccc=>333, aa=>1, b=>NULL, aa=>9'::hstore", 400, 21, INK, DIM)
    c.text(40, 226, "쌍이 4개다. 순서는 뒤섞여 있고, 키 aa 가 두 번 나온다.", 1600, 16, INK)
    c.text(40, 258, "저장할 때 hstore_in() → hstoreUniquePairs() 가 정렬하고 중복을 없앤다.", 2600, 16, MUTED)

    c = s.chapter("2. 중복 제거 · 정렬", "키 길이 → 같으면 바이트 순. 중복 키는 하나만 남는다", 9500)
    c.text(40, 96, "입력 순서", 100, 15, MUTED)
    labels = ["ccc=>333", "aa=>1", "b=>NULL", "aa=>9"]
    for i, lab in enumerate(labels):
        x = 40 + i * 220
        if i == 3:
            c.box(x, 108, 200, 46, BIGM, lab, 300 + i * 250, 17, ON_FILL, until=c.start + 3600)
            c.box(x, 108, 200, 46, DIM, "aa=>9 (중복)", 3600, 17, MUTED)
        else:
            c.box(x, 108, 200, 46, BIGM, lab, 300 + i * 250, 17)
    c.text(40, 188, "aa 가 두 번: 하나만 남는다. 여기서는 aa=>1 이 남았다 (어느 쪽인지 문서는 보장하지 않는다)", 3900, 15, WARN)
    c.text(40, 244, "정렬 결과 — 키 길이 오름차순, 같으면 memcmp (comparePairs)", 5000, 15, MUTED)
    for i, (lab, ln) in enumerate([("b=>NULL", "길이 1"), ("aa=>1", "길이 2"), ("ccc=>333", "길이 3")]):
        x = 40 + i * 220
        c.box(x, 256, 200, 46, OK, lab, 5400 + i * 500, 17)
        c.text(x + 100, 326, ln, 5700 + i * 500, 14, MUTED, anchor="middle")
    c.text(40, 388, "알파벳순이 아니다. 'b' < 'aa' 인 이유는 사전순이 아니라 길이가 먼저이기 때문이다.", 7600, 15, INK)
    c.text(40, 418, "이 순서 덕분에 키 하나를 찾을 때 이진 탐색을 쓸 수 있다.", 8200, 15, MUTED)

    c = s.chapter("3. 헤더와 HEntry", "쌍 하나당 HEntry 두 개(키용 · 값용), 각 4바이트", 10500)
    c.text(40, 96, "[헤더 4B][size_ 4B][HEntry × 6][문자열 영역]", 100, 16, MUTED)
    c.box(40, 116, 150, 46, PAD, "varlena 헤더", 400, 16, ON_FILL)
    c.box(200, 116, 340, 46, TSV, "size_ = 3쌍 · 새 형식 플래그", 800, 16, ON_FILL)
    ents = [("키 b", 1, BIGM), ("값 NULL", 1, WARN), ("키 aa", 3, BIGM), ("값 1", 4, OK), ("키 ccc", 7, BIGM), ("값 333", 10, OK)]
    c.text(40, 214, "HEntry 6개: 각 칸의 숫자 = 문자열 영역 안의 '끝 위치'", 1600, 15, MUTED)
    for i, (lab, end, col) in enumerate(ents):
        x = 40 + i * 144
        c.box(x, 230, 136, 46, col, f"{lab} → {end}", 2000 + i * 400, 16, ON_FILL)
    c.text(40, 316, "첫 항목에는 ISFIRST 비트, NULL 값에는 ISNULL 비트가 켜진다 — 문자열 영역을 쓰지 않는다.", 5200, 15, INK)
    c.text(40, 346, "길이는 저장하지 않는다. '내 끝 위치 − 앞 항목의 끝 위치' 로 구한다.", 6000, 15, INK)
    c.text(40, 392, "→ 끝 위치는 1, 1, 3, 4, 7, 10 처럼 계속 커지는 숫자다. (압축 실험에서 이 사실이 중요해진다)", 7400, 15, WARN)

    c = s.chapter("4. 문자열 영역과 크기", "키·값을 이어붙인 10바이트, 전체 42바이트", 9500)
    c.text(40, 96, "문자열 영역 = 정렬된 순서로 이어붙인 키와 값 (NULL 값은 0바이트)", 100, 15, MUTED)
    cells = [("b", 1, BIGM), ("aa", 2, BIGM), ("1", 1, OK), ("ccc", 3, BIGM), ("333", 3, OK)]
    x = 40
    for i, (lab, n, col) in enumerate(cells):
        w = 84 * n
        c.box(x, 116, w - 6, 46, col, lab, 400 + i * 400, 18, ON_FILL)
        x += w
    c.text(40, 214, "b · (NULL 은 없음) · aa · 1 · ccc · 333  →  1 + 2 + 1 + 3 + 3 = 10 바이트", 2600, 15, INK)
    c.text(40, 270, "전체 크기", 3400, 17, INK, "700")
    c.text(40, 306, "4 (varlena) + 4 (size_) + 24 (HEntry 6개 × 4) + 10 (문자열) = 42 바이트", 3800, 16, INK)
    c.text(40, 342, "디스크에는 130바이트 이하라 1바이트 짧은 헤더가 쓰여 39 바이트로 저장된다.", 5000, 15, OK)
    c.text(40, 396, "pg_column_size(attrs) = 39 — lab 02 에서 pageinspect 로 직접 확인한다.", 6200, 15, MUTED)

    c = s.chapter("5. 키 찾기", "hstoreFindKey — (길이, 바이트) 순서 위의 이진 탐색", 8000)
    c.text(40, 96, "정렬돼 있으니 이진 탐색이다:  attrs -> 'ccc'", 100, 16, MUTED)
    for i, lab in enumerate(["b", "aa", "ccc"]):
        c.box(40 + i * 220, 116, 200, 46, PANEL, lab, 300, 18, INK, DIM)
    c.text(40, 210, "① 가운데 'aa' 와 비교 — 길이 2 < 3 이므로 memcmp 없이 오른쪽으로", 1400, 15, INK)
    c.box(260, 116, 200, 46, TRGM, "aa", 1400, 18, ON_FILL, until=c.start + 3000)
    c.text(40, 250, "② 남은 구간 'ccc' — 길이 3 == 3, memcmp 결과 0 → 찾았다", 3000, 15, INK)
    c.box(480, 116, 200, 46, OK, "ccc", 3000, 18, ON_FILL)
    c.text(40, 300, "값은 HEntry[2i+1] 의 끝 위치 두 개로 잘라 낸다.", 4400, 15, INK)
    c.text(40, 350, "값 하나를 읽으려고 값 전체(TOAST 로 나갔다면 전체 조각)를 먼저 펼쳐야 한다.", 5600, 15, WARN)
    return s.build()


# ---------------------------------------------------------------------------
# 2) 키 하나를 바꿨는데 왜 값 전체가 다시 쓰이나 (실험 02)
# ---------------------------------------------------------------------------
def doc_update_rewrite(k, st):
    INK, MUTED, BIGM, OK, WARN, PANEL, DIM, ON_FILL, PAD, TRGM = (
        k[n] for n in ("INK", "MUTED", "BIGM", "OK", "WARN", "PANEL", "DIM", "ON_FILL", "PAD", "TRGM"))
    cases = st["update"]["cases"]
    w5 = cases["5"]["hstore_concat"]["wal_bytes_per_update"]["median"]
    w50 = cases["50"]["hstore_concat"]["wal_bytes_per_update"]["median"]
    w500 = cases["500"]["hstore_concat"]["wal_bytes_per_update"]["median"]
    gin500 = cases["500"]["hstore_concat_gin"]["wal_bytes_per_update"]["median"]
    eav = cases["500"]["eav_row"]["wal_bytes_per_update"]["median"]
    toast_growth = cases["500"]["hstore_concat"]["toast_growth_bytes"]["median"] / st["update"]["rows"]
    avg500 = cases["500"]["hstore_avg_column_bytes"]

    s = Story(k, "hstore-update-rewrite", "키 하나를 바꿔도 값 전체가 다시 쓰인다",
              f"실험 02: 행 {st['update']['rows']}개, 키 개수별 UPDATE 1건당 WAL. 5개 {kb(w5)} · 50개 {kb(w50)} · 500개 {kb(w500)}.",
              940, 520)

    c = s.chapter("1. 행 하나", f"키 500개 = hstore 값 {kb(avg500)}. 2KB를 넘어 TOAST 로 나간다", 6500)
    c.text(40, 96, "heap 튜플 한 개 (id + attrs)", 100, 15, MUTED)
    c.box(40, 112, 260, 50, PANEL, "id=1  attrs → TOAST 포인터", 300, 15, INK, DIM)
    c.text(40, 212, f"TOAST 테이블에는 값 {kb(avg500)} 가 약 2KB 조각(chunk)들로 나뉘어 있다", 1200, 15, MUTED)
    for i in range(7):
        c.box(40 + i * 120, 232, 108, 44, BIGM, f"chunk {i + 1}", 1600 + i * 200, 15, ON_FILL)
    c.text(40, 330, "값은 통째로 압축되거나 통째로 저장된다 — 일부만 고치는 방법이 없다.", 3600, 15, INK)

    c = s.chapter("2. UPDATE", "attrs || hstore('attr_001', ...) — 두 hstore 를 병합해 새 값을 만든다", 6500)
    c.box(40, 110, 860, 50, PANEL, "UPDATE t SET attrs = attrs || hstore('attr_001', 'x') WHERE id = 1", 200, 17, INK, DIM)
    c.text(40, 212, "hstore_concat() 은 정렬된 두 배열을 병합해 500개 쌍 전체를 담은 새 값을 만든다", 1200, 15, INK)
    c.text(40, 244, "바뀐 것은 값 하나(12바이트)뿐이지만, 결과는 새 14KB 짜리 값이다.", 2200, 15, MUTED)
    c.text(40, 290, "첨자 h['k'] = 'v' 로 써도 마찬가지다 (실험 02 에서 함께 측정).", 3400, 15, MUTED)

    c = s.chapter("3. 새 버전을 통째로 쓴다", f"UPDATE 1건 = WAL {kb(w500)}, TOAST 증가 {kb(toast_growth)}", 8500)
    c.text(40, 96, "MVCC: 옛 튜플과 옛 TOAST 조각은 죽은 채 남고, 새 튜플과 새 조각이 추가된다", 100, 15, MUTED)
    c.box(40, 118, 260, 46, DIM, "옛 튜플 (dead)", 400, 16, MUTED)
    c.box(320, 118, 260, 46, OK, "새 튜플 (id=1)", 900, 16, ON_FILL)
    for i in range(7):
        c.box(40 + i * 120, 196, 108, 40, DIM, f"옛 {i + 1}", 1400, 14, MUTED)
        c.box(40 + i * 120, 246, 108, 40, OK, f"새 {i + 1}", 1900 + i * 150, 14, ON_FILL)
    c.text(40, 338, f"실측(중앙값): WAL {kb(w500)} / UPDATE 1건, TOAST 증가 {kb(toast_growth)} / UPDATE 1건", 3500, 16, WARN, "700")
    c.text(40, 370, "옛 조각은 VACUUM 이 돌기 전까지 그대로 쌓인다.", 4300, 15, MUTED)

    c = s.chapter("4. 키 개수에 비례한다", "바뀐 것은 한 키인데 쓰는 양은 값 크기를 따라간다", 8500)
    rows = [("키 5개", w5, 12), ("키 50개", w50, 12), ("키 500개", w500, 12), ("EAV (행 하나)", eav, 12)]
    mx = max(w500, 1)
    for i, (lab, v, _) in enumerate(rows):
        y = 116 + i * 62
        c.text(40, y + 28, lab, 300 + i * 500, 16, INK)
        bw = max(6, int(560 * v / mx))
        c.box(190, y, bw, 40, OK if lab.startswith("EAV") else BIGM, None, 500 + i * 500)
        c.text(190 + bw + 12, y + 28, f"{kb(v)}", 700 + i * 500, 16, INK, "700")
    c.text(40, 388, "EAV(속성 하나 = 행 하나)는 키가 500개여도 바뀐 행 하나만 쓴다 — 대신 읽을 때 행이 많다.", 3200, 15, MUTED)

    c = s.chapter("5. GIN 이 있으면", f"HOT 갱신이 불가능해지고 인덱스 항목이 전부 다시 들어간다 — WAL {kb(gin500)}", 8000)
    c.box(40, 110, 400, 48, BIGM, f"GIN 없음: WAL {kb(w500)}", 200, 17, ON_FILL)
    c.box(40, 178, 860, 48, TRGM, f"GIN 있음: WAL {kb(gin500)}  ({gin500 / w500:.1f}배)", 900, 17, ON_FILL)
    c.text(40, 276, "GIN 은 값마다 항목(키 500 + 값 500 = 1,000개)을 넣는다. 새 튜플 = 새 TID 이므로 전부 다시 등록한다.", 2200, 15, INK)
    c.text(40, 308, "인덱스 열의 값이 바뀌면 HOT 갱신을 못 쓴다 — 실험 02 의 hot_ratio 가 1.0 에서 0.0 으로 내려간다.", 3200, 15, INK)
    c.text(40, 356, "자주 바뀌는 속성은 GIN 대상 hstore 에서 빼거나, 그 키만 별도 열로 분리하는 편이 낫다.", 4600, 15, WARN)
    return s.build()


# ---------------------------------------------------------------------------
# 3) GIN 조회: 키(K)와 값(V)이 따로 들어가서 recheck 가 필요하다
# ---------------------------------------------------------------------------
def doc_gin_lookup(k):
    INK, MUTED, BIGM, OK, WARN, PANEL, DIM, ON_FILL, TRGM, TSV = (
        k[n] for n in ("INK", "MUTED", "BIGM", "OK", "WARN", "PANEL", "DIM", "ON_FILL", "TRGM", "TSV"))
    s = Story(k, "hstore-gin-lookup", "GIN 은 키와 값을 따로 색인한다 — 그래서 recheck 가 필요하다",
              "gin_extract_hstore: 항목 'K키' 와 'V값' 을 만든다. 짝은 모르므로 @> 는 힙에서 다시 확인한다.",
              940, 560)
    rows = ["color=>red, size=>M", "color=>red, size=>L", "color=>blue, shade=>red", "color=>blue, size=>M"]

    c = s.chapter("1. 행 네 개", "행 3 은 red 가 있지만 color 의 값이 아니다", 6000)
    for i, r in enumerate(rows):
        col = WARN if i == 2 else PANEL
        c.text(40, 128 + i * 60, f"행 {i + 1}", 300 + i * 300, 16, MUTED)
        c.box(110, 100 + i * 60, 420, 44, col, r, 300 + i * 300, 17, ON_FILL if i == 2 else INK, None if i == 2 else DIM)
    c.text(40, 372, "행 3 은 'shade=>red' 다. 값 red 는 있지만 'color=>red' 쌍은 없다.", 2200, 15, WARN)

    c = s.chapter("2. 항목으로 쪼갠다", "각 키는 K 항목, 각 값은 V 항목(NULL 은 N)으로 들어간다", 8500)
    c.text(40, 96, "인덱스 항목 → 그 항목을 가진 행 번호 (포스팅 리스트)", 100, 15, MUTED)
    entries = [("K color", "1 2 3 4"), ("K size", "1 2 4"), ("K shade", "3"), ("V red", "1 2 3"),
               ("V blue", "3 4"), ("V M", "1 4"), ("V L", "2")]
    for i, (e, p) in enumerate(entries):
        y = 116 + i * 52
        c.box(40, y, 160, 40, BIGM if e.startswith("K") else OK, e, 300 + i * 350, 16, ON_FILL)
        c.text(220, y + 27, "→ " + p, 500 + i * 350, 16, INK)
    c.text(40, 500, "키와 값은 서로 다른 항목이다. 'red' 가 어느 키의 값인지는 인덱스가 모른다.", 3400, 15, WARN)

    c = s.chapter("3. 질의를 항목으로", "attrs @> 'color=>red' → K color 와 V red 를 모두 가진 행", 8000)
    c.box(40, 100, 480, 48, PANEL, "WHERE attrs @> 'color=>red'", 200, 18, INK, DIM)
    c.box(40, 190, 160, 40, BIGM, "K color", 900, 16, ON_FILL)
    c.text(220, 217, "→ 1 2 3 4", 1000, 16, INK)
    c.box(40, 246, 160, 40, OK, "V red", 1500, 16, ON_FILL)
    c.text(220, 273, "→ 1 2 3", 1600, 16, INK)
    c.text(40, 336, "교집합 = 행 1, 2, 3  (후보)", 2600, 18, TSV, "700")
    c.text(40, 374, "gin_consistent_hstore 는 @> 에서 recheck = true 를 돌려준다.", 3600, 15, MUTED)
    c.text(40, 404, "인덱스는 '두 항목이 다 있다' 까지만 안다.", 4200, 15, MUTED)

    c = s.chapter("4. 힙에서 다시 확인 (Recheck)", "후보 3행 중 행 3 이 탈락한다", 8000)
    for i in range(3):
        ok = i != 2
        c.text(40, 130 + i * 70, f"행 {i + 1}", 200 + i * 700, 16, MUTED)
        c.box(110, 102 + i * 70, 420, 46, OK if ok else TRGM, rows[i], 300 + i * 700, 17, ON_FILL)
        c.text(550, 132 + i * 70, "color=>red 쌍이 있다 ✔" if ok else "color 는 blue, red 는 shade 의 값 ✘", 700 + i * 700, 15,
               OK if ok else TRGM, "700")
    c.text(40, 356, "결과: 행 1, 2.  'Rows Removed by Index Recheck' 가 탈락한 후보 수다.", 3400, 16, INK, "700")
    c.text(40, 392, "lab 03 에서 decoy 500행으로 이 숫자를 직접 본다.", 4200, 15, MUTED)

    c = s.chapter("5. 키 존재는 정확하다", "attrs ? 'shade' → K shade 하나면 충분해 recheck 가 없다", 6000)
    c.box(40, 100, 480, 48, PANEL, "WHERE attrs ? 'shade'", 200, 18, INK, DIM)
    c.box(40, 190, 160, 40, BIGM, "K shade", 800, 16, ON_FILL)
    c.text(220, 217, "→ 3", 900, 16, INK)
    c.text(40, 290, "결과: 행 3. 키 항목 하나가 곧 답이라 gin_consistent_hstore 도 recheck = false.", 1800, 16, OK, "700")
    c.text(40, 328, "?& (전부 존재) 도 정확하다. ?| (하나라도) 도 recheck 가 없다.", 2800, 15, MUTED)
    return s.build()


# ---------------------------------------------------------------------------
# 4) 동시성: 읽고-계산하고-쓰기(RMW)는 유실, 원자적 ||는 안전 (실험 04)
# ---------------------------------------------------------------------------
def doc_lost_update(k, st):
    INK, MUTED, BIGM, OK, WARN, PANEL, DIM, ON_FILL, TRGM = (
        k[n] for n in ("INK", "MUTED", "BIGM", "OK", "WARN", "PANEL", "DIM", "ON_FILL", "TRGM"))
    conc = st["concurrency"]
    total = conc["clients"] * conc["per_client"]
    rmw = conc["key_add"]["rmw_autocommit"]["keys_present"]
    atomic = conc["key_add"]["atomic_concat"]["keys_present"]
    rr = conc["key_add"]["atomic_repeatable_read"]["succeeded"]
    runs = conc["runs"]
    s = Story(k, "hstore-lost-update", "같은 행을 동시에 고치면 — 통째로 쓰면 유실되고, || 는 안전하다",
              f"실험 04: 클라이언트 {conc['clients']}개가 같은 행에 총 {total}번. RMW 는 키 {rnd(rmw['median'])}개만 남았다 ({runs}회 중앙값).",
              940, 540)

    c = s.chapter("1. 둘 다 읽는다", "행 {a=>1} — A 와 B 가 같은 값을 읽는다", 5500)
    c.box(310, 100, 320, 52, PANEL, "doc 행  attrs = {a=>1}", 200, 17, INK, DIM)
    c.box(40, 210, 260, 52, BIGM, "세션 A  읽음 {a=>1}", 900, 16, ON_FILL)
    c.box(640, 210, 260, 52, TRGM, "세션 B  읽음 {a=>1}", 1400, 16, ON_FILL)
    c.text(40, 330, "앱이 SELECT 로 attrs 를 읽어 메모리에서 고친 뒤 UPDATE 로 통째로 돌려 쓰는 흔한 패턴이다.", 2600, 15, MUTED)

    c = s.chapter("2. A 가 먼저 쓴다", "A: 읽은 값 || 'b=>2' → {a, b}", 5500)
    c.box(310, 100, 320, 52, OK, "doc 행  attrs = {a, b}", 300, 17, ON_FILL)
    c.box(40, 210, 260, 52, BIGM, "A  UPDATE ← {a,b}", 300, 16, ON_FILL)
    c.box(640, 210, 260, 52, TRGM, "B  아직 {a=>1} 을 들고 있다", 300, 15, ON_FILL)
    c.text(40, 330, "A 의 UPDATE 는 성공했고 커밋됐다.", 1400, 15, INK)

    c = s.chapter("3. B 가 자기 사본을 쓴다", "B: 읽어 둔 {a} || 'c=>3' → {a, c}, b 가 사라진다", 6500)
    c.box(310, 100, 320, 52, TRGM, "doc 행  attrs = {a, c}", 300, 17, ON_FILL)
    c.box(640, 210, 260, 52, TRGM, "B  UPDATE ← {a,c}", 300, 16, ON_FILL)
    c.text(40, 330, "b=>2 는 B 가 읽은 사본에 없었으므로 덮어써져 사라졌다. 오류는 나지 않는다.", 1200, 16, WARN, "700")
    c.text(40, 366, f"실측: 총 {total}번 중 {runs}회 모두 키가 {rmw['min']:.0f}~{rmw['max']:.0f}개만 남았다 (기대 {total}개).", 2400, 15, INK)

    c = s.chapter("4. 원자적 ||", "UPDATE ... SET attrs = attrs || 'c=>3' — 식을 서버가 계산한다", 8500)
    c.box(310, 100, 320, 52, PANEL, "doc 행  {a, b}  (A 커밋)", 200, 17, INK, DIM)
    c.box(640, 210, 260, 52, TRGM, "B  attrs || 'c=>3' 대기…", 900, 15, ON_FILL)
    c.text(40, 330, "A 가 행 잠금을 쥐고 있으면 B 는 기다린다. 다른 키라도 잠금 단위는 행이다.", 1600, 15, INK)
    c.text(40, 364, "A 가 커밋하면 B 는 최신 행에 대해 식을 다시 계산한다 → {a, b, c}", 3000, 15, OK, "700")
    c.text(40, 398, f"실측: {runs}회 모두 키 {atomic['min']:.0f}~{atomic['max']:.0f}개 (총 {total}번, 유실 0). SELECT ... FOR UPDATE 후 쓰기도 같다.", 4400, 15, INK)

    c = s.chapter("5. REPEATABLE READ", "재계산하지 않고 40001 오류로 거절한다", 7000)
    c.box(40, 100, 860, 52, PANEL, "BEGIN ISOLATION LEVEL REPEATABLE READ; UPDATE … attrs || …", 200, 17, INK, DIM)
    c.text(40, 220, "스냅샷 이후에 다른 세션이 커밋한 행을 바꾸려 하면 오류: could not serialize access due to concurrent update", 1000, 15, WARN)
    c.text(40, 262, f"실측: {total}번 시도 중 성공 {rr['median']:.0f}번(중앙값), 나머지는 재시도가 필요한 40001 오류.", 2400, 16, INK, "700")
    c.text(40, 300, "유실은 없지만, 한 행에 몰리는 쓰기는 앱이 재시도 루프를 가져야 한다.", 3600, 15, MUTED)
    return s.build()


# ---------------------------------------------------------------------------
# 5) Redis 해시와 hstore 행: 한 필드를 올리는 길 (실험 05)
# ---------------------------------------------------------------------------
def doc_redis_path(k, st):
    INK, MUTED, BIGM, OK, WARN, PANEL, DIM, ON_FILL, TRGM = (
        k[n] for n in ("INK", "MUTED", "BIGM", "OK", "WARN", "PANEL", "DIM", "ON_FILL", "TRGM"))
    cfg = st["redis"]["configs"]

    def ops(side, name, op="increment_counter_c8"):
        return cfg[name][side][op]["ops_per_sec"]["median"]

    s = Story(k, "hstore-redis-path", "필드 하나를 올릴 때 지나가는 길 — Redis 해시 vs hstore 행",
              "실험 05: 같은 일(카운터 +1)을 클라이언트 8개로. 내구성 수준을 맞춘 세 쌍으로 비교했다.",
              940, 520)

    c = s.chapter("1. Redis: HINCRBY", "단일 스레드가 메모리의 해시를 바로 고친다", 7000)
    c.box(40, 110, 170, 54, PANEL, "클라이언트", 200, 16, INK, DIM)
    c.box(240, 110, 190, 54, BIGM, "이벤트 루프", 700, 16, ON_FILL)
    c.box(460, 110, 190, 54, OK, "메모리 해시", 1200, 16, ON_FILL)
    c.box(680, 110, 220, 54, PANEL, "AOF (선택)", 1700, 16, INK, DIM)
    c.text(40, 230, "HINCRBY h:1 cnt 1 — 명령 하나가 곧 원자적 연산이다. 잠금·버전·파싱된 계획이 없다.", 2400, 15, INK)
    c.text(40, 264, "명령은 한 번에 하나씩만 실행되므로 서로 겹치지 않는다.", 3300, 15, MUTED)
    c.text(40, 310, "영속화(AOF)는 설정에 따라 없음 / 1초마다 fsync / 매 쓰기 fsync.", 4200, 15, MUTED)

    c = s.chapter("2. hstore: UPDATE", "행 잠금 → 새 튜플 → WAL → 커밋", 9000)
    c.box(40, 110, 130, 54, PANEL, "클라이언트", 200, 15, INK, DIM)
    c.box(190, 110, 130, 54, BIGM, "백엔드", 500, 15, ON_FILL)
    c.box(340, 110, 130, 54, BIGM, "행 잠금", 800, 15, ON_FILL)
    c.box(490, 110, 130, 54, OK, "새 튜플", 1100, 15, ON_FILL)
    c.box(640, 110, 120, 54, WARN, "WAL", 1400, 15, ON_FILL)
    c.box(780, 110, 120, 54, WARN, "fsync", 1700, 15, ON_FILL)
    c.text(40, 230, "attrs || hstore('cnt', …) — 식은 최신 행 기준으로 계산되고, 값 전체가 새 튜플로 쓰인다.", 2400, 15, INK)
    c.text(40, 264, "같은 행을 노리는 쓰기는 행 잠금에서 줄을 선다. 서로 다른 행이면 병렬로 진행한다.", 3300, 15, MUTED)
    c.text(40, 298, "synchronous_commit=on 이면 커밋이 WAL fsync 를 기다린다.", 4200, 15, MUTED)

    c = s.chapter("3. 실측: 카운터 +1", "클라이언트 8개, 객체 5만 개(필드 20개) 무작위", 10000)
    pairs = [("none", "영속화 없음 · UNLOGGED"), ("relaxed", "everysec · sync=off"), ("strict", "always · sync=on(기본)")]
    mx = max(ops("redis", n) for n, _ in pairs)
    for i, (name, lab) in enumerate(pairs):
        y = 108 + i * 110
        c.text(40, y + 16, lab, 300 + i * 900, 15, MUTED)
        rv, pv = ops("redis", name), ops("postgres", name)
        c.box(40, y + 26, max(6, int(520 * rv / mx)), 26, BIGM, None, 500 + i * 900)
        c.text(40 + max(6, int(520 * rv / mx)) + 12, y + 46, f"Redis {rnd(rv):,}/s", 700 + i * 900, 15, INK, "700")
        c.box(40, y + 58, max(6, int(520 * pv / mx)), 26, OK, None, 900 + i * 900)
        c.text(40 + max(6, int(520 * pv / mx)) + 12, y + 78, f"hstore {rnd(pv):,}/s", 1100 + i * 900, 15, INK, "700")
    c.text(40, 452, "같은 행이 아닌 객체 5만 개에 무작위로 — 경합이 없을 때의 수치다. 쌍마다 영속 보장이 같은 수준일 때만 비교할 수 있다.", 5600, 14, MUTED)
    return s.build()


# ---------------------------------------------------------------------------
# 6) 압축: offset 배열 vs 길이 배열 (실험 01)
# ---------------------------------------------------------------------------
def doc_offsets_vs_lengths(k, st):
    INK, MUTED, BIGM, OK, WARN, PANEL, DIM, ON_FILL, TRGM = (
        k[n] for n in ("INK", "MUTED", "BIGM", "OK", "WARN", "PANEL", "DIM", "ON_FILL", "TRGM"))
    cell = next(c for c in st["storage"]["cells"] if c["keys"] == 500 and c["profile"] == "low")
    probe = cell["compression_probe"]
    hs, jb = cell["hs"]["avg_column_bytes"], cell["jb"]["avg_column_bytes"]
    text_bytes = cell["hs"]["avg_text_bytes"]
    s = Story(k, "hstore-offsets-vs-lengths", "같은 내용인데 hstore 는 왜 덜 압축될까",
              f"실험 01: 키 500개(낮은 엔트로피). hstore {kb(hs)} vs jsonb {kb(jb)}. 원인은 HEntry 의 '끝 위치' 배열.",
              940, 520)

    keys = ["attr_001=>red", "attr_002=>blue", "attr_003=>red", "attr_004=>blue", "attr_005=>red"]
    c = s.chapter("1. 같은 문자열", "키 이름은 똑같이 반복되고 값도 몇 종류뿐이다", 5500)
    for i, kv in enumerate(keys):
        c.box(40 + (i % 3) * 290, 110 + (i // 3) * 64, 270, 46, PANEL, kv, 300 + i * 300, 16, INK, DIM)
    c.text(40, 280, "문자열 자체는 반복이 많아 압축이 잘 된다 (attr_ 로 시작하는 키가 500번 나온다).", 2200, 15, INK)
    c.text(40, 312, "문제는 문자열 옆에 붙는 4바이트 정수 배열이다.", 3200, 15, MUTED)

    c = s.chapter("2. hstore: 끝 위치", "HEntry 는 누적 위치를 저장한다 — 매번 다른 숫자", 6500)
    c.text(40, 100, "hstore  HEntry 배열 (키, 값, 키, 값, …)", 100, 16, BIGM, "700")
    ends = [8, 11, 19, 23, 31, 34, 42, 46, 54, 57]
    for i, v in enumerate(ends):
        c.box(40 + i * 86, 124, 78, 44, BIGM, str(v), 400 + i * 250, 17, ON_FILL)
    c.text(40, 232, "8, 11, 19, 23, 31 … 이 계속 커진다. 같은 값이 다시 나오는 일이 없다.", 3000, 15, INK)
    c.text(40, 266, "압축(pglz·lz4)은 앞에서 본 바이트열이 반복될 때만 이득이다.", 3800, 15, WARN)

    c = s.chapter("3. jsonb: 길이", "JEntry 는 대부분 길이를 저장한다 — 반복된다", 6500)
    c.text(40, 100, "jsonb  JEntry 배열 (키, 값, 키, 값, …)", 100, 16, OK, "700")
    lens = [8, 3, 8, 4, 8, 3, 8, 4, 8, 3]
    for i, v in enumerate(lens):
        c.box(40 + i * 86, 124, 78, 44, OK, str(v), 400 + i * 250, 17, ON_FILL)
    c.text(40, 232, "8, 3, 8, 4, 8, 3, 8, 4 … 같은 패턴이 되풀이돼 압축이 잘 된다.", 3000, 15, INK)
    c.text(40, 266, "jsonb 소스(jsonb.h) 주석: 처음엔 offset 만 저장했다가 압축이 안 돼 '길이 + 32번째마다 offset' 으로 바꿨다.", 3800, 14, MUTED)

    c = s.chapter("4. 실측", "같은 문자열에 두 배열만 바꿔 붙여 압축해 본 결과", 9500)
    lz4_off, lz4_len = probe["layout_offsets_lz4_avg"], probe["layout_lengths_lz4_avg"]
    raw = probe["layout_raw_avg"]
    mx = raw
    items = [("원본 크기", raw, PANEL, INK), ("끝 위치 배열 + 문자열 (lz4)", lz4_off, BIGM, ON_FILL),
             ("길이 배열 + 문자열 (lz4)", lz4_len, OK, ON_FILL)]
    for i, (lab, v, col, tc) in enumerate(items):
        y = 106 + i * 82
        c.text(40, y + 14, lab, 300 + i * 900, 15, MUTED)
        w = max(6, int(600 * v / mx))
        c.box(40, y + 24, w, 34, col, None, 500 + i * 900)
        c.text(40 + w + 12, y + 48, kb(v), 700 + i * 900, 16, INK, "700")
    c.text(40, 372, f"실제 값: hstore {kb(hs)} · jsonb {kb(jb)} (행당 평균, 텍스트 표현은 {kb(text_bytes)})", 3700, 15, INK, "700")
    c.text(40, 406, "정렬·키 길이·문자열은 같고 배열만 다르다 — 크기 차이는 이 배열이 만든다.", 4700, 15, MUTED)
    return s.build()


# ---------------------------------------------------------------------------
# 7) jsonb 와 타입: hstore 는 문자열만, 중첩은 텍스트가 된다 (lab 01/03 출력)
# ---------------------------------------------------------------------------
def doc_json_types(k):
    INK, MUTED, BIGM, OK, WARN, PANEL, DIM, ON_FILL, TRGM = (
        k[n] for n in ("INK", "MUTED", "BIGM", "OK", "WARN", "PANEL", "DIM", "ON_FILL", "TRGM"))
    s = Story(k, "hstore-vs-jsonb-types", "jsonb 를 hstore 로 옮기면 타입과 중첩이 사라진다",
              "jsonb_each_text 로 펼쳐 hstore 로 만든 결과. 값은 전부 text 이고 배열·객체는 JSON 문자열이 된다.",
              940, 500)
    c = s.chapter("1. jsonb 문서", "숫자 · 불리언 · 배열 · 중첩 객체", 5500)
    c.box(40, 110, 860, 56, PANEL, '{"a": 1, "b": true, "c": [1, 2], "d": {"x": 1}}', 300, 20, INK, DIM)
    for i, (lab, col) in enumerate([("숫자", BIGM), ("불리언", OK), ("배열", WARN), ("객체", TRGM)]):
        c.box(40 + i * 220, 214, 200, 40, col, lab, 1200 + i * 350, 17, ON_FILL)
    c.text(40, 310, "jsonb 는 값마다 타입이 있고 중첩할 수 있다.", 2800, 15, MUTED)

    c = s.chapter("2. hstore 로 옮긴다", "각 값이 text 한 덩어리가 된다", 8500)
    rows = [("a", "1", "숫자 → 문자열 '1'", BIGM), ("b", "true", "불리언 → 문자열 'true'", OK),
            ("c", "[1, 2]", "배열 → 텍스트 '[1, 2]'", WARN), ("d", '{"x": 1}', "객체 → 텍스트 '{\"x\": 1}'", TRGM)]
    for i, (key, val, note, col) in enumerate(rows):
        y = 106 + i * 70
        c.box(40, y, 300, 46, col, f'"{key}" => "{val}"', 300 + i * 500, 18, ON_FILL)
        c.text(360, y + 30, note, 500 + i * 500, 16, INK)
    c.text(40, 410, "안쪽 x 는 더 이상 키가 아니다 — d 의 값(문자열)을 쿼리하려면 다시 jsonb 로 파싱해야 한다.", 2800, 15, WARN)

    c = s.chapter("3. 돌아올 때", "hstore_to_jsonb 는 전부 문자열, _loose 는 모양으로 추측한다", 8500)
    c.box(40, 106, 860, 46, PANEL, "hstore_to_jsonb('n=>42, flag=>t')", 200, 17, INK, DIM)
    c.text(40, 190, '→ {"n": "42", "flag": "t"}   전부 문자열', 700, 16, INK)
    c.box(40, 232, 860, 46, PANEL, "hstore_to_jsonb_loose('n=>42, flag=>t, word=>true')", 1400, 17, INK, DIM)
    c.text(40, 316, '→ {"n": 42, "flag": true, "word": "true"}   숫자는 숫자로, t·f 만 불리언으로', 1900, 16, INK)
    c.text(40, 368, "'true' 는 문자열로 남고 1.10 은 숫자가 되며 007 은 문자열로 남는다 — 모양으로 추측하는 변환이다.", 3400, 15, WARN)
    return s.build()


def docs(kit):
    """build.py 가 호출한다. 이름 → 문서 dict."""
    st = load_stats()
    return {
        "hstore-storage-layout": doc_storage_layout(kit),
        "hstore-update-rewrite": doc_update_rewrite(kit, st),
        "hstore-gin-lookup": doc_gin_lookup(kit),
        "hstore-lost-update": doc_lost_update(kit, st),
        "hstore-redis-path": doc_redis_path(kit, st),
        "hstore-offsets-vs-lengths": doc_offsets_vs_lengths(kit, st),
        "hstore-vs-jsonb-types": doc_json_types(kit),
    }

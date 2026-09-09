#!/usr/bin/env python3
"""clotho 애니메이션 문서를 만들고 스키마로 검증한다.

    python3 build.py            # animations/*.json 생성 + 검증
    python3 build.py --check    # 검증만 (파일을 쓰지 않는다)

생성한 JSON 은 web/ 앱이 Vite 로 직접 import 한다.
문서 목록(index.ts)도 이 스크립트가 함께 갱신한다.
"""
from __future__ import annotations
import json, sys, os, re, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA_URL = "https://cdn.jsdelivr.net/npm/@kokoa/clotho@0.4.0/schema/clotho-1.schema.json"
SCHEMA_CACHE = os.path.join(HERE, ".clotho-schema.json")

# 색 (assets/style.css 의 토큰과 맞춘다). **다크 전용**이다 — 라이트 팔레트는 없다.
BG       = "#0b1120"   # 캔버스 배경 (= --bg)
PANEL    = "#1e293b"   # 중립 상자 (= --panel-2)
INK      = "#e2e8f0"   # 밝은 글자 (어두운 배경 위)
ON_FILL  = "#0b1120"   # 어두운 글자 (밝은 채움 위)
MUTED    = "#94a3b8"
BIGM     = "#60a5fa"   # 파랑  = pg_bigm / 2-gram
TRGM     = "#fb7185"   # 빨강  = pg_trgm / 3-gram
TSV      = "#a78bfa"   # 보라  = tsvector
PAD      = "#64748b"   # 회색  = 패딩
OK       = "#34d399"   # 초록  = 성공
WARN     = "#fbbf24"   # 주황  = 경고
DIM      = "#334155"   # 테두리·비활성


def txt(id, x, y, content, size=16, color=INK, start=0, end=None, weight=None,
        anchor="start", entry="fade", dur=260):
    e = {"type": "text", "id": id, "x": x, "y": y, "content": content,
         "fontSize": size, "color": color, "textAnchor": anchor,
         "appearances": [{"start": start, "end": end, "entryMode": entry, "entryDuration": dur}]}
    if weight:
        e["fontWeight"] = weight
    return e


def box(id, x, y, w, h, fill, start=0, end=None, label=None, radius=8,
        entry="pop", dur=260, label_color=ON_FILL, label_size=18, stroke=None):
    e = {"type": "rect", "id": id, "x": x, "y": y, "width": w, "height": h,
         "fill": fill, "cornerRadius": radius,
         "appearances": [{"start": start, "end": end, "entryMode": entry, "entryDuration": dur}]}
    if label is not None:
        e["label"] = label
        e["labelColor"] = label_color
        e["labelSize"] = label_size
    if stroke:
        e["stroke"] = stroke
        e["strokeWidth"] = 2
    return e


# ---------------------------------------------------------------------------
# 1) n-gram 분해: 패딩 -> 2-gram -> 3-gram -> 2글자 검색어의 함정
# ---------------------------------------------------------------------------
def widen(doc, pad):
    """캔버스 좌우에 여백을 만들고 내용을 그만큼 오른쪽으로 민다.

    카메라 focus 는 대상의 경계 상자를 화면에 '맞춰서' 확대하는데, 내용이 캔버스 폭을
    거의 다 쓰면 가로가 병목이라 배율이 1 에 가까워진다 — 즉 아무 일도 안 일어난다.
    좌우에 여백을 주면 세로로 좁은 띠 하나를 확대할 여지가 생긴다.
    """
    for el in doc["elements"]:
        if "x" in el:
            el["x"] += pad
    doc["canvas"]["width"] += pad * 2
    return doc


def chapter_frames(els, chapters, groups, end, canvas_h,
                   content_x=40, content_w=860,
                   pad_top=30, pad_bottom=24, pad_side=64):
    """장마다 **같은 크기의** 카메라 틀을 만들어 붙인다.

    focus 는 대상 상자에 화면을 '맞추므로', 장마다 상자 크기가 다르면 배율이 매번 달라진다 -
    확대·축소가 반복되면 읽기가 어렵다. 그래서 **모든 장에서 크기가 같은 보이지 않는 틀**을 두고
    그 틀만 초점 대상으로 삼는다. 결과적으로 배율은 고정되고 카메라는 위아래로 이동만 한다.

    틀의 가로는 내용 전체 폭 + 좌우 여백(pad_side)으로 고정한다. 폭을 딱 맞추면 글자가
    화면 가장자리에 붙어 읽기 불편하고, 잘릴 여지도 생긴다.
    세로는 가장 큰 장에 맞춘 하나의 값이다.

    돌려주는 것: (틀 요소 목록, focus 목록)
    """
    def extent(el):
        y = el.get("y", 0)
        if el["type"] == "rect":
            return y, y + el.get("height", 0)
        # 텍스트는 y 가 기준선이다. 위로 폰트 크기만큼, 아래로 조금 잡는다.
        size = el.get("fontSize", 16)
        return y - size, y + size * 0.35

    by_id = {el["id"]: el for el in els}
    bands = []
    for ids in groups:
        missing = [i for i in ids if i not in by_id]
        if missing:
            raise SystemExit(f"chapter_frames: 없는 요소 id {missing}")
        tops, bottoms = zip(*(extent(by_id[i]) for i in ids))
        bands.append((min(tops) - pad_top, max(bottoms) + pad_bottom))

    height = max(b - a for a, b in bands)
    frames, focus = [], []
    for n, ((top, bottom), ch, ids) in enumerate(zip(bands, chapters, groups)):
        center = (top + bottom) / 2
        # 캔버스 밖으로 나가지 않게 붙인다 - 틀이 띠보다 크므로 내용은 그대로 다 들어온다
        y = round(min(max(center - height / 2, 0), canvas_h - height))
        fid = f"cam{n}"
        frames.append({
            "type": "rect", "id": fid, "x": content_x - pad_side, "y": y,
            "width": content_w + pad_side * 2, "height": round(height),
            "fill": BG, "stroke": BG, "strokeWidth": 0, "cornerRadius": 0,
            "appearances": [{"start": 0, "end": end, "entryMode": "instant", "entryDuration": 1}],
        })
        # 그 장의 첫 요소가 나타난 뒤에 옮긴다 (틀은 처음부터 있으므로 진단은 안 뜬다)
        first = min(min((a["start"] for a in by_id[i].get("appearances", [])), default=0) for i in ids)
        focus.append({
            "time": max(ch["time"] + 250, first),
            "duration": 800, "elementIds": [fid],
            "padding": 0, "maxZoom": 8.0, "ease": "easeInOut",
        })
    return frames, focus



def doc_ngram_slice():
    W, H = 940, 460
    word = "클라우드클럽"
    CW, CH = 56, 56           # 글자 상자
    els, chapters = [], []
    END = 25000

    els.append(txt("title", 40, 42, "n-gram 은 문자열을 길이 n 짜리 조각으로 자른다", 22, INK, 0, END, "700"))

    # --- 1장: 원본 문자열 -----------------------------------------------
    x0 = 160          # 왼쪽에 패딩 상자 2칸이 들어갈 자리를 비워둔다
    for i, ch in enumerate(word):
        els.append(box(f"c{i}", x0 + i * (CW + 6), 100, CW, CH, PANEL,
                       start=200 + i * 90, end=END, label=ch, label_color=INK, radius=10))
    els.append(txt("cap1", x0, 196, "원본 6글자", 15, MUTED, 900, 3400))
    chapters.append({"id": "ch1", "time": 0, "label": "1. 원본 문자열",
                     "subtitle": "클라우드클럽 — 6글자"})

    # --- 2장: 패딩 -------------------------------------------------------
    # pg_bigm 은 앞 1 뒤 1, pg_trgm 은 앞 2 뒤 1 을 붙인다.
    els.append(txt("cap2", 40, 196,
                   "패딩: 단어의 시작·끝을 조각 안에 표현하려고 앞뒤에 공백을 붙인다",
                   15, MUTED, 3600, 8600))
    els.append(box("padl1", x0 - (CW + 6), 100, CW, CH, PAD, start=3600, end=8600,
                   label="␣", radius=10))
    els.append(box("padr1", x0 + 6 * (CW + 6), 100, CW, CH, PAD, start=3600, end=8600,
                   label="␣", radius=10))
    els.append(txt("padnote", 40, 232, "pg_bigm: 앞 1 + 뒤 1", 14, BIGM, 4200, 8600, "600"))
    els.append(box("padl2", x0 - 2 * (CW + 6), 100, CW, CH, PAD, start=5400, end=8600,
                   label="␣", radius=10))
    els.append(txt("padnote2", 260, 232, "pg_trgm: 앞 2 + 뒤 1  ← 3글자 조각에 첫 글자를 담으려면 2칸이 필요하다",
                   14, TRGM, 5400, 8600, "600"))
    chapters.append({"id": "ch2", "time": 3500, "label": "2. 패딩을 붙인다",
                     "subtitle": "pg_bigm 은 1+1, pg_trgm 은 2+1"})

    # --- 3장: 2-gram -----------------------------------------------------
    bigrams = ["␣클", "클라", "라우", "우드", "드클", "클럽", "럽␣"]
    els.append(txt("cap3", 40, 300, "2-gram (pg_bigm) — 7개", 17, BIGM, 8800, 15600, "700"))
    for i, g in enumerate(bigrams):
        els.append(box(f"bg{i}", 40 + i * 124, 322, 112, 46, BIGM,
                       start=9000 + i * 320, end=15600, label=g, label_size=17, radius=8))
    chapters.append({"id": "ch3", "time": 8700, "label": "3. 2-gram 으로 자른다",
                     "subtitle": "겹쳐가며 두 글자씩 — 7개"})

    # --- 4장: 3-gram -----------------------------------------------------
    trigrams = ["␣␣클", "␣클라", "클라우", "라우드", "우드클", "드클럽", "클럽␣"]
    els.append(txt("cap4", 40, 392, "3-gram (pg_trgm) — 7개, 개수는 같다", 17, TRGM, 15800, END, "700"))
    for i, g in enumerate(trigrams):
        els.append(box(f"tg{i}", 40 + i * 124, 414, 112, 46, TRGM,
                       start=16000 + i * 320, end=END, label=g, label_size=17, radius=8))
    chapters.append({"id": "ch4", "time": 15700, "label": "4. 3-gram 으로 자른다",
                     "subtitle": "패딩까지 세면 조각 개수는 L+1 로 같다"})

    return {
        "clothoVersion": 1, "id": "ngram-slice",
        "title": "n-gram 분해 — 2-gram 과 3-gram",
        "description": "패딩을 붙여 자르면 조각 개수는 같다. 차이는 조각 하나의 길이다.",
        "duration": END,
        "canvas": {"width": W, "height": H + 60, "background": BG},
        "elements": els, "chapters": chapters,
        "settings": {"loop": False, "autoplay": True, "showChapterList": True},
    }


# ---------------------------------------------------------------------------
# 2) 2글자 함정: %클클% 이 왜 전체 인덱스 스캔이 되나
# ---------------------------------------------------------------------------
def doc_two_char_trap():
    els, chapters = [], []
    END = 26000
    els.append(txt("t", 40, 42, "2글자 검색어 '클클' 에서 벌어지는 일", 22, INK, 0, END, "700"))

    # 1장 - 질의
    els.append(box("q", 40, 78, 300, 52, PANEL, start=200, end=END, stroke=DIM,
                   label="LIKE '%클클%'", label_size=19, radius=10, label_color=INK))
    els.append(txt("qn", 360, 110,
                   "양쪽이 % 라서 그 자리에 무슨 글자가 올지 모른다 → 패딩을 붙일 수 없다",
                   15, MUTED, 900, END))
    chapters.append({"id": "q1", "time": 0, "label": "1. 질의",
                     "subtitle": "%클클% — 양쪽이 와일드카드다"})

    # 2장 - bigm 은 조각을 만든다
    els.append(txt("bl", 40, 180, "pg_bigm (2-gram)", 18, BIGM, 3000, END, "700"))
    els.append(box("bfrag", 40, 200, 132, 50, BIGM, start=3200, end=END,
                   label="클클", label_size=19, radius=8))
    els.append(txt("bok", 190, 232, "조각 1개 — 온전히 만들어진다", 15, OK, 3800, END, "600"))
    els.append(box("bres", 40, 266, 420, 44, OK, start=4600, end=END,
                   label="인덱스가 500행만 돌려준다", label_size=16, radius=8))
    els.append(txt("bms", 476, 296, "0.52 ms", 20, OK, 5200, END, "700"))
    chapters.append({"id": "q2", "time": 2900, "label": "2. pg_bigm 은 만든다",
                     "subtitle": "2글자로도 온전한 bigram 하나"})

    # 3장 - trgm 은 못 만든다
    els.append(txt("tl", 40, 356, "pg_trgm (3-gram)", 18, TRGM, 8000, END, "700"))
    els.append(box("tfrag", 40, 376, 132, 50, "#4c1d24", start=8200, end=END,
                   label="( 없음 )", label_color=TRGM, label_size=17, radius=8))
    els.append(txt("tno", 190, 400,
                   "3글자를 채울 수 없다 → make_trigrams() 가 charlen<3 에서 포기한다",
                   15, TRGM, 8800, END, "600"))
    chapters.append({"id": "q3", "time": 7900, "label": "3. pg_trgm 은 못 만든다",
                     "subtitle": "조각 0개 → 조건이 하나도 없다"})

    # 4장 - GIN_SEARCH_MODE_ALL
    els.append(box("all", 40, 442, 560, 46, TRGM, start=13000, end=END,
                   label="GIN_SEARCH_MODE_ALL — 인덱스 엔트리를 전부 읽는다", label_size=16, radius=8))
    els.append(txt("alln", 40, 512,
                   "\"인덱스를 안 쓴다\" 가 아니라 \"인덱스를 통째로 읽고 나서 힙까지 훑는다\"",
                   15, INK, 13800, END, "600"))
    els.append(box("tres", 40, 530, 420, 44, TRGM, start=14600, end=END,
                   label="인덱스가 1,000,000행을 돌려준다", label_size=16, radius=8))
    els.append(txt("tms", 476, 560, "797 ms", 20, TRGM, 15200, END, "700"))
    els.append(txt("ratio", 40, 606, "→ 같은 검색어인데 1,500배 차이", 19, WARN, 17000, END, "700"))
    chapters.append({"id": "q4", "time": 12900, "label": "4. 전체 인덱스 스캔",
                     "subtitle": "인덱스가 없느니만 못한 상태"})

    # 5장 - 우회
    els.append(txt("fix", 40, 648, "우회: 패딩을 얻어낼 수 있는 패턴으로 바꾼다", 18, OK, 20000, END, "700"))
    for i, (pat, ms, note) in enumerate([
            ("클클%", "1.49 ms", "앞이 문자열 시작 → 패딩 2칸"),
            ("% 클클 %", "빠름", "공백은 비단어 문자 → 패딩"),
    ]):
        els.append(box(f"fx{i}", 40 + i * 300, 668, 150, 42, OK, start=20400 + i * 700,
                       end=END, label=pat, label_size=16, radius=8))
        els.append(txt(f"fxn{i}", 40 + i * 300, 726, note, 13, MUTED, 20700 + i * 700, END))
    chapters.append({"id": "q5", "time": 19900, "label": "5. 우회",
                     "subtitle": "패턴을 바꾸면 2글자도 산다"})

    return {
        "clothoVersion": 1, "id": "two-char-trap",
        "title": "2글자 함정 — pg_trgm 이 무너지는 지점",
        "description": "%클클% 797 ms vs 클클% 1.49 ms. 같은 검색어, 패턴 모양만 다르다.",
        "duration": END,
        "canvas": {"width": 940, "height": 760, "background": BG},
        "elements": els, "chapters": chapters,
        "settings": {"loop": False, "autoplay": True, "showChapterList": True},
    }


# ---------------------------------------------------------------------------
# 3) GIN 검색 파이프라인
# ---------------------------------------------------------------------------
def doc_gin_pipeline():
    els, chapters = [], []
    END = 22000
    els.append(txt("t", 40, 42, "GIN 인덱스는 LIKE 를 어떻게 처리하나", 22, INK, 0, END, "700"))

    stages = [
        ("질의  LIKE '%클둥이%'",      "extractQuery() 가 조각으로 분해한다",        INK),
        ("조각  클둥 · 둥이",            "각 조각의 포스팅 리스트를 찾는다",          BIGM),
        ("엔트리 트리 탐색",             "조각 → 그 조각을 가진 행들의 TID 목록",      BIGM),
        ("비트맵 AND",                   "모든 조각을 가진 행만 남긴다",               BIGM),
        ("Bitmap Heap Scan",             "후보 500행의 원문을 힙에서 읽는다",          WARN),
        ("Recheck",                      "'trial' vs 'trivial' — 순서까지 확인한다",   WARN),
        ("결과 500행",                   "0.5 ms",                                     OK),
    ]
    y = 92
    for i, (label, note, color) in enumerate(stages):
        st = 300 + i * 2800
        els.append(box(f"s{i}", 40, y + i * 82, 380, 54, color, start=st, end=END,
                       label=label, label_size=17, radius=10))
        els.append(txt(f"n{i}", 440, y + i * 82 + 34, note, 15, MUTED, st + 500, END))
        if i < len(stages) - 1:
            els.append(txt(f"a{i}", 220, y + i * 82 + 76, "▼", 18, PAD, st + 900, END))
        chapters.append({"id": f"g{i}", "time": max(0, st - 300),
                         "label": f"{i+1}. {label}", "subtitle": note})

    els.append(txt("foot", 40, y + len(stages) * 82 + 40,
                   "Recheck 이 항상 붙는 이유: 조각이 다 들어있어도 순서가 다를 수 있다",
                   15, INK, 19500, END, "600"))
    return {
        "clothoVersion": 1, "id": "gin-pipeline",
        "title": "GIN 검색 파이프라인",
        "description": "extractQuery → 포스팅 리스트 → 비트맵 AND → 힙 Recheck",
        "duration": END,
        "canvas": {"width": 940, "height": y + len(stages) * 82 + 80, "background": BG},
        "elements": els, "chapters": chapters,
        "settings": {"loop": False, "autoplay": True, "showChapterList": True},
    }


# ---------------------------------------------------------------------------
# 4) 어휘 단위(tsvector) vs 문자 단위(n-gram)
# ---------------------------------------------------------------------------
def doc_lexeme_vs_ngram():
    els, chapters = [], []
    END = 24000
    sent = "이 영화가 재미있다"
    els.append(txt("t", 40, 42, "같은 문장을 두 방식이 어떻게 쪼개나", 22, INK, 0, END, "700"))
    els.append(box("src", 40, 74, 420, 52, PANEL, start=200, end=END, stroke=DIM,
                   label=sent, label_size=19, radius=10, label_color=INK))
    chapters.append({"id": "l0", "time": 0, "label": "1. 원문", "subtitle": sent})

    # tsvector
    els.append(txt("tsl", 40, 176, "tsvector — 어휘(공백) 단위", 18, TSV, 2600, END, "700"))
    for i, lx in enumerate(["'이'", "'영화가'", "'재미있다'"]):
        els.append(box(f"lx{i}", 40 + i * 176, 196, 164, 48, TSV,
                       start=2800 + i * 500, end=END, label=lx, label_size=17, radius=8))
    els.append(txt("tsn", 40, 274,
                   "조사가 붙은 '영화가' 가 통째로 하나의 어휘소다 → '영화' 로는 못 찾는다",
                   15, TSV, 4600, END, "600"))
    chapters.append({"id": "l1", "time": 2500, "label": "2. tsvector",
                     "subtitle": "어휘 단위 — 조사가 붙은 채로 하나"})

    # n-gram
    els.append(txt("ngl", 40, 330, "n-gram (2-gram) — 문자 단위", 18, BIGM, 9000, END, "700"))
    grams = ["이␣", "␣영", "영화", "화가", "가␣", "␣재", "재미", "미있", "있다"]
    for i, g in enumerate(grams):
        els.append(box(f"ng{i}", 40 + i * 98, 350, 88, 44, BIGM,
                       start=9200 + i * 240, end=END, label=g, label_size=16, radius=8))
    els.append(txt("ngn", 40, 424,
                   "'영화' 도 '화가' 도 조각으로 존재한다 → 어휘 경계를 가로질러 찾을 수 있다",
                   15, BIGM, 11800, END, "600"))
    chapters.append({"id": "l2", "time": 8900, "label": "3. n-gram",
                     "subtitle": "문자 단위 — 띄어쓰기와 무관"})

    # 결과 대비
    els.append(txt("rl", 40, 486, "그래서 100만 행에서 이렇게 갈린다", 18, INK, 15000, END, "700"))
    rows = [
        ("LIKE '%영화%'  (정답)", "313,435행", OK),
        ("tsquery '영화'", "118,440행  =  37.8%", TRGM),
        ("tsquery '영화:*'", "239,650행  =  76.5%", WARN),
    ]
    for i, (a, b, c) in enumerate(rows):
        st = 15400 + i * 1800
        els.append(box(f"r{i}", 40, 506 + i * 62, 320, 48, c, start=st, end=END,
                       label=a, label_size=16, radius=8))
        els.append(txt(f"rv{i}", 380, 538 + i * 62, b, 19, c, st + 400, END, "700"))
    els.append(txt("rn", 40, 706,
                   "전문검색이 틀린 게 아니라 다른 질문에 답한다 — '단어가 있나' vs '문자열이 있나'",
                   15, MUTED, 21000, END))
    chapters.append({"id": "l3", "time": 14900, "label": "4. 결과",
                     "subtitle": "부분 문자열 요구에 대한 재현율 37.8%"})

    return {
        "clothoVersion": 1, "id": "lexeme-vs-ngram",
        "title": "어휘 단위 vs 문자 단위",
        "description": "tsvector 는 단어를, n-gram 은 문자를 자른다. 한국어 조사가 그 차이를 키운다.",
        "duration": END,
        "canvas": {"width": 940, "height": 740, "background": BG},
        "elements": els, "chapters": chapters,
        "settings": {"loop": False, "autoplay": True, "showChapterList": True},
    }



# ---------------------------------------------------------------------------
# 5) B-tree 는 왜 '%검색어%' 를 못 푸나 — 정렬 순서 vs 역인덱스
# ---------------------------------------------------------------------------
def doc_btree_vs_inverted():
    els, chapters = [], []
    END = 36000
    els.append(txt("t", 40, 42, "B-tree 는 왜 LIKE '%클럽%' 를 못 푸나", 22, INK, 0, END, "700"))

    # --- 1장: B-tree 가 저장하는 것 = 정렬된 '문자열 전체' ------------------
    rows = ["강남클럽", "개발자모임", "클라우드클럽", "클럽하우스", "한국클럽"]
    els.append(txt("c1", 40, 92, "B-tree 는 컬럼 값 '전체'를 사전순으로 정렬해 저장한다",
                   16, MUTED, 300, END))
    for i, r in enumerate(rows):
        els.append(box(f"bt{i}", 40, 112 + i * 46, 260, 38, PANEL, stroke=DIM,
                       start=600 + i * 260, end=END, label=r, label_color=INK,
                       label_size=16, radius=6))
    els.append(txt("btord", 316, 200, "↑ 사전순", 14, MUTED, 2200, END))
    chapters.append({"id": "b1", "time": 0, "label": "1. B-tree 가 저장하는 것",
                     "subtitle": "값 전체를 사전순으로"})

    # --- 2장: 접두어는 연속 구간이라 풀린다 ---------------------------------
    els.append(txt("c2", 380, 130, "LIKE '클럽%'  →  '클럽' ≤ x < '클렄'", 17, OK, 4000, END, "700"))
    els.append(txt("c2b", 380, 158, "정렬 순서에서 한 덩어리다 → 범위 스캔 한 번",
                   15, MUTED, 4400, END))
    els.append(box("hit1", 40, 250, 260, 38, OK, start=5000, end=END,
                   label="클럽하우스", label_size=16, radius=6))
    els.append(txt("c2c", 380, 200, "찾는 값이 트리의 '한 곳'에 모여 있다", 15, OK, 5400, END, "600"))
    els.append(txt("c2d", 380, 224,
                   "플래너가 패턴을 범위로 다시 쓴다 —", 14, MUTED, 6000, END))
    els.append(txt("c2d2", 380, 244,
                   "'클럽' 의 마지막 글자를 하나 올려 끝점을 만든다", 14, MUTED, 6200, END))
    els.append(txt("c2e", 380, 268,
                   "단, 콜레이션이 C 가 아니면 이 변환이 성립하지 않는다", 14, WARN, 6800, END))
    els.append(txt("c2e2", 380, 288,
                   "→ text_pattern_ops 연산자 클래스가 필요하다", 14, WARN, 7000, END))
    chapters.append({"id": "b2", "time": 3900, "label": "2. 접두어는 풀린다",
                     "subtitle": "'클럽%' 는 정렬 순서상 연속 구간"})

    # --- 3장: 부분 문자열은 흩어져 있다 -------------------------------------
    els.append(txt("c3", 380, 330, "LIKE '%클럽%'  →  범위로 표현할 수 없다", 17, TRGM, 9000, END, "700"))
    for i, y in enumerate([112, 204, 250, 296]):
        els.append(box(f"sc{i}", 40, y, 260, 38, TRGM, start=9400 + i * 400, end=END,
                       label=rows[[0, 2, 3, 4][i]], label_size=16, radius=6))
    for i, (lab, y) in enumerate(zip(["ㄱ 구간", "ㅋ 구간", "ㅋ 구간", "ㅎ 구간"], [112, 204, 250, 296])):
        els.append(txt(f"scl{i}", 316, y + 25, lab, 13, TRGM, 9600 + i * 400, END))
    els.append(txt("c3b", 380, 360,
                   "'클럽' 을 포함하는 값이 정렬 순서 전체에 흩어진다",
                   15, TRGM, 11200, END))
    els.append(txt("c3b2", 380, 382, "첫 글자가 제각각이라서다", 15, TRGM, 11500, END))
    els.append(txt("c3c", 380, 408,
                   "→ 시작점도 끝점도 정할 수 없다 → 전부 훑는 수밖에 없다", 15, TRGM, 11800, END, "600"))
    els.append(box("seq", 380, 428, 400, 44, TRGM, start=12600, end=END,
                   label="Seq Scan — 100만 행이면 100만 번 비교", label_size=15, radius=8))
    chapters.append({"id": "b3", "time": 8900, "label": "3. 부분 문자열은 못 푼다",
                     "subtitle": "정렬 순서에 흩어져 있어서 구간이 안 된다"})

    # --- 4장: 문제를 뒤집는다 -----------------------------------------------
    els.append(txt("c4", 40, 508, "그래서 저장하는 '단위'를 바꾼다", 19, INK, 16000, END, "700"))
    els.append(txt("c4b", 40, 536,
                   "값 전체가 아니라, 값을 쪼갠 조각을 키로 쓰고 값에는 '그 조각을 가진 행 목록'을 둔다",
                   15, MUTED, 16400, END))
    inv = [("␣클", "1, 3, 4, 5"), ("클럽", "1, 3, 4, 5"), ("럽하", "4"), ("클라", "3")]
    for i, (k, v) in enumerate(inv):
        st = 17200 + i * 900
        els.append(box(f"iv{i}", 40, 564 + i * 52, 120, 42, BIGM, start=st, end=END,
                       label=k, label_size=17, radius=8))
        els.append(box(f"ivp{i}", 168, 564 + i * 52, 240, 42, PANEL, stroke=DIM, start=st + 300,
                       end=END, label=v, label_color=INK, label_size=15, radius=8))
    els.append(txt("c4c", 430, 590, "키 = 조각", 15, BIGM, 18000, END, "600"))
    els.append(txt("c4d", 430, 618, "값 = 그 조각을 가진 행들의 TID 목록 (포스팅 리스트)",
                   15, MUTED, 18400, END))
    els.append(txt("c4e", 430, 644,
                   "대가: 행 하나가 키 '글자 수 + 1' 개를 만든다", 14, WARN, 19200, END))
    els.append(txt("c4e2", 430, 664,
                   "→ 인덱스가 커지고 쓰기가 느려진다", 14, WARN, 19500, END))
    els.append(txt("c4f", 430, 688,
                   "실측: 테이블 대비 0.79~1.42배 (bigm)", 14, MUTED, 20000, END))
    els.append(txt("c4f2", 430, 708,
                   "btree 는 0.98배로 평평하다", 14, MUTED, 20300, END))
    chapters.append({"id": "b4", "time": 15900, "label": "4. 문제를 뒤집는다",
                     "subtitle": "값→행 이 아니라 조각→행 목록"})

    # --- 5장: 그러면 부분 문자열이 집합 연산이 된다 --------------------------
    els.append(txt("c5", 40, 790, "이제 '%클럽%' 은 집합 연산이다", 19, OK, 24000, END, "700"))
    els.append(box("q1", 40, 812, 130, 42, BIGM, start=24400, end=END,
                   label="␣클 → 1,3,4,5", label_size=14, radius=8))
    els.append(txt("amp", 182, 840, "∩", 22, INK, 25000, END, "700"))
    els.append(box("q2", 210, 812, 130, 42, BIGM, start=25000, end=END,
                   label="클럽 → 1,3,4,5", label_size=14, radius=8))
    els.append(txt("eq", 352, 840, "=", 22, INK, 25600, END, "700"))
    els.append(box("q3", 378, 812, 130, 42, OK, start=25600, end=END,
                   label="1, 3, 4, 5", label_size=15, radius=8))
    els.append(txt("c5b", 40, 884,
                   "B-tree 가 '못' 하는 게 아니라, B-tree 가 답할 수 있는 질문의 모양이 다른 것이다.",
                   15, INK, 27000, END, "600"))
    els.append(txt("c5c", 40, 910,
                   "n-gram 인덱스도 안쪽은 B-tree 다 — GIN 의 엔트리 트리가 바로 그것이다.",
                   15, MUTED, 28000, END))
    chapters.append({"id": "b5", "time": 23900, "label": "5. 집합 연산이 된다",
                     "subtitle": "포스팅 리스트의 교집합"})

    # --- 6장: 그런데 교집합은 '후보' 다 -------------------------------------
    els.append(txt("c6", 40, 962, "그런데 이 교집합은 '정답' 이 아니라 '후보' 다", 19, WARN, 30200, END, "700"))
    els.append(txt("c6b", 40, 990,
                   "조각을 다 가졌다고 원래 문자열이 있는 건 아니다 - 조각 집합은 순서를 잃는다",
                   15, MUTED, 30600, END))
    els.append(box("fp1", 40, 1012, 330, 40, PANEL, stroke=TRGM, start=31200, end=END,
                   label="'arterial triage' 의 조각", label_color=INK, label_size=14, radius=8))
    els.append(txt("fp2", 384, 1036, "tri · ria · ial 을 전부 갖고 있다", 14, MUTED, 31800, END))
    els.append(txt("fp3", 384, 1058, "그런데 'trial' 이라는 연속된 문자열은 없다", 14, TRGM, 32400, END, "600"))
    els.append(box("rc", 40, 1066, 330, 40, WARN, start=33200, end=END,
                   label="Recheck - 힙에서 원문을 다시 대본다", label_size=14, radius=8))
    els.append(txt("rc2", 384, 1090,
                   "후보만 읽으므로 테이블 전체를 훑는 것과 비용이 다르다", 14, MUTED, 33800, END))
    els.append(txt("rc3", 40, 1130,
                   "그래서 인덱스가 나쁠 때 나타나는 증상은 '틀린 결과' 가 아니라 '느림' 이다.",
                   15, INK, 34600, END, "600"))
    chapters.append({"id": "b6", "time": 29900, "label": "6. 교집합은 후보다",
                     "subtitle": "정확한 판정은 힙에서 — Recheck"})

    # 각 장의 요소를 **하나도 빠뜨리지 않아야** 한다 - 빠진 요소는 초점 밖으로 나가 잘린다.
    groups = [
        ["c1"] + [f"bt{i}" for i in range(5)] + ["btord"],
        ["c2", "c2b", "c2c", "c2d", "c2d2", "c2e", "c2e2", "hit1"] + [f"bt{i}" for i in range(5)],
        ["c3", "c3b", "c3b2", "c3c", "seq"] + [f"sc{i}" for i in range(4)] + [f"scl{i}" for i in range(4)],
        ["c4", "c4b", "c4c", "c4d", "c4e", "c4e2", "c4f", "c4f2"] + [f"iv{i}" for i in range(4)] + [f"ivp{i}" for i in range(4)],
        ["c5", "q1", "q2", "q3", "c5b", "c5c"],
        ["c6", "c6b", "fp1", "fp2", "fp3", "rc", "rc2", "rc3"],
    ]
    frames, focus = chapter_frames(els, chapters, groups, END, 1170)
    els = frames + els          # 틀을 맨 뒤(배경)에 깔아 둔다

    doc = {
        "clothoVersion": 1, "id": "btree-vs-inverted",
        "title": "B-tree 가 못 하는 일, 역인덱스가 하는 일",
        "description": "접두어는 정렬 순서의 연속 구간이라 풀리고, 부분 문자열은 아니다.",
        "duration": END,
        "canvas": {"width": 940, "height": 1170, "background": BG},
        "elements": els, "chapters": chapters,
        "camera": {"focus": focus, "strokeScaling": "fixed"},
        "settings": {"loop": False, "autoplay": True, "showChapterList": True},
    }
    return widen(doc, 170)


# ---------------------------------------------------------------------------
# 6) GIN 인덱스의 내부 구조
# ---------------------------------------------------------------------------
def doc_gin_structure():
    els, chapters = [], []
    END = 30000
    els.append(txt("t", 40, 42, "GIN 인덱스의 내부 구조", 22, INK, 0, END, "700"))
    els.append(txt("t2", 40, 70, "GIN = Generalized Inverted iNdex — '하나의 값이 여러 키를 만든다'는 상황을 위한 인덱스",
                   15, MUTED, 200, END))

    # 1장 - 한 행이 여러 키가 된다
    els.append(box("row", 40, 100, 400, 46, PANEL, stroke=DIM, start=600, end=END,
                   label="행 #7:  '클라우드클럽 스터디'", label_color=INK, label_size=17, radius=8))
    for i, k in enumerate(["␣클", "클라", "라우", "우드", "드클", "클럽"]):
        els.append(box(f"k{i}", 40 + i * 92, 162, 84, 38, BIGM, start=1200 + i * 220,
                       end=END, label=k, label_size=15, radius=6))
    els.append(txt("n1", 580, 130, "B-tree 는 행 하나 → 키 하나", 15, MUTED, 2600, END))
    els.append(txt("n1b", 580, 156, "GIN 은 행 하나 → 키 여러 개", 15, BIGM, 3000, END, "700"))
    chapters.append({"id": "s1", "time": 0, "label": "1. 행 하나가 키 여러 개",
                     "subtitle": "이 성질이 GIN 이 존재하는 이유다"})

    # 2장 - 엔트리 트리
    els.append(txt("c2", 40, 244, "① 엔트리 트리 — 키를 정렬해 담는 B-tree", 18, INK, 5000, END, "700"))
    els.append(box("root", 330, 266, 200, 40, PANEL, stroke=BIGM, start=5400, end=END,
                   label="루트", label_color=INK, label_size=15, radius=8))
    for i, k in enumerate(["␣클", "드클", "라우", "클라", "클럽"]):
        els.append(box(f"e{i}", 40 + i * 172, 330, 160, 40, BIGM, start=6000 + i * 300,
                       end=END, label=k, label_size=16, radius=8))
    els.append(txt("c2b", 40, 392,
                   "키가 정렬돼 있다 = 접두어 구간 탐색이 가능하다. pg_bigm 이 1글자 검색을 하는 근거가 여기다.",
                   15, MUTED, 7800, END))
    chapters.append({"id": "s2", "time": 4900, "label": "2. 엔트리 트리",
                     "subtitle": "키(조각)를 정렬해 담는 B-tree"})

    # 3장 - 포스팅 리스트 / 포스팅 트리
    els.append(txt("c3", 40, 440, "② 각 키가 가리키는 것 — 그 키를 가진 행들의 TID", 18, INK, 11000, END, "700"))
    els.append(box("pl", 40, 462, 300, 44, OK, start=11400, end=END,
                   label="포스팅 리스트 (압축 저장)", label_size=15, radius=8))
    els.append(txt("pln", 356, 478, "행이 적을 때 — 엔트리 옆에 바로 붙여 둔다", 14, MUTED, 11800, END))
    els.append(txt("pln2", 356, 500, "TID 를 varbyte 로 델타 압축한다 (PG 9.4+)", 14, MUTED, 12200, END))
    els.append(box("pt", 40, 520, 300, 44, WARN, start=13200, end=END,
                   label="포스팅 트리 (별도 B-tree)", label_size=15, radius=8))
    els.append(txt("ptn", 356, 536, "키가 너무 흔해 한 페이지에 안 들어갈 때 승격된다", 14, MUTED, 13600, END))
    els.append(txt("ptn2", 356, 558, "'영화' 같은 흔한 조각이 여기로 간다", 14, WARN, 14000, END))
    els.append(txt("c3b", 40, 596,
                   "인덱스 용량이 두 부분으로 나뉜다: 엔트리 트리 = 유니크 조각 수(고정비), 포스팅 = 총 조각 수(압축된 변동비)",
                   15, INK, 15200, END, "600"))
    chapters.append({"id": "s3", "time": 10900, "label": "3. 포스팅 리스트 / 트리",
                     "subtitle": "키 → 행 목록. 흔한 키는 트리로 승격된다"})

    # 4장 - 펜딩 리스트 (FASTUPDATE)
    els.append(txt("c4", 40, 644, "③ 펜딩 리스트 — GIN 의 쓰기가 느린 문제에 대한 답", 18, INK, 18000, END, "700"))
    els.append(box("ins", 40, 666, 200, 42, PANEL, stroke=DIM, start=18400, end=END,
                   label="INSERT 1건", label_color=INK, label_size=15, radius=8))
    els.append(txt("ar1", 254, 692, "→", 20, MUTED, 18800, END))
    els.append(box("pend", 286, 666, 240, 42, WARN, start=19000, end=END,
                   label="펜딩 리스트에 append", label_size=15, radius=8))
    els.append(txt("ar2", 540, 692, "→", 20, MUTED, 19600, END))
    els.append(box("flush", 572, 666, 300, 42, BIGM, start=19800, end=END,
                   label="나중에 한꺼번에 본체로 병합", label_size=15, radius=8))
    els.append(txt("c4b", 40, 736,
                   "행 하나가 키 수십 개를 만드니, 곧이곧대로 넣으면 트리를 수십 번 건드려야 한다 — 그래서 미뤄 모은다.",
                   15, MUTED, 20800, END))
    els.append(txt("c4c", 40, 762,
                   "대가: 검색할 때 펜딩 리스트는 순차 스캔된다. 실측 — FASTUPDATE 를 끄면 쓰기가 3~4배 느려진다.",
                   15, WARN, 21600, END, "600"))
    chapters.append({"id": "s4", "time": 17900, "label": "4. 펜딩 리스트",
                     "subtitle": "FASTUPDATE — 쓰기를 모아서 미룬다"})

    # 5장 - 검색 경로
    els.append(txt("c5", 40, 810, "④ 그래서 검색은 이렇게 흐른다", 18, INK, 24000, END, "700"))
    path = [("질의를 키로 분해", BIGM), ("엔트리 트리에서 각 키 찾기", BIGM),
            ("포스팅들을 비트맵으로 AND/OR", BIGM), ("힙에서 원문 읽기", WARN), ("Recheck", WARN)]
    for i, (lab, c) in enumerate(path):
        els.append(box(f"p{i}", 40 + i * 180, 834, 168, 44, c, start=24400 + i * 900,
                       end=END, label=lab, label_size=13, radius=8))
    els.append(txt("c5b", 40, 906,
                   "GIN 은 '어느 행이 후보인지'까지만 답한다. 정확한 판정은 힙에서 다시 한다 — 그게 Recheck 이다.",
                   15, INK, 28800, END, "600"))
    chapters.append({"id": "s5", "time": 23900, "label": "5. 검색 경로",
                     "subtitle": "GIN 은 후보까지, 판정은 힙에서"})

    # 장마다 그 장의 요소로 카메라를 옮긴다 - 세로로 긴 그림이라 한 화면에 다 두면
    # 어느 부분을 보라는 건지 알 수 없다.
    groups = [
        ["row"] + [f"k{i}" for i in range(6)] + ["n1", "n1b"],
        ["c2", "root"] + [f"e{i}" for i in range(5)] + ["c2b"],
        ["c3", "pl", "pln", "pln2", "pt", "ptn", "ptn2", "c3b"],
        ["c4", "ins", "pend", "flush", "c4b", "c4c"],
        ["c5"] + [f"p{i}" for i in range(5)] + ["c5b"],
    ]
    frames, focus = chapter_frames(els, chapters, groups, END, 940)
    els = frames + els          # 틀을 맨 뒤(배경)에 깔아 둔다

    doc = {
        "clothoVersion": 1, "id": "gin-structure",
        "title": "GIN 인덱스의 내부 구조",
        "description": "엔트리 트리 · 포스팅 리스트/트리 · 펜딩 리스트, 그리고 검색 경로.",
        "duration": END,
        "canvas": {"width": 940, "height": 940, "background": BG},
        "elements": els, "chapters": chapters,
        "camera": {"focus": focus, "strokeScaling": "fixed"},
        "settings": {"loop": False, "autoplay": True, "showChapterList": True},
    }
    return widen(doc, 170)


# ---------------------------------------------------------------------------
# 7) 유사도 — bigm_similarity() vs similarity() 는 같은 자가 아니다
# ---------------------------------------------------------------------------
def doc_similarity():
    els, chapters = [], []
    END = 34000
    els.append(txt("t", 40, 42, "유사도 — 두 확장은 다른 자로 잰다", 22, INK, 0, END, "700"))
    els.append(box("pair", 40, 74, 380, 48, PANEL, stroke=DIM, start=300, end=END,
                   label="'클둥이'  vs  '클동이'   (한 글자 오타)", label_color=INK,
                   label_size=17, radius=10))
    els.append(txt("pn", 436, 104, "사람 눈에는 거의 같은 말이다", 15, MUTED, 900, END))
    chapters.append({"id": "m0", "time": 0, "label": "1. 같은 입력",
                     "subtitle": "'클둥이' vs '클동이' — 가운데 한 글자만 다르다"})

    # --- 2장: 조각을 낸다 ---------------------------------------------------
    els.append(txt("bl", 40, 172, "pg_bigm — 2-gram", 18, BIGM, 3000, END, "700"))
    a2 = ["␣클", "클둥", "둥이", "이␣"]
    b2 = ["␣클", "클동", "동이", "이␣"]
    same2 = {0, 3}
    for i, g in enumerate(a2):
        els.append(box(f"a2_{i}", 40 + i * 100, 194, 92, 42, BIGM if i in same2 else DIM,
                       start=3200 + i * 260, end=END, label=g, label_size=16, radius=8,
                       label_color=ON_FILL if i in same2 else INK))
    for i, g in enumerate(b2):
        els.append(box(f"b2_{i}", 40 + i * 100, 244, 92, 42, BIGM if i in same2 else DIM,
                       start=4400 + i * 260, end=END, label=g, label_size=16, radius=8,
                       label_color=ON_FILL if i in same2 else INK))
    els.append(txt("bcount", 452, 226, "겹치는 조각 2개 / 각각 4개", 16, BIGM, 5800, END, "600"))

    els.append(txt("tl", 40, 316, "pg_trgm — 3-gram", 18, TRGM, 8000, END, "700"))
    a3 = ["␣␣클", "␣클둥", "클둥이", "둥이␣"]
    b3 = ["␣␣클", "␣클동", "클동이", "동이␣"]
    same3 = {0}
    for i, g in enumerate(a3):
        els.append(box(f"a3_{i}", 40 + i * 100, 338, 92, 42, TRGM if i in same3 else DIM,
                       start=8200 + i * 260, end=END, label=g, label_size=15, radius=8,
                       label_color=ON_FILL if i in same3 else INK))
    for i, g in enumerate(b3):
        els.append(box(f"b3_{i}", 40 + i * 100, 388, 92, 42, TRGM if i in same3 else DIM,
                       start=9400 + i * 260, end=END, label=g, label_size=15, radius=8,
                       label_color=ON_FILL if i in same3 else INK))
    els.append(txt("tcount", 452, 370, "겹치는 조각 1개 / 각각 4개", 16, TRGM, 10800, END, "600"))
    els.append(txt("why", 40, 452,
                   "한 글자가 틀어지면 2-gram 은 조각 2개가, 3-gram 은 조각 3개가 깨진다 — n 이 클수록 오타에 약하다.",
                   15, WARN, 12000, END, "600"))
    chapters.append({"id": "m1", "time": 2900, "label": "2. 조각을 낸다",
                     "subtitle": "오타 한 글자가 깨뜨리는 조각 수가 다르다"})

    # --- 3장: 공식이 다르다 -------------------------------------------------
    els.append(txt("c3", 40, 512, "그리고 공식 자체가 다르다", 19, INK, 15000, END, "700"))
    els.append(box("f1", 40, 536, 400, 52, BIGM, start=15400, end=END,
                   label="bigm:  겹친 수 / max(조각수)", label_size=16, radius=10))
    els.append(txt("f1n", 456, 556, "'긴 쪽을 기준으로 몇 % 를 덮었나'", 15, MUTED, 16000, END))
    els.append(txt("f1v", 456, 580, "2 / 4 = 0.5000", 18, BIGM, 16600, END, "700"))
    els.append(box("f2", 40, 602, 400, 52, TRGM, start=18000, end=END,
                   label="trgm:  겹친 수 / (합집합 크기)", label_size=16, radius=10))
    els.append(txt("f2n", 456, 622, "자카드 유사도 — 합집합으로 나눈다", 15, MUTED, 18600, END))
    els.append(txt("f2v", 456, 646, "1 / (4+4-1) = 0.1429", 18, TRGM, 19200, END, "700"))
    els.append(txt("c3b", 40, 690,
                   "분모가 다르다. trgm 은 안 겹친 조각까지 분모에 넣으므로 같은 상황에서 점수가 더 낮게 나온다.",
                   15, INK, 20400, END, "600"))
    chapters.append({"id": "m2", "time": 14900, "label": "3. 공식이 다르다",
                     "subtitle": "max 로 나누느냐, 합집합으로 나누느냐"})

    # --- 4장: 임계값이 같은 게 함정 -----------------------------------------
    els.append(txt("c4", 40, 742, "그런데 기본 임계값은 둘 다 0.3 이다", 19, WARN, 23000, END, "700"))
    els.append(box("th1", 40, 766, 400, 44, BIGM, start=23400, end=END,
                   label="0.5000  ≥  0.3   →  매칭된다", label_size=16, radius=8))
    els.append(box("th2", 40, 818, 400, 44, TRGM, start=24600, end=END,
                   label="0.1429  <  0.3   →  탈락한다", label_size=16, radius=8))
    els.append(txt("c4b", 456, 796,
                   "같은 오타, 같은 임계값, 반대 결과", 17, WARN, 25600, END, "700"))
    els.append(txt("c4c", 40, 890,
                   "임계값 0.3 을 pg_bigm 에서 pg_trgm 으로 그대로 옮기면 안 된다 — 재는 자가 다르다.",
                   15, WARN, 26600, END, "600"))
    chapters.append({"id": "m3", "time": 22900, "label": "4. 임계값의 함정",
                     "subtitle": "우연히 둘 다 0.3 이지만 뜻이 다르다"})

    # --- 5장: 실측 표 -------------------------------------------------------
    els.append(txt("c5", 40, 940, "실측 (bigm-vs-trgm/experiments/03)", 18, INK, 29000, END, "700"))
    table = [
        ("신건 → 신컨",              "0.3333", "0.2000", BIGM),
        ("김신건 → 김신컨",          "0.5000", "0.3333", BIGM),
        ("클둥이 → 클동이",          "0.5000", "0.1429", TRGM),
        ("클라우드클럽 → 클라으드클럽", "0.7143", "0.4000", BIGM),
        ("CloudClub → cloudclub",    "0.6667", "1.0000", TRGM),
    ]
    els.append(txt("h1", 40, 972, "입력", 14, MUTED, 29200, END, "600"))
    els.append(txt("h2", 360, 972, "bigm_similarity()", 14, BIGM, 29200, END, "600"))
    els.append(txt("h3", 540, 972, "similarity()", 14, TRGM, 29200, END, "600"))
    for i, (a, b, c, hi) in enumerate(table):
        st = 29500 + i * 500
        y = 996 + i * 34
        els.append(txt(f"t{i}a", 40, y, a, 15, INK, st, END))
        els.append(txt(f"t{i}b", 360, y, b, 15, BIGM, st + 120, END, "700"))
        els.append(txt(f"t{i}c", 540, y, c, 15, TRGM, st + 200, END, "700"))
    els.append(txt("c5b", 40, 1188,
                   "마지막 줄이 중요하다 — 대소문자만 다르면 trgm 은 1.0 이다(IGNORECASE). pg_bigm 은 대소문자를 구분한다.",
                   15, MUTED, 32400, END))
    chapters.append({"id": "m4", "time": 28900, "label": "5. 실측",
                     "subtitle": "bigm 이 1.1~3.5배 높은 점수를 준다"})

    return {
        "clothoVersion": 1, "id": "similarity-compare",
        "title": "유사도 — bigm_similarity() vs similarity()",
        "description": "같은 오타에 0.5 와 0.1429. 분모가 다르고, 임계값 0.3 은 옮길 수 없다.",
        "duration": END,
        "canvas": {"width": 940, "height": 1220, "background": BG},
        "elements": els, "chapters": chapters,
        "settings": {"loop": False, "autoplay": True, "showChapterList": True},
    }


DOCS = {
    "ngram-slice": doc_ngram_slice,
    "two-char-trap": doc_two_char_trap,
    "gin-pipeline": doc_gin_pipeline,
    "lexeme-vs-ngram": doc_lexeme_vs_ngram,
    "btree-vs-inverted": doc_btree_vs_inverted,
    "gin-structure": doc_gin_structure,
    "similarity-compare": doc_similarity,
}


def load_schema():
    if os.path.exists(SCHEMA_CACHE):
        return json.load(open(SCHEMA_CACHE))
    with urllib.request.urlopen(SCHEMA_URL, timeout=30) as r:
        s = json.loads(r.read().decode())
    json.dump(s, open(SCHEMA_CACHE, "w"))
    return s


def ident(name: str) -> str:
    """파일 이름을 자바스크립트 식별자로. two-char-trap -> twoCharTrap"""
    head, *rest = name.split("-")
    return head + "".join(w.capitalize() for w in rest)


def main():
    check_only = "--check" in sys.argv
    try:
        import jsonschema
        schema = load_schema()
    except Exception as e:                                    # 오프라인이면 검증을 건너뛴다
        print(f"  (스키마 검증 생략: {e})")
        schema = None

    ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")   # 스키마의 id 패턴 (대문자 불가)

    def check_bounds(name, doc):
        """캔버스 밖으로 나간 요소를 잡는다. 스키마는 좌표를 검사하지 않으므로
        음수 x 나 캔버스 아래로 삐져나온 상자는 조용히 잘려 보이지 않게 된다."""
        W = doc["canvas"]["width"]; H = doc["canvas"]["height"]
        bad = []
        for el in doc["elements"]:
            x, y = el.get("x", 0), el.get("y", 0)
            w = el.get("width", 0); h = el.get("height", 0)
            if el["type"] == "text":
                # 텍스트는 width 가 없으므로 대략 잡는다. 한글은 폰트 크기만큼,
                # ASCII 는 그 0.55 배쯤 차지한다 - 넉넉히 잡아 오탐을 줄인다.
                c = el.get("content", "")
                han = sum(1 for ch in c if ord(ch) > 0x2000)
                w = int(el.get("fontSize", 16) * (han + (len(c) - han) * 0.55))
                if el.get("textAnchor") == "middle":
                    x -= w // 2
                elif el.get("textAnchor") == "end":
                    x -= w
            if x < 0 or y < 0 or x + w > W or y + h > H:
                bad.append(f'{el["id"]}({x},{y},{w}x{h})')
        return bad

    built = {}
    for name, fn in DOCS.items():
        doc = fn()
        for el in doc["elements"]:
            if not ID_RE.match(el["id"]):
                print(f"  ✘ {name}: id '{el['id']}' 가 ^[a-z0-9][a-z0-9_-]*$ 에 맞지 않는다")
                sys.exit(1)
        if schema:
            import jsonschema
            try:
                jsonschema.validate(doc, schema)
                print(f"  ✔ {name:18s} 스키마 통과  ({len(doc['elements'])} elements, {doc['duration']}ms)")
            except jsonschema.ValidationError as e:
                print(f"  ✘ {name}: {e.message}\n      at {list(e.absolute_path)}")
                sys.exit(1)
        oob = check_bounds(name, doc)
        if oob:
            print(f"  ⚠ {name}: 캔버스({doc['canvas']['width']}x{doc['canvas']['height']}) 밖 요소 → {', '.join(oob)}")
        built[name] = doc
        if not check_only:
            with open(os.path.join(HERE, f"{name}.json"), "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, indent=1)

    if check_only:
        return

    # 문서 목록을 TS 로 내보낸다. 웹 앱은 JSON 을 Vite 로 직접 import 하므로
    # 예전처럼 window.CLOTHO_DOCS 인라인 번들을 만들 필요가 없다.
    lines = ["// 이 파일은 build.py 가 생성한다. 직접 고치지 말 것.",
             "import { parseDocumentOrThrow } from '@kokoa/clotho'"]
    for name in DOCS:
        lines.append(f"import {ident(name)} from './{name}.json'")
    lines.append("")
    lines.append("/** 애니메이션 id → 파싱된 clotho 문서. 새 문서는 build.py 에 등록하면 여기에 자동으로 실린다. */")
    lines.append("export const ANIMATIONS = {")
    for name in DOCS:
        lines.append(f"  '{name}': parseDocumentOrThrow({ident(name)}),")
    lines.append("} as const")
    lines.append("")
    lines.append("export type AnimationId = keyof typeof ANIMATIONS")
    lines.append("")
    out = "\n".join(lines)
    with open(os.path.join(HERE, "index.ts"), "w", encoding="utf-8") as f:
        f.write(out)
    print(f"  → index.ts 갱신 ({len(DOCS)}개 문서)")


if __name__ == "__main__":
    main()

---
marp: true
theme: default
paginate: true
size: 16:9
header: 'PG Extension Study - 실습 안내'
footer: '14개 lab 상세 설명'
style: |
  section { font-size: 22px; }
  /* Pretendard 를 우선 사용한다.
     로컬에 설치되어 있으면 그것을, 없으면 CDN 웹폰트를 쓴다. */
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
  section {
    font-family: "Pretendard", "Pretendard Variable", -apple-system,
                 "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif;
  }
  /* 코드 블록의 아스키 그림(+---+ 박스 등)이 어긋나지 않으려면 한글 글자 폭이
     로마자의 정확히 2배인 고정폭 글꼴이 필요하다. 브라우저 기본 monospace 는
     한글을 다른 글꼴로 대체해 그 비율이 깨진다. Nanum Gothic Coding 은
     로마자·한글 모두 담고 있고 폭 비율이 1:2 라 박스가 그대로 맞는다. */
  @import url('https://fonts.googleapis.com/css2?family=Nanum+Gothic+Coding&display=swap');
  code, pre, pre code {
    font-family: "Nanum Gothic Coding", "D2Coding", "SFMono-Regular", Menlo,
                 Consolas, "Noto Sans Mono CJK KR", monospace;
  }
  /* ── 제목 영역을 상단에 고정, 그 아래를 콘텐츠 영역으로 ── */
  section {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;     /* Marp 기본은 세로 중앙 정렬이라 제목이 흔들린다 */
  }
  section > h2:first-of-type {
    flex: 0 0 auto;
    min-height: 40px;                /* 제목이 1줄이든 2줄이든 본문 시작 위치를 고정 */
    display: flex;
    align-items: flex-end;
    margin: 0 0 12px;
  }
  section.lead { justify-content: center; text-align: center; }
  section.lead > h2:first-of-type { display: block; min-height: 0; }
  /* 장 구분·표지 슬라이드에서는 제목 밑줄을 빼서 여백을 살린다 */
  section.lead h2 { border-bottom: none; padding-bottom: 0; }

  h1 { color: #1d4ed8; }
  h2 { color: #1d4ed8; border-bottom: 2px solid #2563eb; padding-bottom: 4px; }
  h3 { color: #1e3a8a; margin-bottom: 8px; }
  code { font-size: 0.88em; }
  pre { font-size: 0.64em; line-height: 1.28; padding: 6px 10px; }
  /* 표가 내용에 맞춰 좁게 잡혀서, 슬라이드 절반이 비는데도 셀 안에서 줄바꿈이 났다.
     원인: section 이 flex 컨테이너인데 display:table 인 요소는 늘어나지 않는다.
     width:100% 로는 해결되지 않고 align-self:stretch 가 필요하다. */
  table {
    font-size: 0.76em;
    /* Marp 기본 테마가 table 에 display:block + width:max-content 를 걸어둔다.
       그대로 두면 표가 내용 폭(약 636px)에 맞춰 좁게 잡혀서, 슬라이드 절반이
       비어 있는데도 셀 안에서 줄바꿈이 난다. PDF/PNG 출력에서 특히 그렇다.
       display 와 width 를 되돌려야 폭을 꽉 채운다. */
    display: table !important;
    width: 100% !important;
    align-self: stretch;
  }
  th, td { word-break: keep-all; }   /* 한글 단어 중간에서 끊기지 않게 */
  /* --- 표: Cloud Club 팔레트 --- */
  th {
    background: #eff6ff;             /* blue-50 */
    color: #1e3a8a;                  /* blue-900 */
    border-bottom: 2px solid #2563eb;
  }
  td { border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f8fafc; }
  /* 굵은 글씨를 전부 파랗게 하면 강조가 오히려 죽는다.
     파랑은 제목·표 머리·인용 막대 같은 "구조"에만 쓰고, 강조는 진한 먹색으로 둔다. */
  strong { color: #0f172a; }
  blockquote strong { color: #1e3a8a; }
  /* 인라인 코드는 아주 옅은 회청색 배경 위에 */
  code { background: #f1f5f9; color: #1e3a8a; padding: 1px 4px; border-radius: 3px; }
  pre code { background: none; color: inherit; padding: 0; }
  pre { background: #f8fafc; border-left: 3px solid #93c5fd; }
  /* 머리말·꼬리말·쪽번호 */
  header, footer { color: #94a3b8; }
  section::after { color: #2563eb; font-weight: 600; }
  blockquote { border-left: 4px solid #60a5fa; background: #f8fafc; padding: 6px 12px; color: #334155; }
  p, ul, ol, table, pre, blockquote { margin-top: 0; margin-bottom: 9px; }
  li { margin-bottom: 4px; }
  .small { font-size: 0.78em; }

  /* ── 장 구분 슬라이드의 목차 ── */
  section.lead .agenda {
    /* flex 자식은 inline-block 이 블록으로 바뀌어 폭을 꽉 채운다.
       align-self 로 내용 폭에 맞춰 가운데 정렬한다. */
    align-self: center;
    text-align: left;
    font-size: 0.82em;
    line-height: 1.75;
    color: #444;
    margin: 6px 0 0;
    padding: 14px 26px;
    border-left: 3px solid #93c5fd;
  }
  section.lead .agenda p { margin: 0; }
  section.lead .toc {
    font-size: 0.6em;
    color: #94a3b8;
    line-height: 1.8;
    margin-top: 22px;
    letter-spacing: -0.01em;
  }
  section.lead .toc b { color: #2563eb; }

  /* 다이어그램은 남은 콘텐츠 영역을 꽉 채우되 넘치지 않게 */
  section img { display: block; margin: 0 auto; max-width: 100%; max-height: 100%; }
  section p:has(> img:only-child) { flex: 1 1 auto; min-height: 0; margin-bottom: 0; }
  section p:has(> img:only-child) img { height: 100%; object-fit: contain; }
---

<!-- _class: lead -->

# 🧪 실습 안내

## 14개 lab, 무엇을 어떻게 돌리나

<br>

**PG Extension Study - 실습 상세**

<span class="small">본편은 `slides.md` · 이 자료는 lab 별 설명입니다</span>

---

## 이 자료를 보는 법

본편(`slides.md`)에서 **📦 labNN** 표시를 만나면 여기서 해당 lab 을 찾아보세요.

| | |
|---|---|
| **본편** (`slides.md`) | 개념을 설명하고, 필요한 출력만 잘라서 보여줍니다. 직접 돌리는 실습은 **lab00~lab03** |
| **이 자료** | 각 lab 이 **무엇을 하고 · 무엇을 봐야 하고 · 왜 그렇게 만들었는지** |

<br>

**공통 사항**

- 필요한 건 **Docker 뿐**입니다. PostgreSQL 을 로컬에 설치할 필요 없습니다
- 각 lab 은 **완전히 독립적**입니다. 포트가 달라(15400~15413) 동시에 띄워도 됩니다
- 대부분 **10초 이내**에 끝납니다 (이미지가 빌드된 뒤 기준)

---

## 공통 실행 방법

```bash
$ cd labs/00-hello-extension
$ ./run.sh
```

이 한 줄이 **이미지 빌드 → 컨테이너 기동 → 스크립트 순차 실행**을 전부 합니다.

| 명령 | 하는 일 |
|---|---|
| `./run.sh` | 빌드 → 기동 → `sql/` 전부 실행 |
| `./run.sh 03` | `03` 으로 시작하는 스크립트만 |

<span class="small">`psql`·`shell`·`sql`·`<번호>` 는 컨테이너가 안 떠 있으면 **알아서 먼저 띄웁니다.** 명령 하나만 쳐도 됩니다.</span>
| `./run.sh psql` | psql 접속해서 직접 만져보기 |
| `./run.sh shell` | 컨테이너 안 파일 시스템 탐색 |
| `./run.sh logs` | 서버 로그 follow |
| `./run.sh down` | 컨테이너 + 볼륨 삭제 (처음부터 다시) |

<span class="small">`run.sh` 는 14개 lab 이 전부 같은 파일입니다. lab 을 새로 만들 때 복사해 쓰면 됩니다.</span>

---

## 직접 쳐보며 진행하기 - `HANDS-ON.md`

`./run.sh` 는 **흘려보는** 방식입니다. 실제로 손에 남기려면 직접 쳐보세요.

```bash
$ ./run.sh up        # 컨테이너만 기동 (스크립트는 실행 안 함)
$ ./run.sh psql      # study=#  프롬프트
```

lab 마다 **`HANDS-ON.md`** 가 하나씩 있습니다. 에디터로 열어두고 한 블록씩 붙여넣으면 됩니다.

| | |
|---|---|
| 구성 | **무엇을 볼 것인지 → 칠 명령 → 왜 그런지** 순서 |
| ` ```sql ` | 그대로 실행되는 블록 |
| ` ```sql expect-error ` | **일부러 실패하는** 블록 - 진짜 에러 메시지를 보게 됩니다 |
| 되돌리기 | `./run.sh down && ./run.sh up` |

<span class="small">자동 스크립트는 실패를 `DO ... EXCEPTION` 으로 감싸 NOTICE 로 바꿔놓습니다. 직접 치면 **PostgreSQL 이 실제로 내는 에러**를 봅니다 - 그게 이 방식의 요점입니다.</span>

---

## psql 안에서 자주 쓰는 것

| 명령 | 하는 일 |
|---|---|
| `\dx` / `\dx+ <이름>` | 설치된 extension / 그 extension 이 만든 객체 전부 |
| `\df <패턴>` / `\d <테이블>` | 함수 목록 / 테이블 구조 |
| `\timing on` | 쿼리 실행 시간 표시 |
| `\! <명령>` | **컨테이너 안에서** 쉘 명령 실행 |
| `\i <파일>` / `\x` / `\q` | SQL 파일 실행 / 세로 출력 / 나가기 |

<br>

`\!` 가 컨테이너 안에서 도는 덕분에 **`pg_config`, `ls $SHAREDIR/extension/`, `pg_dump` 를 psql 을 벗어나지 않고** 그대로 쓸 수 있습니다. lab 마다 자주 씁니다.

---

## 전체 지도 - 1부

<div class="small">

| Lab | 주제 | 무엇을 알게 되나 | 포트 |
|---|---|---|---|
| `lab00` | 가장 간단한 extension | 텍스트 파일 2개면 된다 · `old_hello` 와 비교 | 15400 |
| `lab01` | CREATE EXTENSION 내부 | 카탈로그 · `pg_depend` · 버전 · trusted | 15401 |
| `lab02` | SQL-only + PGXS | 업그레이드 스크립트 · `pg_dump` 연동 | 15402 |
| `lab03` | C extension | 직접 컴파일 · 호출 규약 · GUC · SPI | 15403 |

</div>

---

## 전체 지도 - 2부

<div class="small">

| Lab | 분류 | 대표 extension | 로딩 | 포트 |
|---|---|---|---|---|
| `lab04` | (a) 함수 추가 | pgcrypto · tablefunc | 자동 | 15404 |
| `lab05` | (b) 타입 추가 | hstore · citext · ltree | 자동 | 15405 |
| `lab06` | (c) 연산자 클래스 | pg_trgm · btree_gist | 자동 | 15406 |
| `lab07` | (d) Hook + 공유메모리 | pg_stat_statements | **SPL** | 15407 |
| `lab08` | (e) 모듈 (extension 아님) | auto_explain | **SPL** | 15408 |
| `lab09` | (f) Background Worker | pg_cron | **SPL** | 15409 |
| `lab10` | (g) FDW | postgres_fdw · file_fdw | 자동 | 15410 |
| `lab11` | (h) 내부 노출 | pageinspect · pgstattuple | 자동 | 15411 |
| `lab12` | (i) 인덱스 AM | bloom | 자동 | 15412 |
| `lab13` | (j) 절차적 언어 | PL/Python · PL/Perl | 자동 | 15413 |

</div>

<span class="small">**SPL** = `shared_preload_libraries` 필요 · 이 2부는 본편의 **부록 C** 에 대응하는 부가 자료입니다 · pgvector · PostGIS 는 해당 회차에 별도 lab 으로</span>

---

<!-- _class: lead -->

# 1부 - Extension 시스템 이해하기

## lab00 ~ lab03

<div class="agenda">

- **lab00** 텍스트 파일 두 개로 extension 만들기
- **lab01** `CREATE EXTENSION` 이 카탈로그에 하는 일
- **lab02** PGXS 로 제대로 빌드하고 배포 가능하게
- **lab03** C 로 짜서 `.so` 만들기

</div>

---

## lab00 - 가장 간단한 extension

**목적:** "extension 이란 결국 텍스트 파일 두 개" 라는 감각을 잡습니다. **7초.**

이 lab 의 Dockerfile 은 **아무것도 설치하지 않습니다.** 공식 postgres 이미지 그대로입니다.

| 스크립트 | 하는 일 |
|---|---|
| `00-the-old-way.sql` | 9.1 이전 방식으로 `old_hello()` 를 먼저 만든다 |
| `01-build-from-scratch.sql` | control 파일 + SQL 파일을 **psql 안에서 직접 만들어** 설치 |
| `02-add-a-version.sql` | 업그레이드 스크립트 + `default_version` |
| `03-package-it.sql` | PGXS Makefile 4줄로 배포용 정리 |
| `04-compare.sql` | **`old_hello` vs `hello` 대조표** |

> **설계 의도:** 같은 일을 하는 함수를 **두 방식으로** 만들어 놓고 끝에서 비교합니다. "extension 이 왜 필요한가"에 대한 가장 짧은 답이 그 대조표입니다.

---

## lab00 - 무엇을 봐야 하나

```console
--- 소속 도장이 자동으로 찍힌다 ---
 함수  | 소속  | deptype
-------+-------+---------
 hello | hello | e

study=# DROP FUNCTION hello(text);
ERROR:  cannot drop function hello(text) because extension hello requires it
```

**`hello--1.0.sql` 안에는 그냥 `CREATE FUNCTION` 만 썼습니다.** 소속은 PostgreSQL 이 붙인 것입니다.

```console
           항목           |  old_hello (옛날)   |     hello (extension)
--------------------------+---------------------+---------------------------
 pg_depend 소속 기록      | 0 건                | 2 건
 함수 하나만 DROP 하면    | 그냥 지워짐         | 거부됨
 pg_dump 결과             | 함수 본문이 통째로  | CREATE EXTENSION 한 줄
```

> ⚠️ Dockerfile 에 `chmod 777` 이 있습니다. **psql 에서 파일을 직접 만들어보는 실습 전용**입니다. 운영에서는 절대 이렇게 하지 마세요.

---

## lab01 - CREATE EXTENSION 내부 동작

**목적:** 카탈로그에 무슨 일이 일어나는지 직접 확인합니다.

| 스크립트 | 하는 일 |
|---|---|
| `00-the-old-way.sql` | **실제 contrib(hstore)를 9.1 이전 방식으로 설치** - 함수 57개 |
| `01-before-after.sql` | extension 이 없던 시절 vs 지금 |
| `02-filesystem.sql` | `.control` + `.sql` (+`.so`) 파일 3종 |
| `03-catalog.sql` | `pg_extension` 레코드 · 소속 객체 세기 |
| `04-pg-depend.sql` | **`deptype='e'` 가 멤버십의 실체** |
| `05-version.sql` | BFS 업그레이드 경로 (`pg_extension_update_paths`) |
| `06-cascade-schema.sql` | `requires` · `CASCADE` · 전용 스키마 · **trusted** |

> `00-the-old-way.sql` 은 지금의 `hstore--1.4.sql` 에서 **안전장치 두 줄만 걷어내** 실행합니다. 그게 곧 옛날 `contrib/hstore.sql` 입니다.

---

## lab01 - 무엇을 봐야 하나

```console
--- 옛날 방식으로 깔면 ---
 hstore 가 만든 함수 수 |  소속이 기록된 객체 수
------------------------+------------------------
                     57 |                      0        ← 추적 불가

$ pg_dump study | grep -c "^CREATE FUNCTION"
57                                                       ← 백업에 57개가 박제

study=# DROP TYPE hstore;
ERROR:  cannot drop type hstore because other objects depend on it  (78개)
```

```console
--- 업그레이드 경로는 계산된다 (파일이 없어도) ---
 source | target |          path
--------+--------+-------------------------
 1.4    | 1.8    | 1.4--1.5--1.6--1.7--1.8

--- trusted 면 일반 유저도 설치 가능 ---
NOTICE:  citext      (trusted=true)  -> 설치 성공
NOTICE:  pageinspect -> permission denied to create extension "pageinspect"
```

---

## lab02 - PGXS 로 제대로 만들기

**목적:** lab00 에서 손으로 복사하던 것을 **배포 가능한 형태**로 만듭니다.

```
ext/
├── greetkor.control        # 메타데이터
├── greetkor--1.0.sql       # 설치 스크립트
├── greetkor--1.0--1.1.sql  # 업그레이드 스크립트
└── Makefile                # PGXS - 사실상 4줄
```

Dockerfile 이 빌드 시점에 `make install` 을 돌려 이미지에 심습니다.

**하이라이트 - `pg_dump` 가 무엇을 덤프하나**

```console
CREATE EXTENSION IF NOT EXISTS greetkor WITH SCHEMA public;
COPY public.greetkor_config (key, value) FROM stdin;
locale	ko_KR
```

> **함수 정의는 한 글자도 안 나옵니다.** 대신 `pg_extension_config_dump()` 로 등록한 **설정 테이블의 데이터는** 덤프됩니다. PostGIS 의 `spatial_ref_sys` 와 같은 메커니즘입니다.

---

## lab03 - C extension 직접 컴파일

**목적:** C extension 이 지켜야 하는 계약을 하나씩 확인합니다. `myext` 의 함수 5개는 **기능이 아니라 확인 항목**입니다.

<div class="small">

| 함수 | 이걸로 보는 것 | 확인 | 스크립트 |
|---|---|---|---|
| `myext_add` | V1 호출 규약 · 오버플로는 작성자 책임 | `myext_add(2147483647,1)` → wrap | `02-call-convention` |
| `myext_hello` | varlena · `palloc` · 백엔드 `pid` | 세션마다 `pid` 가 다름 | `02-call-convention` |
| `myext_double_or_zero` | `STRICT` 없이 NULL 이 C 까지 | `(NULL)` → `0` | `02-call-convention` |
| `myext_shout` | GUC - `_PG_init()` 이 등록 | `SET myext.repeat_count=5` | `03-guc` |
| `myext_count_rows` | SPI - C 안에서 SQL 실행 | 없는 테이블 → 크래시 아닌 ERROR | `04-spi` |

</div>

여기에 `01-load.sql`(**`.so` 로딩은 세션마다**)과 `05-cost.sql`(C vs SQL vs PL/pgSQL 실측)이 더해집니다.

<span class="small">고쳐가며 실험하려면 빌드 도구가 든 dev 컨테이너 - `docker compose --profile dev up -d`</span>

---

## lab03 - 무엇을 봐야 하나

```console
$ nm -D --defined-only myext.so          # 12개 중 발췌
T myext_add             ← 내가 짠 함수
T pg_finfo_myext_add    ← PG_FUNCTION_INFO_V1 이 자동 생성
T _PG_init              ← 로드 시 자동 호출
T Pg_magic_func         ← PG_MODULE_MAGIC. ABI 검사
```

**함수 5개를 썼는데 심볼은 12개** - 함수마다 `pg_finfo_*` 가 붙습니다.

```console
--- 새 세션에서 곧바로 GUC 를 조회하면 ---
ERROR:  unrecognized configuration parameter "myext.repeat_count"
--- 같은 세션에서 함수를 먼저 호출하면 ---
 3
```

| 구현 | 100만 번 호출 |
|---|---|
| C extension | 117 ms |
| `LANGUAGE sql` | 115 ms |
| `LANGUAGE plpgsql` | 404 ms |

> **단순 연산이면 SQL 함수가 C 만큼 빠릅니다.** 속도만 보고 C 로 갈 이유는 없습니다. <span class="small">(한 장비 기준 - 절대값보다 순위)</span>

---

<!-- _class: lead -->

# 2부 - 열 가지 확장 원리

## lab04 ~ lab13 · 부가 자료

<div class="agenda">

- 본편(`slides.md`)의 **부록 C** 에 대응합니다 - 필요한 것만 골라 보면 됩니다
- extension 이 PostgreSQL 을 **확장하는 방식**을 하나씩 실행해봅니다
- lab04·05·06·10·13 의 `01-*.sql` 은 **같은 카탈로그 쿼리**로 시작합니다 - 부류 판별법<br>(lab07·08·09 는 그 쿼리로 정체를 알 수 없는 부류, lab11·12 는 변형해 씁니다)
- Week 2 이후 각자 확장을 고를 때의 **지도**입니다

</div>

---

## lab04 - (a) 함수를 추가하는 extension

**가장 단순한 부류.** C 로 짠 함수를 SQL 함수로 노출하기만 합니다.

```console
   extname    | 함수 | 타입 | 연산자 | 연산자클래스 | 인덱스AM
--------------+------+------+--------+--------------+----------
 pgcrypto     |   36 |    0 |      0 |            0 |        0
 tablefunc    |   11 |    3 |      0 |            0 |        0
```

**연산자클래스·인덱스AM 이 0** 이면 이 부류입니다. <span class="small">tablefunc 의 타입 3개는 `crosstab` 의 결과 행 모양일 뿐입니다.</span>

| 다루는 것 | 짚는 실무 포인트 |
|---|---|
| `pgcrypto` bcrypt · HMAC · PGP | 암호화 키를 SQL 에 쓰면 `pg_stat_statements` 와 로그에 남는다 |
| `tablefunc` crosstab | **컬럼이 고정이면 `FILTER` 절이 더 낫다** - 같은 결과를 나란히 비교 |
| `fuzzystrmatch` levenshtein | soundex/metaphone 은 **영어 전용** · 이 함수들은 **인덱스를 못 탄다** |

---

## lab05 - (b) 타입을 추가하는 extension

타입 하나를 추가하려면 `typinput`/`typoutput` 등을 C 로 구현해야 합니다. 그래서 **타입 컬럼에 숫자가 있으면** 이 부류입니다.

**이 lab 의 관점: "이 타입이 정말 필요한가?"** 각 타입마다 **extension 없이 하는 방법**을 나란히 놓고 비교합니다.

| 타입 | 대안 |
|---|---|
| `hstore` | **`jsonb`** - 신규 프로젝트면 대개 이쪽 |
| `citext` | `lower()` 저장 · 표현식 유니크 인덱스 - 셋 다 정답이 될 수 있음 |
| `ltree` | `parent_id` · 경로 문자열 · 클로저 테이블 |
| `cube`+`earthdistance` | PostGIS (무겁지만 정확) |

> **`earthdistance` 는 `requires = cube`** - extension 이 extension 위에 세워지는 예입니다. `ll_to_earth(위도, 경도)` 는 PostGIS 의 `ST_Point(경도, 위도)` 와 **인자 순서가 반대**입니다.

---

## lab06 - (c) 연산자 클래스를 추가하는 extension

**새 인덱스를 만들지 않습니다.** 기존 GiST/GIN 에 "이 타입은 이렇게 색인하라"고 알려줄 뿐입니다.

```console
--- B-tree 인덱스가 있어도 ---
 Seq Scan on users  (actual rows=25000)   Rows Removed by Filter: 175000
--- gin_trgm_ops 를 붙이면 ---
 Bitmap Index Scan on idx_users_name_trgm
```

**⚠️ 이 lab 의 핵심 - 3글자 함정**

```console
[1글자] LIKE '%김%'       →  Seq Scan
[2글자] LIKE '%김철%'     →  Seq Scan
[3글자] LIKE '%김철수%'   →  Bitmap Index Scan   ✅
```

이름 그대로 **tri**-gram. 패턴에서 온전한 3글자를 못 뽑으면 인덱스가 무용지물입니다.

> `btree_gist` 로 **겹치는 예약 막기**(`EXCLUDE`)도 함께 다룹니다 - 동시성 문제를 DB 제약으로 푸는 예.

---

## lab07 - (d) Hook 과 공유 메모리

**`CREATE EXTENSION` 만으로는 동작하지 않는 첫 부류.** `shared_preload_libraries` 가 필요합니다.

```c
void _PG_init(void) {
    ExecutorEnd_hook = pgss_ExecutorEnd;      /* ① 모든 세션을 잡으려면 서버 시작 시 */
    RequestAddinShmemSpace(pgss_memsize());   /* ② 공유메모리는 시작 시 한 번만 */
}
```

**핵심 - 쿼리 정규화**

```console
                  query                    | calls | total_ms
-------------------------------------------+-------+----------
 SELECT count(*) FROM t_demo WHERE id < $1 |     3 |     7.16
```

상수만 다른 세 쿼리가 하나로 합쳐집니다. 이게 없으면 "무엇이 느린가"를 알 수 없습니다.

> ⚠️ **카탈로그 집계로는 이 부류를 판별할 수 없습니다.** 함수 3개와 뷰 2개뿐입니다. 진짜 일은 C 코드가 실행기 안에서 합니다.

---

## lab08 - (e) Extension 이 아닌 "모듈"

```console
study=# CREATE EXTENSION auto_explain;
ERROR:  extension "auto_explain" is not available

$ ls $(pg_config --pkglibdir)/ | grep auto_explain
auto_explain.so                       ← .so 는 있다!
```

`.control` 이 없어서 `CREATE EXTENSION` 대상이 아닙니다. **그래도 동작합니다.**

| | Extension | Module |
|---|---|---|
| 구성 | `.control` + `.sql` (+`.so`) | `.so` 만 |
| 카탈로그 | 기록됨 · 버전 관리 · `DROP` 가능 | 기록 없음 |
| 로드 | `CREATE EXTENSION` | `LOAD` / `*_preload_libraries` |

**반대 방향도 봅니다.** `intagg` 는 `.so` 가 아예 없는 순수 SQL extension이고, `intarray` 의 라이브러리는 `intarray.so` 가 아니라 **`_int.so`** 입니다.

---

## lab09 - (f) Background Worker

**extension 이 프로세스를 갖는** 부류입니다.

```console
 pid |         backend_type         | application_name
-----+------------------------------+-------------------
  70 | checkpointer                 |
  75 | pg_cron launcher             | pg_cron scheduler   ← 이것
```

checkpointer 와 **같은 지위**입니다. 아무도 접속하지 않아도 일합니다.

```sql
SELECT cron.schedule('fast-tick', '1 seconds', $$INSERT INTO heartbeat DEFAULT VALUES$$);
SELECT pg_sleep(5);
SELECT count(*) FROM heartbeat;   -- 4   ← 우리가 자는 동안 워커가 실행
```

> `03-operations.sql` 이 **운영 체크리스트**(중복 실행 · 실패 알림 · 이력 정리 · HA)와 대안 비교(OS cron / 앱 스케줄러 / Airflow)를 다룹니다.

---

## lab10 - (g) FDW

**3단계 설정:** `FDW`(어떻게 읽을지) → `SERVER`(어디서) → `FOREIGN TABLE`(무엇을)

```console
 id | city | population
----+------+------------
  1 | 서울 |    9400000        ← CSV 파일이 그냥 테이블
```

**핵심 - 푸시다운**

```console
--- 됨 ---   Remote SQL: SELECT id, amount FROM orders WHERE ((city = '부산'))
--- 안 됨 --- Filter: (local_only(city) = '부산'::text)
              Remote SQL: SELECT id, city FROM orders     ← 10만 행을 다 끌어온다
```

> ⚠️ **`LANGUAGE sql` 함수로 반례를 만들면 실패합니다.** 플래너가 인라인해버려서 `upper(city)` 가 되고, 그건 원격도 아는 함수라 오히려 푸시다운됩니다. `plpgsql` 이어야 합니다.

---

## lab11 - (h) 내부를 노출하는 진단 extension

새 기능을 더하지 않습니다. **내부 자료구조를 SQL 로 볼 수 있게** 할 뿐입니다.

**VACUUM 이 실제로 하는 일**

```console
--- 10만 행 중 1/3 삭제 후 ---   6672 kB · 죽은튜플 33333
--- VACUUM 후 ---                6672 kB · 죽은튜플 0        ← 크기는 그대로!
--- VACUUM FULL 후 ---           4448 kB                     ← 이제 줄었다
```

**MVCC 를 눈으로** (`pageinspect`)

```console
 슬롯 | t_xmin | t_xmax | 다음_버전_위치 |   상태
------+--------+--------+----------------+-----------
    1 |    746 |    747 | (0,4)          | 이전 버전
    4 |    747 |      0 | (0,4)          | 살아있음
```

**Index Only Scan 이 안 되는 이유** - `Heap Fetches: 101` → VACUUM 후 `0`

---

## lab12 - (i) 새 인덱스 액세스 메서드

**가장 깊은 확장.** `pg_am` 에 항목이 생깁니다.

```console
  이름   | handler_함수
---------+---------------
 btree   | bthandler
 bloom   | blhandler      ← extension 이 추가
```

handler 는 "인덱스를 어떻게 만들고 · 스캔하고 · 비용을 추정할지"를 담은 C 함수입니다.

| | bloom 1개 (6컬럼 커버) | B-tree 6개 |
|---|---|---|
| 크기 | 7,856 kB | 20 MB |

> ⚠️ **테이블을 일부러 넓게(150바이트 패딩) 50만 행** 만듭니다. 좁은 테이블에서는 Seq Scan 이 워낙 싸서 플래너가 bloom 을 고르지 않습니다 - "인덱스가 안 잡히는데요?" 의 흔한 원인이기도 합니다.

---

## lab13 - (j) 절차적 언어

`pg_language` 에 항목이 생깁니다. 그런데 **handler 는 C 로 짜여 있습니다.**

```console
        handler         | 구현 언어 |  공유 라이브러리
------------------------+-----------+-------------------
 plpython3_call_handler | c         | $libdir/plpython3
```

**⚠️ 타입 매핑의 함정**

```console
 numeric     -> Decimal   (float 아님. 정밀도 보존)
 jsonb       -> str       ← dict 아님!
 date        -> str       ← date 객체 아님!
```

**`u` 는 untrusted 의 u**

```console
study=# SELECT py_run_shell();
 postgres          ← DB 함수가 쉘을 실행했다
```

막을 수 없는 언어(Python)는 **untrusted 로만** 제공됩니다 → 클라우드에서 대개 못 씁니다.

---

## 이어지는 자료 - pgvector · PostGIS

실제로 많이 쓰는 두 extension 은 **해당 회차에 별도 lab 으로** 공개됩니다.

| Lab | 주제 | 실행 시간 |
|---|---|---|
| `01-pgvector` | 마이그레이션 → 인덱스 → **바이트 단위 저장 구조** → recall 측정 | 약 100초 |
| `02-postgis` | 좌표계 · EWKB 해독 · GiST 2단계 필터 | 약 30초 |

<br>

**pgvector 에서 꼭 볼 것**

| 인덱스 | 설정 | recall@10 |
|---|---|---|
| IVFFlat | `probes = 1` **(기본값)** | **1 / 10** ❗ |
| HNSW | `ef_search = 40` (기본값) | 10 / 10 |

> 기본 설정 그대로 쓰면 정답 10개 중 1개만 찾습니다. **배포 전에 반드시 재보세요.**

---

## 전부 제대로 도는지 확인하기

```bash
$ ./tools/verify-labs.sh          # 14개 lab 실행 + 결과까지 검증
$ ./tools/verify-labs.sh check    # 이미 있는 로그로 검증만
```

`exit 0` 만 보면 "스크립트가 돌았다" 까지만 알 수 있습니다. **각 lab 이 의도한 결과를 실제로 냈는지** 핵심 출력을 확인합니다.

```
── lab06 연산자 클래스
  ✔ pg_trgm 전 Seq Scan
  ✔ pg_trgm 후 인덱스 사용
  ✔ 3글자 미만은 인덱스 못 씀
```

> 이 검사 덕분에 **lab06 의 `LIKE '%김%'` 예제가 실제로는 인덱스를 못 탄다**는 것을 발견했습니다. 슬라이드와 lab 을 모두 바로잡고, 그 자체를 실습 항목으로 넣었습니다.

---

<!-- _class: lead -->

# 시작해봅시다

<br>

```bash
$ cd labs/00-hello-extension && ./run.sh
```

**7초면 끝납니다.**

<br>

<span class="small">막히면 각 lab 의 `README.md` 에 예상 출력과 직접 해볼 거리가 있습니다</span>

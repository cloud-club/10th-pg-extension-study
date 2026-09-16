# 1회차 - PostgreSQL Extension 시스템 이해하기

> "이거 익스텐션으로 풀 수 있지 않을까?" 라고 생각하려면 먼저 익스텐션이 **무엇이고 어떻게 동작하는지**를 알아야 합니다. 그 바닥을 까는 회차입니다.

슬라이드는 [`slides/slides.html`](slides/slides.html) 을 브라우저로 열고 ←→ 로 넘깁니다. **본편은 "직접 만들어보기 ② - C" 까지**(개념 한 줄 → 왜 필요한가 → 내부 동작 → 파일 → 직접 만들기 ①②)고, 프로세스·메모리와 부류별 사례는 **부록 A~D** 로 뺐습니다. 실습은 Docker 만 있으면 [`labs/`](labs/) 에서 `./run.sh` 하나로 끝납니다. 완료 기준은 `labs/00-hello-extension` 을 직접 돌려보고 결과를 톡방에 남기는 것.

## 🧭 역사·설계 배경

신웅비의 [`2주차 자료`](../kungbi/2주차/)에는 관계형 모델과 INGRES부터 POSTGRES·Postgres95·PostgreSQL까지의 계보, PostgreSQL의 확장 철학, MySQL·MyISAM·InnoDB·MariaDB의 별도 계보를 정리했습니다. 27장 PowerPoint·PDF·발표 대본과 상세 조사 문서를 함께 제공합니다.

## 📑 발표 자료

**`.md` 가 원본이고 `.html` 은 생성물**이라, 내용을 고쳤으면 다시 빌드해야 합니다.

| 파일 | 장수 | 내용 |
|---|---|---|
| [`slides/slides.md`](slides/slides.md) | 106 | **본편(1~6장).** Extension 이란 무엇인가(한 줄 정의 → "설치"의 두 단계) → **그런데 왜 필요할까**(없던 시절의 세 가지 문제) → `CREATE EXTENSION` 내부 동작 → `.control` → **직접 만들기 ①SQL ②C**<br>**부록** A 프로세스와 메모리 · B 부류 나누기 · C 부류별 사례(lab04~lab13) · D 각자 파헤치기 |
| [`slides/slides-labs.md`](slides/slides-labs.md) | 29 | **실습 안내.** 14개 lab 을 하나씩 - 무엇을 하고, 무엇을 봐야 하고, 왜 그렇게 만들었는지 |
| [`slides/slides-operations.md`](slides/slides-operations.md) | 13 | **운영편.** `pg_dump` · 트러블슈팅 · 업그레이드 · 스키마/권한 · 클라우드 · 도입 체크리스트 |

pgvector · PostGIS 심층 자료는 해당 회차에 별도로 공개됩니다.

### 슬라이드 빌드 - `build-slides.sh`

[Marp](https://marp.app) 형식입니다. **HTML/PDF/PPTX 빌드는 Node.js 만 있으면 됩니다** - Marp 는 `npx` 로 자동으로 받아옵니다. `diagrams` 와 `check` 는 헤드리스로 돌릴 **Chrome/Chromium 도 필요합니다** (없으면 `CHROME_PATH` 로 알려주세요).

```bash
cd slides
./build-slides.sh          # 세 덱 전부 → HTML (다이어그램도 필요하면 함께 생성)
open slides.html           # 방향키 이동 · F 전체화면 · P 발표자 노트
```

| 명령 | 하는 일 |
|---|---|
| `./build-slides.sh` | 모든 덱 → HTML |
| `./build-slides.sh diagrams` | `diagrams/*.mmd` → `images/*.svg` |
| `./build-slides.sh shots` | GitHub 화면 캡처 → `images/pgvector-*.png` |
| `./build-slides.sh pdf` | 모든 덱 → PDF (배포·인쇄용) |
| `./build-slides.sh pptx` | 모든 덱 → PowerPoint |
| `./build-slides.sh watch` | 저장할 때마다 HTML 자동 재생성 |
| `./build-slides.sh serve` | `localhost:8080` 라이브 프리뷰 |
| `./build-slides.sh check` | **넘침 검사** - 슬라이드 밖으로 잘리는 내용 찾기 |
| `./build-slides.sh clean` | 생성물 삭제 |

특정 덱만: `./build-slides.sh html slides-labs`

#### 슬라이드를 고쳤다면 `check` 를 돌리세요

```
$ ./build-slides.sh check

──────── slides-labs ────────
총 29장 - 전부 여유 40px 이상 ✔
```

내용이 슬라이드를 넘치면 화면에서 **조용히 잘립니다.** 이 명령이 그걸 잡아줍니다. 헤드리스 Chrome 으로 장마다 실제 높이를 재고, 잘리는 슬라이드가 있으면 종료 코드 1 을 냅니다. 한글 폰트에 따라 줄 높이가 달라지므로 3회 측정 후 최악값으로 판정하고 40px 여유까지 요구합니다.

<sub>첫 실행 시 `slides/.slide-tools/` 에 검사 도구(puppeteer-core)를 설치합니다 - 1~2분, 이후엔 재사용.</sub>

### 폰트와 이모지

슬라이드는 **Pretendard** 를 씁니다. 로컬에 설치되어 있으면 그것을, 없으면 CDN 웹폰트를 받아옵니다.

`.marprc.yml` 에서 `emoji.unicode: false` 로 두었습니다. 기본값(`twemoji`)은 이모지를 `<img>` 로 바꾸는데, 그러면 **이모지 앞뒤가 줄바꿈 지점이 되어** "📦" 다음에 개행이 끼는 일이 생깁니다.

### 다이어그램

슬라이드의 그림은 [Mermaid](https://mermaid.js.org) 소스로 관리합니다. `slides/diagrams/*.mmd` 를 고치고 `slides/build-slides.sh diagrams` 를 돌리면 `slides/images/*.svg` 가 다시 만들어집니다.

| 파일 | 그림 |
|---|---|
| `01-install-two-steps` | 서버에 파일 놓기 ① vs DB 에서 활성화 ② |
| `02-create-extension-flow` | `CREATE EXTENSION` 3단계 · 8스텝 (에러 지점 포함) |
| `03-lifecycle-install` / `04-lifecycle-use` | 설치·활성화 / 사용 시퀀스 다이어그램 |
| `05-process-memory` | PostgreSQL 프로세스 모델과 공유 메모리 |
| `06-sql-vs-c` | SQL extension vs C extension 실행 경로 |
| `07-memory-scope` | palloc / static / 공유메모리 세 가지 수명 |
| `08-ten-principles` | 10가지 확장 원리 분류 |

### 화면 캡처 - `shots`

"우리가 만든 규칙이 실제 extension 에서도 그대로"임을 보여주는 두 장은 **GitHub 화면을 헤드리스 Chrome 으로 잘라** 만듭니다. `slides/build-slides.sh shots` 로 다시 뜹니다.

| 파일 | 무엇 |
|---|---|
| `pgvector-sql.png` | pgvector `sql/` - `vector--0.1.0--0.1.1.sql` 부터 쌓인 업그레이드 스크립트 42개 |
| `pgvector-src.png` | pgvector `src/vector.c` L821~852 - `vector_add()` 의 V1 호출 규약 |

<sub>GitHub 화면이 바뀌면 캡처가 어긋날 수 있습니다. 그때는 `slides/tools/capture-shots.mjs` 의 기준 요소(anchor)나 잘라낼 크기를 손보면 됩니다.</sub>

---

## 🧪 실습 - 14개 lab

각 lab 은 **두 가지 방법**으로 볼 수 있습니다.

| | 명령 | 언제 |
|---|---|---|
| **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
| **직접** | `./run.sh up` → `./run.sh psql` + 그 lab 의 `HANDS-ON.md` | psql 에서 **한 줄씩 쳐보며** 확인할 때 |

`HANDS-ON.md` 는 lab 마다 하나씩 있고, **무엇을 볼 것인지 → 칠 명령 → 왜 그런지** 순서로 되어 있습니다. 자동 스크립트가 `DO ... EXCEPTION` 으로 감싸 감춰둔 실패들도 직접 치면 **진짜 에러 메시지**로 보게 됩니다 - 그게 이 방식의 요점입니다.

포트가 서로 달라(15400~15413) 동시에 띄워도 충돌하지 않고, 대부분 5~10초면 끝납니다. 자세한 안내는 [`labs/README.md`](labs/README.md).

<sub>첫 실행에는 베이스 이미지 다운로드와 apt 설치 시간이 lab 당 1~5분 추가됩니다.</sub>

### 1부 - Extension 시스템 이해하기

| Lab | 주제 |
|---|---|
| [lab00](labs/00-hello-extension) | **가장 간단한 extension 만들기** - 텍스트 파일 2개 |
| [lab01](labs/01-create-extension) | `CREATE EXTENSION` 내부 동작 |
| [lab02](labs/02-sql-extension) | PGXS 빌드 · 업그레이드 · `pg_dump` 연동 |
| [lab03](labs/03-c-extension) | **C extension 직접 컴파일** |

### 2부 - 10가지 확장 원리

| Lab | 분류 | 대표 extension |
|---|---|---|
| [lab04](labs/04-functions) | (a) 함수 추가 | pgcrypto, tablefunc, fuzzystrmatch |
| [lab05](labs/05-types) | (b) 타입 추가 | hstore, citext, ltree, cube |
| [lab06](labs/06-opclass) | (c) 연산자 클래스 | pg_trgm, btree_gin, btree_gist |
| [lab07](labs/07-hooks) | (d) Hook + 공유메모리 | pg_stat_statements |
| [lab08](labs/08-modules) | (e) 모듈 (extension 아님) | auto_explain |
| [lab09](labs/09-bgworker) | (f) Background Worker | pg_cron |
| [lab10](labs/10-fdw) | (g) FDW | postgres_fdw, file_fdw |
| [lab11](labs/11-diagnostics) | (h) 내부 노출 | pageinspect, pgstattuple |
| [lab12](labs/12-index-am) | (i) 인덱스 액세스 메서드 | bloom |
| [lab13](labs/13-pl-languages) | (j) 절차적 언어 | **PL/Python**, PL/Perl |

### 처음이라면

```bash
cd labs/00-hello-extension
./run.sh                    # ① 7초 만에 전체 흐름을 훑고
./run.sh down && ./run.sh up
./run.sh psql               # ② HANDS-ON.md 를 열어놓고 직접 쳐보기
```

"extension 이란 결국 텍스트 파일 두 개"라는 감각이 잡힙니다.

### 전부 제대로 도는지 확인하기

```bash
./tools/verify-labs.sh          # 14개 lab 을 깨끗한 상태에서 실행하고 결과까지 검증
./tools/verify-labs.sh check    # 이미 있는 로그로 검증만
./tools/verify-handson.sh       # HANDS-ON.md 의 SQL 을 적힌 순서대로 실제로 실행
./tools/verify-handson.sh 03    # 특정 lab 만
```

`exit 0` 만 보면 "스크립트가 돌았다"까지만 알 수 있어서, **각 lab 이 의도한 결과를 실제로 냈는지** 핵심 출력을 확인합니다 (예: lab01 이 `pg_dump` 에서 함수 57개를 뱉었나, lab06 에서 트라이그램 인덱스를 실제로 탔나).

`verify-handson.sh` 는 각 `HANDS-ON.md` 의 ```` ```sql ```` 블록을 **적힌 순서 그대로** 깨끗한 DB 에서 실행합니다. ```` ```sql expect-error ```` 로 표시한 블록은 **반드시 에러가 나야** 통과합니다 - 가이드에 적어둔 에러가 진짜로 나는지까지 확인하는 것입니다.

<sub>이 검사들 덕분에 실제 오류 두 개를 잡았습니다. lab06 의 `LIKE '%김%'` 예제는
**인덱스를 타지 못했고**(트라이그램은 3글자가 색인 단위입니다), lab03 의 `myext_add(2147483647, 1)` 은 에러가 아니라 **조용히 wrap** 됩니다(`PG_RETURN_INT32(a + b)` 라고만 썼으니까요). 둘 다 바로잡고, 그 자체를 실습 항목으로 넣었습니다.</sub>

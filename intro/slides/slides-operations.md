---
marp: true
theme: default
paginate: true
size: 16:9
header: 'PG Extension Study - 운영편'
footer: 'Extension 운영에서 알아야 할 것'
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
  /* 제목 영역을 상단에 고정, 그 아래가 콘텐츠 영역 */
  section {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  section > h2:first-of-type {
    flex: 0 0 auto;
    min-height: 40px;
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
  section img { display: block; margin: 0 auto; max-width: 100%; max-height: 100%; }
  section p:has(> img:only-child) { flex: 1 1 auto; min-height: 0; margin-bottom: 0; }
  section p:has(> img:only-child) img { height: 100%; object-fit: contain; }
---

<!-- _class: lead -->

# 🔧 Extension 운영

## 설치한 다음에 마주치는 것들

<br>

**PG Extension Study - 운영편**

<span class="small">사전 지식: `slides.md`</span>

---

## 다룰 것

1. **`pg_dump` 와 Extension** - 왜 복원이 실패하는가
2. **트러블슈팅** - 자주 만나는 에러 6가지
3. **DBA 필수 쿼리**
4. **버전 업그레이드** - `ALTER EXTENSION` 과 `pg_upgrade`
5. **스키마 · 권한 설계**
6. **클라우드 매니지드 DB**
7. **도입 체크리스트**

<br>

> 이 자료는 "extension 을 골라서 쓰기로 했다" 이후의 이야기입니다. 발표 템플릿의 **3. 트레이드오프**, **4. 클라우드 지원** 항목을 채우는 데 직접 쓰입니다.

---

## `pg_dump` 와 Extension

```bash
$ pg_dump study | grep -i greetkor
CREATE EXTENSION IF NOT EXISTS greetkor WITH SCHEMA public;
COMMENT ON EXTENSION greetkor IS '한국어 인사 함수 모음';
COPY public.greetkor_config (key, value) FROM stdin;
locale	ko_KR
```

**두 가지 핵심**

1. **함수 정의는 하나도 덤프되지 않습니다.** `CREATE EXTENSION` 한 줄뿐. → **복원 대상 서버에 같은 extension 파일이 설치되어 있어야 복원됩니다.** (앞에서 본 ① 단계가 안 되어 있으면 복원이 통째로 실패합니다)
2. 단, `pg_extension_config_dump()` 로 등록한 테이블의 **데이터**는 덤프됩니다. PostGIS 의 `spatial_ref_sys`, pg_cron 의 `cron.job` 이 같은 메커니즘입니다.

---

## 트러블슈팅 - 자주 만나는 에러

| 에러 | 원인 / 해결 |
|---|---|
| `could not open extension control file` | **① 단계 미실행.** 패키지 미설치 또는 PG 버전이 다른 패키지 |
| `must be loaded via shared_preload_libraries` | `postgresql.conf` 추가 후 **서버 재시작** |
| `required extension "bar" is not installed` | 의존 extension 먼저 설치, 또는 `CASCADE` |
| `permission denied to create extension` | superuser 필요. 또는 trusted 면 `GRANT CREATE ON DATABASE` |
| `incompatible library version` / `missing magic block` | `.so` 가 다른 PG 버전용으로 빌드됨 |
| `cannot drop function ... because extension requires it` | 정상 동작. `DROP EXTENSION` 을 쓰세요 |

<br>

**`pg_upgrade` 전 체크:** 새 서버에 동일 extension 선설치 · `--check` 실행 · `shared_preload_libraries` 목록 이관 · PostGIS 는 `postgis_extensions_upgrade()` 별도 실행

---

## DBA 필수 쿼리

```sql
-- 1. 모든 extension 현황 + 업그레이드 가능 여부
SELECT e.extname, e.extversion, av.default_version AS latest, n.nspname AS schema,
       CASE WHEN e.extversion <> av.default_version
            THEN '업그레이드 가능' ELSE '최신' END AS status
FROM   pg_extension e
JOIN   pg_available_extensions av ON av.name = e.extname
JOIN   pg_namespace n ON n.oid = e.extnamespace
ORDER  BY e.extname;

-- 2. 느린 쿼리 Top 10
SELECT left(query, 60) AS query, calls,
       round(mean_exec_time::numeric, 2) AS avg_ms
FROM   pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;

-- 3. extension 전용 스키마 (운영 권장)
CREATE SCHEMA ext;
CREATE EXTENSION vector SCHEMA ext;
ALTER DATABASE mydb SET search_path = public, ext;
```

---

## 버전 업그레이드

```
study=# SELECT e.extname, e.extversion AS 설치됨, av.default_version AS 최신
        FROM pg_extension e JOIN pg_available_extensions av ON av.name = e.extname
        WHERE e.extversion <> av.default_version;

  extname  | 설치됨 | 최신
-----------+--------+------
 hstore    | 1.4    | 1.8
```

```
study=# ALTER EXTENSION hstore UPDATE;              -- 최신으로
study=# ALTER EXTENSION hstore UPDATE TO '1.6';     -- 특정 버전으로
```

> **파일이 먼저 새 버전이어야 합니다.** `apt upgrade` 로 패키지를 올린 뒤 각 DB 에서 `ALTER EXTENSION ... UPDATE` 를 돌리는 순서입니다. 패키지만 올리고 `ALTER` 를 안 하면 **파일은 1.8, DB 는 1.4** 인 상태가 됩니다.

---

## 업그레이드에서 실제로 겪는 일

| 상황 | 대응 |
|---|---|
| DB 가 여러 개 | extension 은 **DB 단위**. 각 DB 에서 따로 `ALTER` 해야 함 |
| 업그레이드 스크립트가 테이블을 바꿈 | `ALTER EXTENSION` 이 **락을 잡습니다.** 트래픽 적을 때 |
| PostGIS | `ALTER EXTENSION postgis UPDATE;` 후 `SELECT postgis_extensions_upgrade();` 별도 실행 |
| C extension | PG 메이저 버전이 바뀌면 **재컴파일 필요** (`incompatible library version`) |
| 다운그레이드 | **사실상 불가능합니다.** 문법(`UPDATE TO '1.0'`)은 있지만, 역방향 스크립트(`foo--1.1--1.0.sql`)를 제공하는 extension 이 거의 없습니다 |

<br>

> ⚠️ **다운그레이드를 기대할 수 없다**는 점이 중요합니다. `pg_extension_update_paths('foo')` 로 역방향 경로가 있는지 미리 확인하고, 없으면(대부분 없습니다) 스테이징에서 먼저 올려본 뒤 롤백 계획을 "이전 스냅샷 복원"으로 세워야 합니다.

---

## `pg_upgrade` (메이저 버전 업그레이드)

**extension 이 있는 DB 에서 가장 자주 막히는 지점입니다.**

```bash
$ pg_upgrade --check \
    -b /usr/lib/postgresql/16/bin -B /usr/lib/postgresql/17/bin \
    -d /var/lib/postgresql/16/main -D /var/lib/postgresql/17/main
```

**체크리스트**

1. 새 버전용 extension 패키지를 **먼저 설치** (`postgresql-17-pgvector` …)
2. `shared_preload_libraries` 목록을 새 `postgresql.conf` 로 이관
3. `pg_upgrade --check` 통과 확인
4. 업그레이드 후 각 DB 에서 `ALTER EXTENSION ... UPDATE`
5. PostGIS 는 `postgis_extensions_upgrade()` 추가 실행

> 3번에서 `could not load library` 가 나오면 1번을 빠뜨린 것입니다.

---

## 스키마 설계 - extension 을 어디에 둘까

```
study=# CREATE SCHEMA ext;
study=# CREATE EXTENSION vector SCHEMA ext;
study=# ALTER DATABASE mydb SET search_path = public, ext;
```

**`public` 에 두면 생기는 문제**

- extension 함수와 애플리케이션 함수가 같은 이름공간에서 섞입니다
- `pg_dump` 결과를 읽을 때 무엇이 extension 것인지 구분이 안 됩니다
- `public` 스키마 권한을 조이기 어려워집니다

**전용 스키마의 대가**

- `search_path` 를 관리해야 합니다. 빠뜨리면 함수를 못 찾습니다
- 일부 extension 은 `relocatable = false` 라 스키마를 못 옮깁니다

```
study=# SELECT extname, extrelocatable FROM pg_extension WHERE extname='vector';
```

---

## 권한 - 누가 설치하고 누가 쓰는가

```
--- 일반 유저로 설치 시도 ---
NOTICE:  citext      (trusted=true)  -> 설치 성공
NOTICE:  pageinspect -> permission denied to create extension "pageinspect"
```

| 설정 | 필요한 권한 |
|---|---|
| `trusted = true` | DB 에 대한 `CREATE` 권한만 |
| `trusted = false` | **superuser** |

<br>

**실무 패턴**

- extension 설치는 **마이그레이션 도구가 superuser 로** 한 번만
- 애플리케이션 계정은 설치 권한 없이 **사용만**
- `pageinspect`, `pg_buffercache` 같은 진단 도구는 **운영 계정에 주지 않기** (내부 구조가 그대로 노출됩니다)

---

## 클라우드 매니지드 DB

**superuser 가 없습니다.** 그래서 세 가지가 달라집니다.

1. **설치 가능한 extension 목록이 벤더가 정한 화이트리스트**로 제한됩니다
2. **`shared_preload_libraries` 를 직접 못 고칩니다** - 파라미터 그룹으로만
3. **버전을 못 고릅니다** - 엔진 버전에 묶여 있습니다

```
study=# SELECT name, default_version, installed_version
        FROM pg_available_extensions ORDER BY name;
```

> 이 쿼리 결과가 **그 인스턴스에서 쓸 수 있는 전부**입니다. 없으면 벤더가 지원하기를 기다리거나, 자체 운영으로 가야 합니다.

**발표 템플릿 4번 항목을 채울 때:** 지원 여부뿐 아니라 **버전과 확인 날짜**를 함께 적으세요. `iterative_scan`(pgvector 0.8+)처럼 최신 버전에만 있는 기능이 흔합니다.

---

## 도입 체크리스트

<div class="small">

| 항목 | 왜 |
|---|---|
| ☐ **어느 부류인가** | SPL 필요 여부 = 재시작 필요 여부 |
| ☐ **C 코드인가** | 세그폴트 시 서버 전체 영향 (📦 lab03) |
| ☐ **`pg_am` 을 건드리는가** | 메이저 업그레이드마다 호환성 확인 대상 |
| ☐ **유지보수가 활발한가** | PG 새 버전 대응 속도. GitHub 최근 커밋 |
| ☐ **클라우드에서 쓸 수 있나** | 지금은 자체 운영이어도 나중에 옮길 수 있음 |
| ☐ **롤백 계획** | 역방향 스크립트가 있는지 확인. 없으면 스냅샷 전략 |
| ☐ **`pg_dump` / 복원 확인** | 스테이징에 실제로 복원해보기 |
| ☐ **성능 측정** | 인덱스 크기 · 쓰기 비용 · 정확도 - **수치로** |

</div>

> 특히 `shared_preload_libraries` 에 넣는 것은 **모든 세션에 코드를 주입**하는 일입니다. 단계적으로(스테이징 → 일부 → 전체) 도입하세요.

---

<!-- _class: lead -->

# 정리

<br>

## 운영에서 기억할 세 가지

**1. `pg_dump` 는 extension 을 한 줄로만 덤프한다.** 복원 대상 서버에 **파일이 먼저 설치되어 있어야** 합니다. 스테이징에서 실제로 복원해보세요.

**2. 다운그레이드는 사실상 없다.** 역방향 스크립트를 제공하는 extension 이 거의 없어 `ALTER EXTENSION ... UPDATE` 는 한 방향입니다. 롤백은 스냅샷 복원으로 계획하세요.

**3. 클라우드에서는 목록이 정해져 있다.** `pg_available_extensions` 가 그 인스턴스의 전부입니다. **버전까지** 확인하세요.

<br>

```
study=# SELECT name, default_version, installed_version FROM pg_available_extensions;
```

# Week 04 · hstore

hstore의 상세 설명은 웹 자료에 모아 두었다.

```bash
cd catalogs/shinkeonkim/web
bun install --frozen-lockfile
bun run dev
```

브라우저에서 `http://localhost:5173/#/hstore/about`을 연다. 사이드바 순서대로 개요 → 설치와 문법 → 선택 기준 → 저장 방식 → jsonb와의 차이 → 인덱스 → 갱신 비용 → 동시성 → Redis 해시와 비교 → 운영 → 소스 지도 → 실험 → 참고 자료를 읽는다. 저장 구조·GIN 조회·유실 갱신·압축 차이 등 핵심 원리는 Clotho 애니메이션으로 재생된다.

## 이 자료가 답하는 질문

| 질문 | 답이 있는 곳 | 실측 근거 |
| --- | --- | --- |
| 기본 사용법·설치·문법은? | 웹 `설치와 기본 문법`, [lab 01](labs/01-install-and-syntax/) | 실습 출력 |
| jsonb 컬럼과 무엇이 다른가? | 웹 `jsonb와의 차이` | 실험 01·02·03 |
| 저장은 어떻게 되나? | 웹 `저장 방식`, [lab 02](labs/02-storage-and-toast/) | pageinspect로 디스크 바이트 해독, 실험 01 |
| 동시성은 어떻게 처리되나? | 웹 `동시성`, [lab 04](labs/04-concurrency/) | 실험 04 (10회) |
| Redis 같은 키-값 저장소로 봐도 되나? 장단점은? | 웹 `Redis 해시와 비교` | 실험 05 |
| 인덱스는? | 웹 `인덱스`, [lab 03](labs/03-indexes/) | 실험 03 |

## 실습

[`labs/`](labs)에는 Docker로 실행하는 실습 네 개가 있다. 각 디렉터리에서 `./run.sh`를 실행한다.

| 실습 | 내용 |
| --- | --- |
| [01](labs/01-install-and-syntax/) | 설치, 리터럴, 연산자·함수, 첨자, json/jsonb 변환 |
| [02](labs/02-storage-and-toast/) | pageinspect로 디스크 바이트 해독, TOAST, jsonb와의 압축 차이 |
| [03](labs/03-indexes/) | GIN·GiST·식 인덱스, recheck, 크기 |
| [04](labs/04-concurrency/) | 행 잠금 대기, 유실 갱신, 원자적 갱신, REPEATABLE READ |

## 실험

[`experiments/`](experiments)는 다음을 측정한다. 자세한 방법과 한계는 각 README에 있다.

| 실험 | 측정 항목 | 반복 |
| --- | --- | ---: |
| [01 · 저장 크기](experiments/01-storage-footprint/) | hstore·jsonb·EAV의 행당·전체 크기, 압축 차이의 원인 | 3 |
| [02 · 갱신 비용](experiments/02-update-write-amplification/) | 키 하나 UPDATE의 WAL·힙·TOAST·HOT, 읽기 비용 | 5 |
| [03 · 인덱스](experiments/03-index-and-query/) | GIN·GiST·btree 식·jsonb GIN의 크기·조회·삽입 | 5 |
| [04 · 동시성](experiments/04-concurrency-lost-update/) | 읽고-쓰기 유실, 원자적 갱신·FOR UPDATE·REPEATABLE READ, 경합 | 10 |
| [05 · Redis 비교](experiments/05-redis-comparison/) | 같은 일을 시킨 처리량, 내구성 수준별 세 쌍, 메모리 | 5 |

회차별 JSON은 각 실험의 `results/`에 생성되며 Git에서 제외한다. 웹에 쓰는 요약은 `web/src/data/hstore-experiments.json`에 있다.

## 기준 버전

- PostgreSQL 16.15, hstore 1.8
- 소스 분석은 postgres/postgres `REL_16_15` 태그(커밋 `7d3e000`)의 `contrib/hstore`
- 실험 05의 Redis는 7.4

카탈로그 요약은 [`../../hstore.md`](../../hstore.md)에서 확인한다.

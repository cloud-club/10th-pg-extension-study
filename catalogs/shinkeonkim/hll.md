# hll

> HyperLogLog 기반 요약 타입으로 고유 개수를 추정하고 여러 기간의 스케치를 합친다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 근사 집계 · 확률적 자료구조 |
| 검증 버전 | PostgreSQL 18.6 · hll 2.21 · PGDG 2.21-1.pgdg13+2 |
| 라이선스 | Apache License 2.0 |
| 저장소 · 문서 | [공식 저장소](https://github.com/citusdata/postgresql-hll) · [API](https://github.com/citusdata/postgresql-hll/blob/master/REFERENCE.md) |
| 확인일 | 2026-10-13 |
| 정리한 사람 | shinkeonkim |
| 회차 | week06 |

## 1. Before / After

정확한 COUNT DISTINCT와 일별 숫자만 저장하는 방식은 비용·재사용성이 다르다. 일별 고유 수를 더하면 날짜 사이에 겹친 사람을 제거하지 못한다. hll은 스케치를 저장하고 같은 계약의 요약을 합쳐 기간별 고유 개수를 추정한다. 초기 원본 읽기·해시·갱신 비용은 남는다.

## 2. 설치 & 데모

hll 바이너리를 별도로 설치한 뒤 CREATE EXTENSION을 실행한다. 전용 Lab은 preload 추가 없이 동작을 검증했다.

```sql
CREATE EXTENSION IF NOT EXISTS hll;
WITH visits(id) AS (VALUES (1),(1),(2),(3),(NULL))
SELECT count(DISTINCT id) AS exact,
       hll_cardinality(hll_add_agg(hll_hash_integer(id))) AS estimate
FROM visits;
-- 이 Lab: exact=3, estimate=3
```

## 3. 트레이드오프

근사값은 허용 오차가 있는 분석에 검토한다. 개별 사용자 조회·일반적인 삭제·정확한 정산의 대체가 아니다. 작은 EXPLICIT 해시 목록은 충돌이 없다면 정확한 개수를 낼 수 있다. 병합에는 ID·해시·seed·파라미터 계약이 필요하다. 특정 입력·seed의 큰 과소 추정도 Lab에서 관측했으며 원인·적용 범위를 확정하지 않았다.

## 4. 실행과 학습 자료

설명·기본 10장·심화 4장·Lab 4개·실측·인터랙티브 모형은 웹 `#/hll/about`에서 제공한다. 원문은 [웹 학습 지도](web/content/hll/about.md), 실행 파일·환경·원본은 web/labs/hll 안에만 둔다.

```bash
bash catalogs/shinkeonkim/web/labs/hll/run.sh
```

전용 hll 컨테이너와 스키마를 사용한다. 관리형 DB 설치·지원 권한은 이 Lab에서 검증하지 않았다.

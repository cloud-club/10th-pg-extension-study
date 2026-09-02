# Cloud Club 10기 - PostgreSQL Extension 스터디

> 실무 문제 상황과 PostgreSQL 확장을 매칭할 수 있는 **감각**을 기르고, 그 결과를 팀이 재사용 가능한 **카탈로그**로 남긴다.

한 가지 확장을 깊게 마스터하는 것도, 자격증처럼 정해진 종착점이 있는 것도 아닙니다. "어? 이거 익스텐션으로 풀 수 있지 않을까?" 라는 사고 회로를 만드는 것이 목표이고, 그 부산물로 **팀 전체가 쓸 수 있는 레퍼런스 카탈로그**가 쌓이는 것이 핵심 산출물입니다.

그래서 1회차만 리더가 바닥을 깔고(익스텐션이 뭐고 어떻게 동작하는지), 2회차부터는 각자 고른 확장을 각자 파서 공유합니다.

## 멤버

<table>
<tr>
<td align="center" width="25%">
<a href="https://github.com/shinkeonkim"><img src="https://github.com/shinkeonkim.png" width="120" alt="김신건"/></a><br/>
<b>김신건</b><br/>
<sub>스터디 리더</sub><br/>
<a href="https://github.com/shinkeonkim">@shinkeonkim</a>
</td>
<td align="center" width="25%">
<a href="https://github.com/yeeun0702"><img src="https://github.com/yeeun0702.png" width="120" alt="김예은"/></a><br/>
<b>김예은</b><br/>
<sub>참여자</sub><br/>
<a href="https://github.com/yeeun0702">@yeeun0702</a>
</td>
<td align="center" width="25%">
<a href="https://github.com/kungbi"><img src="https://github.com/kungbi.png" width="120" alt="신웅비"/></a><br/>
<b>신웅비</b><br/>
<sub>참여자</sub><br/>
<a href="https://github.com/kungbi">@kungbi</a>
</td>
<td align="center" width="25%">
<a href="https://github.com/miining"><img src="https://github.com/miining.png" width="120" alt="전승민"/></a><br/>
<b>전승민</b><br/>
<sub>참여자</sub><br/>
<a href="https://github.com/miining">@miining</a>
</td>
</tr>
</table>

## 커리큘럼

매주 **추천 카테고리**를 정해두되, 그 안에서 무엇을 팔지는 자유입니다. 추천 밖의 것을 파고 싶다면 그것도 자유 - 아래는 "뭘 할지 모르겠을 때"를 위한 기본값입니다.

| 회차 | 주제 | 추천 카테고리 |
| --- | --- | --- |
| 1 | **킥오프 + 익스텐션 시스템 이해** | `CREATE EXTENSION` 내부 동작 · contrib vs 서드파티 · Docker 실습 환경 → [`intro/`](intro/) |
| 2 | 운영·성능 진단 | pg_stat_statements, auto_explain, pg_hint_plan, HypoPG |
| 3 | 자동화·파티셔닝 | pg_cron, pg_partman, pg_repack |
| 4 | 검색·텍스트 | pg_trgm, unaccent, ParadeDB pg_search |
| 5 | AI·벡터 검색 | pgvector, pgvectorscale |
| 6 | 공간정보·시계열 | PostGIS, TimescaleDB (택1 심화) |
| 7 | 분산·보안 | Citus, pgAudit, pgcrypto |
| 8 | CDC·복제 + 카탈로그 마무리 | pglogical, wal2json + 전체 카탈로그 정리 & 회고 |

## 진행 방식

각자 5~10분씩 자유 선택한 확장을 공유하고, 발표 직후 **본인이 직접** 카탈로그에 등록합니다. 별도 "정리자"는 없습니다. 그 주 **진행자**는 시간 관리와 토론 유도, 다음 주 일정 취합만 담당하고 매주 1명씩 가볍게 로테이션합니다.

## 운영 규칙

> 1회차에 함께 합의하고, 바뀌면 이 항목을 고칩니다.

| 항목 | 규칙 |
| --- | --- |
| 요일 · 시간 | 수요일 22시 · 주 1회 1시간 |
| 모임 방식 | 대면/화상 고정하지 않음 - 매주 일정에 맞춰 유동적으로 결정, 진행자가 이전 주에 취합 |
| 발표 | 매주 각자 확장 1개, 5~10분. 그 주 추천 카테고리 안에서 자유 선택 |
| 카탈로그 | 발표 직후 본인이 `catalogs/<extension>.md` 로 PR |
| 진행자 | 매주 1명씩 로테이션 |
| 주제 선점 | 하지 않음. 겹쳐도 관점이 다르면 오히려 좋음 - 다만 `catalogs/` 를 먼저 훑어보기 |
| 트러블슈팅 | 막혔던 지점은 `issues/weekNN-증상.md` 로 기록 |
| 출결 | 지각·결석은 사전 공유. 결석 3회 = 10기 미이수(클럽 규정) |
| 소통 · 질문 | 카카오톡 채팅방 / Discord |


## 발표 템플릿

무엇을 파든 아래 항목만 채우면 카탈로그 품질이 균일하게 유지됩니다. 전체 양식은 [`catalogs/TEMPLATE.md`](catalogs/TEMPLATE.md) 에 있습니다.

| | 항목 | 내용 |
| --- | --- | --- |
| 필수 | Before / After | 이 익스텐션이 없으면 뭐가 불편한가 |
| 필수 | 설치 & 데모 | `CREATE EXTENSION` 부터 실제 쿼리까지 |
| 필수 | 트레이드오프 | 실무에서 언제 쓰고 언제 피해야 하나 |
| 필수 | 매니지드 DB 지원 | RDS / Aurora / Supabase / Neon / Cloud SQL |
| 선택 | 내부 동작 원리 | 인덱스 구조, 저장 방식 등 |
| 선택 | 벤치마크 | 없을 때와 비교한 수치 |

## 자료 지도

| 경로 | 내용 |
| --- | --- |
| [`catalogs/`](catalogs/) | **핵심 산출물.** 익스텐션 한 개 = 문서 한 장 |
| [`issues/`](issues/) | 트러블슈팅 기록 - 한 명의 에러가 모두의 학습 자료 |

## 시작하기

```bash
git clone https://github.com/cloud-club/10th-pg-extension-study.git
cd 10th-pg-extension-study

# 1회차 슬라이드
open intro/slides/slides.html

# 첫 실습 - Docker 만 있으면 됩니다 (약 7초)
cd intro/labs/lab00-hello-extension && ./run.sh
```

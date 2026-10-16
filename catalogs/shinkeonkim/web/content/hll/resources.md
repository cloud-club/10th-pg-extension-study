# 용어·근거·검증 범위

## 핵심 용어
| 용어 | 이 자료에서의 의미 |
| --- | --- |
| cardinality | 서로 다른 대상의 개수 |
| hash | 입력을 비트 패턴에 대응시키는 함수 |
| bucket | 해시로 선택하는 그룹 |
| register | 버킷의 rank 최댓값을 기억하는 값 |
| sketch | 특정 통계 질문을 위한 작은 요약 |
| union | 두 입력 집합의 합집합을 요약 |
| RSE | 상대 표준오차 모델 |
| RMSE | 시행별 상대 오차 제곱평균의 제곱근 |
| binary bytes | hll_send 직렬화 길이 |
| Execution Time | EXPLAIN의 서버 실행 계측 시간 |

## 일차 근거
[HyperLogLog 원 논문](https://algo.inria.fr/flajolet/Publications/FlFuGaMe07.pdf)은 알고리즘·수학 근거입니다. [확장 저장소](https://github.com/citusdata/postgresql-hll)는 PostgreSQL 기능·배포 설명, [API](https://github.com/citusdata/postgresql-hll/blob/master/REFERENCE.md)는 함수 계약, [소스](https://github.com/citusdata/postgresql-hll/blob/master/src/hll.c)는 구현 조사 출발점입니다. [저장 명세](https://raw.githubusercontent.com/aggregateknowledge/hll-storage-spec/v1.0.0/STORAGE.md)는 직렬화 형식이며 모든 DB 메모리 사용량의 명세가 아닙니다.
공식 근거는 2026-10-13에 확인했습니다. master 링크는 변경될 수 있으므로 재현 시 설치 패키지·소스 버전을 결과와 함께 고정합니다. README의 과거 하드웨어 처리량을 현재 Lab의 성능으로 옮겨 적지 않습니다.

## 완료한 검증
PostgreSQL 18.6·hll 2.21 전용 환경에서 중복·NULL·빈 입력·표현 전이·일별 병합·파라미터 불일치·20개 네임스페이스의 정밀도 비교·해시 seed 점검·조건당 10회 서버 실행 시간을 확인했습니다. 코드·원본·환경은 모두 web/labs/hll에 보관합니다.

## 아직 답하지 못한 질문
해시 seed 이상 관측의 근본 원인, 전체 입력 범위 오차, 충돌 확률 실증, peak RSS·동시 갱신·WAL·병렬 집계·관리형 DB 설치를 검증하지 않았습니다. 기본 확률 모형의 웹 실험실은 실제 hll 구현 또는 통계적 보장 도구가 아닙니다.

## 문서 보강 방법
질문이 생기면 기본 정의·예제·Lab 정답·결과 해석을 함께 변경합니다. 새 수치를 넣을 때 원본·정확한 기준값·파라미터·입력 계약·반복 수를 남깁니다. 설명 순서가 어긋나면 별도 문단을 덧붙이기보다 학습 경로를 재구성합니다. [학습 지도](about.md)로 돌아갑니다.

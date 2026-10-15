# week05 실험

pgvector·pgvectorscale은 `requires`로 묶여 있어(vectorscale이 vector를 요구) 실험 런타임을 공유한다 - [`runtime/`](runtime/)가 두 확장을 모두 설치한 `timescale/timescaledb-ha:pg16` 컨테이너를 띄운다. 각 실험은 `python3 bench.py`로 실행한다(표준 라이브러리만 사용, week04 hstore 실험과 같은 harness 패턴).

| 실험 | 측정 항목 | 반복 |
| --- | --- | ---: |
| [01 · recall vs 튜닝](01-recall-vs-tuning/) | HNSW `ef_search`·IVFFlat `probes`·DiskANN `query_search_list_size`에 따른 recall@10, 버퍼, 시간 | 2 |
| [02 · 빌드 비용·크기](02-build-cost-and-size/) | 20,000~300,000행에서 세 인덱스의 빌드 시간·크기(테이블 대비 비율) | 1 |
| [03 · SBQ 압축](03-sbq-compression/) | DiskANN `storage_layout`(memory_optimized vs plain) 비교 - plain은 서버가 죽어 절반만 완료 | 1 |
| [04 · plain 빌드 재현성](04-plain-build-memory-threshold/) | 실험 03의 크래시가 재현되는지 행 수 bisection + `maintenance_work_mem` 스윕 + 순서 재현 - **9번 전부 성공, 이전 결론 철회** | 9 |
| [05 · halfvec vs SBQ](05-halfvec-vs-sbq/) | 메모리를 아끼는 두 방법(halfvec vs SBQ 압축)의 크기·recall·속도 비교 - halfvec이 추가 확장 없이 크기의 31%를 줄임 | 1 |
| [06 · 300,000행에서 recall](06-recall-at-scale/) | 실험 01을 6배 규모로 재현 - DiskANN은 가장 싼 설정에서도 여전히 recall@10=1.0, HNSW·IVFFlat의 가장 싼 설정은 오히려 더 나빠짐(0.63→0.22, 0.54→0.29) | 1 |
| [07 · 라벨 필터링 비용·정확성](07-filtered-search-cost/) | DiskANN 네이티브 라벨 필터 vs HNSW+`iterative_scan` - HNSW 기본값은 0행, `relaxed_order`는 10행을 질의당 11.9ms에, DiskANN은 1.3ms에(결과 거리는 HNSW가 정답에 조금 더 가까움). **첫 판 결론은 중복 벡터 데이터 탓이라 정정** | 1 |

실험 03·04는 함께 읽는다 - 03이 처음 관찰한 크래시를 04가 반복 재현해 "구조적 문제가 아니었다"로 결론을 뒤집었다. 실험 07은 맨 위 정정부터 읽는다 - 첫 판이 실험 01의 "측정 중 겪은 함정" 2번(InitPlan)을 다시 밟았다. 실험 01·06도 함께 읽는다 - 06이 "51,000행에서의 DiskANN 포화가 작은 규모의 착시인가"라는 01의 미해결 질문에 답한다(아니다 - 300,000행에서는 격차가 더 벌어진다).

회차별 JSON은 각 실험의 `results/`에 있다. 환경: PostgreSQL 16.15 / pgvector 0.8.6 / pgvectorscale 0.9.1, Docker(공유 CPU 3개, RAM 3.8GiB) - 절대 시간은 이 환경에 한정된 참고치이고, 결정적 지표(recall, 버퍼, 크기 비율)를 우선해서 읽는다.

주차 요약은 [`../README.md`](../README.md)에 있다.

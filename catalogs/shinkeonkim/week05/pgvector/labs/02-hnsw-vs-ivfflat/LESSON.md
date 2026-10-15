# pgvector lab 02 — HNSW vs IVFFlat

Docker Engine과 Compose v2가 실행 중이어야 한다.

1. 빈 테이블에 IVFFlat 인덱스를 먼저 만들고 데이터를 채운 경우와, 데이터를 먼저 채우고 IVFFlat 인덱스를 만든 경우를 둘 다 만든다. HNSW는 빈 테이블에 만들어도 괜찮다는 것을 같이 둬서 대조한다.
2. `ivfflat.probes`와 `hnsw.ef_search`를 낮은 값과 높은 값으로 바꿔가며 같은 질의의 `EXPLAIN (ANALYZE, BUFFERS)`를 비교한다.

해석: IVFFlat의 "빌드 순서" 제약은 k-means가 빌드 시점의 스냅샷으로 군집 중심을 정하기 때문이다 - 나중에 데이터가 바뀌어도 중심은 재학습되지 않는다(REINDEX로만 갱신된다). HNSW는 그래프 간선을 삽입마다 갱신하므로 이 제약이 없다. 다만 그 대신 HNSW는 빌드 자체가 더 오래 걸린다(실험 02).

실습 설정: PostgreSQL 16.15, pgvector 0.8.7.
명령: ./run.sh (자동 실행), ./run.sh explain (이 안내), ./run.sh psql (수동).

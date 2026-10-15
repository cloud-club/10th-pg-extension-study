# Lab 01 · 설치와 거리 연산자

```bash
./run.sh       # 자동 실행
./run.sh up    # 컨테이너만 시작
./run.sh psql  # 수동 실습용 접속
```

## 확인 항목

- `pg_available_extension_versions`: trusted·superuser·requires (pgvector는 **trusted가 아니다** - 슈퍼유저 필요)
- 타입 4종: `vector` · `halfvec`(절반 정밀도) · `sparsevec`(희소) · `bit`(이진)
- 거리 연산자 4종: `<->`(L2) `<#>`(음의 내적) `<=>`(코사인) `<+>`(L1, 0.7.0+), bit 전용 `<~>`(해밍) `<%>`(자카드)
- HNSW·IVFFlat 인덱스 생성, `pg_opclass`로 지원 연산자 클래스 확인
- 질의 시점 튜닝 GUC(`hnsw.ef_search`, `ivfflat.probes`)는 확장 라이브러리가 로드된 뒤에야 보인다

자동 실행 단계는 [LESSON.md](LESSON.md), 수동 절차(차원 불일치 에러 포함)는 [HANDS-ON.md](HANDS-ON.md)에 있다.

실측 벤치마크(recall·빌드 시간·크기)는 [실험 01](../../../experiments/01-recall-vs-tuning/)·[실험 02](../../../experiments/02-build-cost-and-size/)에 있다 - 이 lab은 문법과 기본 동작 확인용이다.

다음 실습: [Lab 02 · HNSW vs IVFFlat](../02-hnsw-vs-ivfflat/)

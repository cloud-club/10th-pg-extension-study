# pg_stat_statements — 실험

`../labs/` 가 "이렇게 동작한다"를 psql 로 직접 보여주는 walkthrough 라면, 여기는 **실제로 수치를 재서** `docs/`에 적힌 통념(오버헤드 1~5%, eviction 이 느리게 만든다는 우려)을 검증하는 벤치마크다. 각 실험은 자기만의 Docker 이미지/컨테이너와 `bench.sh` 를 갖고 있고, `labs/` 와는 완전히 독립적이다.

| 실험 | 질문 | 헤드라인 결과 |
| --- | --- | --- |
| [01-overhead-under-load](01-overhead-under-load) | pg_stat_statements 를 켜면 pgbench 처리량이 실제로 얼마나 떨어지나? 옵션을 더 켤수록 누적되나? | 기본 설정(`track=top`) **-3.6%**, `track=all` **-6.0%**, `track_planning`+`track_io_timing` 을 더 얹어도 추가 손실은 거의 없었다(-6.1%) (과거 짧은 순차 측정, 보편적 오버헤드로 일반화 불가) |
| [02-max-sizing-vs-eviction-latency](02-max-sizing-vs-eviction-latency) | 해시테이블 eviction(GC)이 자주 일어나면 쿼리 실행이 실제로 느려지나? | 두 번의 과거 측정에서 뚜렷한 지연 증가를 확인하지 못했다. dealloc은 제거 이벤트 횟수이며, 비용이 없음을 입증하지 않는다 |

두 실험 모두 `bench.sh` 를 실제로 실행해서 나온 값이다 — 각 README에 측정 조건과 원본 수치를 기록했다. 재현 방법과 원본 측정값, 겪은 시행착오는 각 실험의 `README.md` 에 그대로 남겨뒀다.

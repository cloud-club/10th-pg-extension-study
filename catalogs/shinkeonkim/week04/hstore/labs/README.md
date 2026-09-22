# hstore 실습

각 실습은 별도의 Docker Compose 프로젝트와 포트를 사용한다. 원하는 실습만 골라 실행할 수 있다. hstore는 PostgreSQL 본체의 contrib 모듈이라 이미지에 이미 들어 있고, `shared_preload_libraries` 설정이나 재시작이 필요 없다.

| 실습 | 내용 | 포트 |
| --- | --- | --- |
| [01 · 설치와 문법](01-install-and-syntax/) | 설치, 리터럴 규칙, 연산자·함수, 첨자, json/jsonb 변환 | 15940 |
| [02 · 저장 구조와 TOAST](02-storage-and-toast/) | pageinspect로 디스크 바이트 해독, 크기 공식, TOAST·압축, jsonb와의 압축 차이 | 15941 |
| [03 · 인덱스](03-indexes/) | 지원 연산자 카탈로그, GIN·GiST·식 인덱스, recheck, 크기 | 15942 |
| [04 · 동시성](04-concurrency/) | 행 잠금 대기, 유실 갱신, 원자적 갱신·FOR UPDATE·REPEATABLE READ, pgbench 카운터 | 15943 |

## 자동 실행

각 디렉터리에서 `./run.sh`를 실행한다. 학습 목표를 출력한 뒤 이미지 빌드, 컨테이너 시작, SQL 실행을 차례로 수행한다.

```bash
cd 01-install-and-syntax
./run.sh
```

| 명령 | 동작 |
| --- | --- |
| `./run.sh` | 전체 시나리오 실행 |
| `./run.sh explain` | 실행 단계와 판정 기준 출력 |
| `./run.sh up` | 컨테이너만 시작 |
| `./run.sh psql` | 실습 DB에 접속 |
| `./run.sh 02` | 번호가 `02`로 시작하는 SQL만 실행 |
| `./run.sh down` | 컨테이너와 볼륨 삭제 |

수동으로 진행하려면 각 디렉터리의 `HANDS-ON.md`를 따른다.

상세 개념과 시각화는 웹의 `#/hstore/about`, 카탈로그 요약은 [`../../../hstore.md`](../../../hstore.md), 반복 실험은 [`../experiments/`](../experiments/)에 있다.

# lab — Docker로 돌리는 측정 환경

이 폴더는 **문서를 읽기만 하는 게 아니라, 같은 조건에서 숫자를 다시 뽑기** 위한 환경입니다.  
로컬 Docker Desktop + `./run.sh` 이면 됩니다. (Mac에 Postgres를 따로 설치할 필요 없음)

## 왜 Docker인가

- `shared_preload_libraries=pg_stat_statements` 를 compose에 고정 (재시작·설정 실수 줄임)
- 다른 사람이 `./run.sh`만 해도 같은 실습이 재현됨

## 무엇을 측정하나 (Extension 공부와의 연결)

| 스크립트 | 측정 | Extension 공부와의 관계 |
| --- | --- | --- |
| `sql/01-setup.sql` | preload, `CREATE EXTENSION`, `books` | Extension **설치**가 되는지 |
| `sql/02-normalize.sql` | `genre` literal → `$1`, **`calls` 합산** | Extension이 주는 **정규화** 동작 |
| `sql/03-mean-vs-total.sql` | mean 1등 ≠ total 1등 | Extension 지표로 **무엇을 먼저 볼지** 판단 |

- **정규화:** 상수만 다른 SQL을 한 패턴으로 묶음  
- **`calls`:** 그 패턴이 몇 번 실행됐는지  
- **mean / total:** 한 방 평균 vs 누적 합. Slow Query는 보통 “한 방” 쪽에 가깝고, 튜닝 우선순위는 보통 **total**

손으로 따라가려면 [HANDS-ON.md](../HANDS-ON.md) + `./run.sh psql`.

## 명령

```bash
cd yeeun/week02/lab
./run.sh          # 빌드 → 기동 → sql 01→02→03 전부
./run.sh up       # DB만
./run.sh psql     # 대화형
./run.sh 02       # 정규화만
./run.sh 03       # mean vs total만
./run.sh down     # 컨테이너 삭제 후 처음부터 다시
```

접속: `localhost:15502` / DB `study` / user·password `postgres`

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| `Dockerfile` | Postgres 16 + `postgresql-contrib` |
| `docker-compose.yml` | 포트, 볼륨, **preload 설정** |
| `run.sh` | 스터디 `intro/labs`와 같은 실행기 |
| `sql/` | 위 측정 스크립트 |

# hstore lab 02 — 저장 구조와 TOAST

Docker Engine과 Compose v2가 실행 중이어야 한다.

1. `pageinspect`로 힙 페이지의 튜플을 읽어 hstore의 원시 바이트를 얻는다.
2. 리틀 엔디언 4바이트 읽기 함수를 만들어 헤더(짧은 헤더 길이, size_ 의 쌍 개수·플래그)와 HEntry 6개(ISFIRST·ISNULL·끝 위치)를 해독한다.
3. 해독 결과를 소스 구조(hstore.h)와 맞춰 본다: 정렬 순서, 중복 제거, NULL 값이 문자열 영역을 쓰지 않음, 끝 위치가 누적값임.
4. 크기 공식(4 + 4 + 8 × 쌍 + 문자열, 130바이트 이하는 −3)과 `pg_column_size`를 대조하고 NULL·빈 문자열의 크기를 비교한다.
5. 키 200개짜리 hstore와 jsonb를 같은 내용으로 저장해 TOAST·압축을 비교하고, 같은 문자열에 끝 위치 배열/길이 배열을 붙인 합성 데이터로 압축 차이의 원인을 확인한다.
6. 키 하나를 바꾸는 UPDATE 후 TOAST 테이블이 커지는 양을 본다.

해석: 판정은 숫자 일치다. 공식 값과 pg_column_size가 같아야 하고, 압축 대조에서 끝 위치 배열이 길이 배열보다 크게 남아야 한다. 이 실습의 합성 대조는 ‘배열의 종류가 압축률을 좌우한다’는 것까지만 확인한다.

실습 설정: PostgreSQL 16.15, hstore 1.8, pageinspect.
명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
SQL은 ./run.sh sql로 다시 실행한다. 수동 실습은 HANDS-ON.md와 ./run.sh psql을 쓴다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.

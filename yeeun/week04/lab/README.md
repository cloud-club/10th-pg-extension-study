# lab — pg_repack

포트 `15504` · 이미지에 `postgresql-16-repack` 포함.

```bash
cd yeeun/week04/lab
./run.sh 01 && ./run.sh 02 && ./run.sh 03
./run.sh 04
docker exec -e PGPASSWORD=postgres yeeun-week04-repack \
  pg_repack -h 127.0.0.1 -U postgres -d study -t public.repack_demo
./run.sh 05
./run.sh down
```

수치: [../HANDS-ON.md](../HANDS-ON.md) §실측 결과

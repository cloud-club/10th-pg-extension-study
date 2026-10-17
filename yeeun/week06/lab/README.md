# lab — btree_gist

포트 `15506`. 공식 `postgresql-contrib`의 `btree_gist`.

```bash
cd yeeun/week06/lab
./run.sh          # 01→04 (동작 + 대량 벤치, 04는 오래 걸릴 수 있음)
./run.sh 01       # setup만
./run.sh 04       # 벤치만 (1억 행 목표 — 디스크·시간 주의)
./run.sh down
```

| SQL | 내용 |
| --- | --- |
| `01-setup` | Extension · reservation EXCLUDE |
| `02-inserts` | 성공 / 겹침 거부 / 다른 방 |
| `03-update` | UPDATE 거부 |
| `04-bench` | 10만·100만·**1억** 스케일 INSERT |

수치: [../HANDS-ON.md](../HANDS-ON.md)

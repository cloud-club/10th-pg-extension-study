# lab — postgres-json-schema

포트 `15505`. 이미지 빌드 시 GitHub에서 Extension을 `make install`.

```bash
cd yeeun/week05/lab
./run.sh          # 01→04 (동작 + 20k bench)
./run.sh 04       # 벤치만
./run.sh down
```

| SQL | 내용 |
| --- | --- |
| `01-setup` | Extension · demo table |
| `02-inserts` | 성공/실패 INSERT |
| `03-update` | UPDATE 거부 |
| `04-bench` | plain vs Schema · 20k INSERT |

수치: [../HANDS-ON.md](../HANDS-ON.md)

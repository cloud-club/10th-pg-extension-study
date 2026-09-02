#!/usr/bin/env python3
"""HANDS-ON.md 에서 ```sql 블록을 순서대로 뽑아 하나의 psql 스크립트로 만든다.

  ```sql               → 정상 실행되어야 하는 블록
  ```sql expect-error  → 실패해야 정상인 블록 (에러가 안 나면 그게 실패)

출력은 psql 로 그대로 먹일 수 있는 형태이며, 블록마다 마커를 넣어
어느 블록이 어떻게 됐는지 로그에서 판정할 수 있게 한다.
"""
import re, sys

src = open(sys.argv[1], encoding='utf-8').read()
out, n = [], 0
# ```sql / ```sql expect-error 로 시작하는 펜스만
for m in re.finditer(r'^```sql([^\n]*)\n(.*?)^```', src, re.S | re.M):
    flag, body = m.group(1).strip(), m.group(2)
    n += 1
    kind = 'XFAIL' if flag == 'expect-error' else 'OK'
    # 마커를 \warn 으로 내보내 ERROR 와 같은 stream(stderr)에 실리게 한다.
    # \echo(stdout) 를 쓰면 버퍼링 때문에 ERROR 와 순서가 뒤섞인다.
    out.append(f"\\warn '@@BLOCK {n} {kind}'")
    # expect-error 블록은 에러가 나야 하므로 여기서만 ON_ERROR_STOP 을 끈다
    out.append("\\set ON_ERROR_STOP " + ("off" if kind == 'XFAIL' else "on"))
    out.append(body.rstrip())
    out.append(f"\\warn '@@ENDBLOCK {n}'")
sys.stdout.write('\n'.join(out) + '\n')
sys.stderr.write(f"{n} blocks\n")

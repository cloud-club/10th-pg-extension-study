import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1]

def call(method, path, body=None, expected=200, quiet=False):
    if not quiet:
        print(f'\n{method} {path} → 예상 HTTP {expected}', flush=True)
        if body is not None: print(json.dumps(body,ensure_ascii=False))
    req=urllib.request.Request(BASE+path, data=None if body is None else json.dumps(body).encode(),
        headers={'Content-Type':'application/json'}, method=method)
    try:
        with urllib.request.urlopen(req,timeout=20) as response:
            status=response.status; raw=response.read()
    except urllib.error.HTTPError as e:
        status=e.code;raw=e.read()
    assert status == expected, (method,path,status,raw.decode())
    result=json.loads(raw) if raw else None
    if not quiet: print(json.dumps(result,ensure_ascii=False,indent=2))
    return result

call('POST','/admin/reset-stats')
orders=call('GET','/users/1/orders',quiet=True)
assert orders['count']==25
print('GET /users/1/orders → 주문 25개 확인 (상세 응답 생략)')
call('GET','/orders/search?item=keyboard',quiet=True)
call('GET','/orders/search?item=chair',quiet=True)
call('GET','/admin/top-queries?limit=8')
suspects=call('GET','/admin/n-plus-one-suspects')['suspects']
assert any('SELECT * FROM orders WHERE id =' in r['query'] and r['calls']==25 for r in suspects), suspects
call('GET','/admin/top-queries?limit=-1',expected=422)
call('GET','/admin/top-queries?limit=101',expected=422)
print('PASS: N+1의 calls=25 및 입력 검증. calls만으로 일반 트래픽의 N+1을 확정하지 않는다.')

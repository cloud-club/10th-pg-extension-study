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

call('GET','/health')
call('POST','/jobs',{'name':'demo-heartbeat','schedule':'2 seconds','sql':'INSERT INTO heartbeat DEFAULT VALUES'},201)
assert any(j['name']=='demo-heartbeat' for j in call('GET','/jobs'))
for attempt in range(30):
    runs=call('GET','/jobs/demo-heartbeat/runs?limit=5',quiet=True)
    if any(r['status']=='succeeded' for r in runs): break
    time.sleep(1)
else: raise AssertionError('heartbeat가 30초 안에 한 번도 성공하지 않았다')
call('GET','/jobs/demo-heartbeat/runs?limit=5')
call('PATCH','/jobs/demo-heartbeat',{'active':False})
assert next(j for j in call('GET','/jobs') if j['name']=='demo-heartbeat')['active'] is False
call('POST','/jobs',{'name':'bad-schedule','schedule':'not-a-cron-expression','sql':'SELECT 1'},400)
call('GET','/jobs/demo-heartbeat/runs?limit=-1',expected=422)
call('DELETE','/jobs/demo-heartbeat',expected=204)
call('DELETE','/jobs/demo-heartbeat',expected=404)
call('GET','/jobs/demo-heartbeat/runs',expected=404)
call('PATCH','/jobs/demo-heartbeat',{'active':True},404)
assert not any(j['name']=='demo-heartbeat' for j in call('GET','/jobs'))
print('PASS: 등록·실행·비활성화·오류 응답·삭제 검증')

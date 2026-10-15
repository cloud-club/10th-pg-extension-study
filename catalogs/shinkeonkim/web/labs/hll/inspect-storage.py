"""읽기 전용 SQL로 실제 hll 저장 표현을 관측하고 FULL payload를 해석한다."""
import argparse
import json
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'results/storage.json'
INPUTS=[17,17,28,39]
def validate(result):
    expected=[0]*16
    for item in result['inputs']:
        u=int(item['hash'])&((1<<64)-1)
        bucket=u&15;rest=u>>4
        rank=(rest&-rest).bit_length() if rest else 0
        expected[bucket]=max(expected[bucket],rank)
    raw=bytes.fromhex(result['full_hex'])
    assert raw[:3]==bytes.fromhex('148400')
    bits=''.join(f'{b:08b}' for b in raw[3:])
    decoded=[int(bits[i*5:(i+1)*5],2) for i in range(16)]
    assert decoded==expected==result['registers']
    assert result['explicit_type']==2 and result['full_type']==4
    assert '3 elements' in result['explicit_print']
    return decoded
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args()
if args.check:
    validate(json.loads(OUT.read_text()))
else:
    values=','.join(f'({n})' for n in INPUTS)
    query=f"""WITH v(id) AS (VALUES {values})
SELECT json_build_object('inputs',json_agg(json_build_object('id',id,'hash',hll_hash_integer(id)::text)),
'explicit_type',hll_type(hll_add_agg(hll_hash_integer(id))),
'explicit_print',hll_print(hll_add_agg(hll_hash_integer(id))),
'full_type',hll_type(hll_add_agg(hll_hash_integer(id),4,5,0,0)),
'full_hex',encode(hll_send(hll_add_agg(hll_hash_integer(id),4,5,0,0)),'hex')) FROM v;"""
    proc=subprocess.run(['docker','compose','-f',str(ROOT/'compose.yaml'),'exec','-T','db','psql','-X','-qAt','-U','postgres','-d','study','-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True,check=True)
    result=json.loads(proc.stdout)
    result['registers']=[0,0,0,0,0,0,0,2,0,0,0,0,0,0,2,0]
    result['sql']=query
    validate(result)
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('EXPLICIT 중복 제거·FULL 실제 payload와 레지스터 해석 검증 통과')

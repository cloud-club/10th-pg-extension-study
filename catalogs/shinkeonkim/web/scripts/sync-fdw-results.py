"""실제 Lab·실험 결과만 웹 JSON으로 옮기고 결정적 검증을 확인한다."""
import argparse
import json
from pathlib import Path
WEB=Path(__file__).resolve().parents[1]
SOURCE=WEB.parent/'week07/postgres_fdw'
DEST=WEB/'src/data/fdw-results.json'
LABS=['01-connect-and-metadata','02-pushdown-and-search','03-fetch-and-network','04-transactions-and-locks','05-connections-and-related']
EXPERIMENTS=['01-pushdown-and-transfer','02-fetch-and-row-width','03-planning-and-connections']
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
 data={'source':'catalogs/shinkeonkim/week07/postgres_fdw','labs':{},'experiments':{}}
 for area,names in [('labs',LABS),('experiments',EXPERIMENTS)]:
  for name in names:
   result=json.loads((SOURCE/area/name/'results/run.json').read_text())
   assert result['environment']['rows']==100000, '데이터 규모 변경 시 설명 갱신 필요'
   data[area][name]=result
 assert data['labs'][LABS[0]]['count_le_10']==10
 assert data['labs'][LABS[1]]['same_ids']
 assert data['labs'][LABS[2]]['observed_fetch_commands']=={'100':101,'1000':11}
 assert data['labs'][LABS[3]]['snapshot']=={'first':'before','within_transaction':'before','after_commit':'after'}
 assert data['labs'][LABS[4]]['remote_connections']==4
 assert data['labs'][LABS[4]]['keep_connections_false_remaining']==0
 for exp in data['experiments'].values():
  for case in exp['cases'].values():
   values=case if 'samples_ms' in case else None
   for value in ([values] if values else list(case.values())):
    assert value['n']==len(value['samples_ms'])==10
    assert all(v>=0 for v in value['samples_ms'])
 output=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
 if args.check:
  if not DEST.exists() or DEST.read_text()!=output:raise SystemExit('Week 07 실측 데이터 동기화 불일치')
 else:DEST.write_text(output)
 print('Week 07 Lab 5개·실험 3개 '+('검증 통과' if args.check else '실측 동기화'))
if __name__=='__main__':main()

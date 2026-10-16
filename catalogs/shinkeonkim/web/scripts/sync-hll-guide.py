"""Week 06 hll Markdown을 정적 React 페이지로 동기화한다."""
import argparse
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('guide_renderer',Path(__file__).with_name('sync-fdw-guide.py'))
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
r.SOURCE=r.WEB/'content/hll';r.DEST=r.WEB/'src/pages/hll/reading'
CHAPTERS=[('about', 'About', '시작하기'), ('counting', 'Counting', '기본 학습'), ('exact-cost', 'ExactCost', '기본 학습'), ('hashing', 'Hashing', '기본 학습'), ('bits', 'Bits', '기본 학습'), ('probability', 'Probability', '기본 학습'), ('registers', 'Registers', '기본 학습'), ('estimation', 'Estimation', '기본 학습'), ('sql', 'Sql', '기본 학습'), ('union', 'Union', '기본 학습'), ('limits', 'Limits', '기본 학습'), ('math', 'Math', '심화'), ('storage', 'Storage', '심화'), ('compatibility', 'Compatibility', '심화'), ('operations', 'Operations', '심화'), ('lab-basics', 'LabBasics', '실습'), ('lab-union', 'LabUnion', '실습'), ('lab-precision', 'LabPrecision', '실습'), ('lab-performance', 'LabPerformance', '실습'), ('resources', 'Resources', '근거'), ('results', 'Results', '실측')]
r.ROUTES.update({(r.SOURCE/(slug+'.md')).resolve():'/hll/'+slug for slug,_,_ in CHAPTERS})
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args()
 if not args.check:r.DEST.mkdir(parents=True,exist_ok=True)
 for slug,name,group in CHAPTERS:
  output=r.generate(slug+'.md',name,group).replace('Week 07 ·','Week 06 · hll ·').replace('web/content/fdw/','web/content/hll/').replace('scripts/sync-fdw-guide.py','scripts/sync-hll-guide.py')
  output=output.replace('return <>', 'return <div className="min-w-0 [&_p_code]:break-all">').replace(' </>\n}', ' </div>\n}').replace('<table>', '<div className="overflow-x-auto"><table>').replace('</table>', '</table></div>')
  dest=r.DEST/(name+'.tsx')
  if args.check:
   if not dest.exists() or dest.read_text()!=output:raise SystemExit(f'hll 원문 동기화 필요: {dest}')
  else:dest.write_text(output)
 print(f'Week 06 hll 문서 {len(CHAPTERS)}개 '+('검증 통과' if args.check else '생성'))
if __name__=='__main__':main()

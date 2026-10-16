"""번외 JOIN Markdown을 기존 정적 페이지 렌더러로 동기화한다."""
import argparse
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location('fdw_renderer', Path(__file__).with_name('sync-fdw-guide.py'))
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
r.SOURCE = r.WEB / 'content/joins'
r.DEST = r.WEB / 'src/pages/joins'
CHAPTERS = [('about','About'), ('semantics','Semantics'), ('nested-loop','NestedLoop'), ('hash','Hash'), ('merge','Merge'), ('bitmap','Bitmap'), ('planning','Planning'), ('labs','Labs')]
r.ROUTES.update({(r.SOURCE / (slug+'.md')).resolve(): '/pg-joins/'+slug for slug,_ in CHAPTERS})
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args()
 if not args.check:r.DEST.mkdir(parents=True,exist_ok=True)
 for slug,name in CHAPTERS:
  output=r.generate(slug+'.md',name,'JOIN').replace('Week 07 · JOIN','번외 · PostgreSQL JOIN').replace('web/content/fdw/','web/content/joins/').replace('scripts/sync-fdw-guide.py','scripts/sync-joins-guide.py')
  path=r.DEST/(name+'.tsx')
  if args.check:
   if not path.exists() or path.read_text()!=output:raise SystemExit(f'동기화 불일치: {path}')
  else:path.write_text(output)
 print(f'JOIN 문서 {len(CHAPTERS)}개 동기화 '+('검증 통과' if args.check else '완료'))
if __name__=='__main__':main()

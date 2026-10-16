# web — 예은 Study

주차별 **문서**(catalog MD) / **실습**(HANDS-ON)을 사이드바·탭으로 보는 Vite + React 앱.

```bash
cd yeeun/web
bun install   # 또는 npm install
bun run dev   # http://localhost:5173
bun run build
```

## 구조

```text
src/
  content/
    registry.ts                 # NAV · WEEK_INDEX
    pg_stat_statements.md       # week02 catalog
    pg_cron.md                  # week03
    pg_repack.md                # week04
    postgres-json-schema.md     # week05
    week0N-lab.md               # HANDS-ON 복사본
  components/layout/            # DashShell · WeekTabs
  components/ui/MarkdownDoc.tsx
  pages/week0N/Doc.tsx · Lab.tsx
```

원본: `yeeun/weekNN/catalogs/` · `HANDS-ON.md` · `lab/`

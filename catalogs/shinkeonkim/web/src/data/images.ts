/* ===========================================================================
 * 베이스 이미지 취약점 실측
 * 도구: aquasec/trivy 0.74.0 (--scanners vuln --severity CRITICAL,HIGH)
 * 측정일: 2026-09-09 · 취약점 DB 는 매일 바뀌므로 절대 수치보다 '차이'를 볼 것
 *
 * Docker Scout 은 Docker Hub 로그인을 요구해 쓰지 못했다. 그래서 trivy 로 쟀고,
 * 스캐너가 다르면 숫자도 다르게 나온다는 점을 감안해야 한다.
 * =========================================================================== */

export type ImageScan = {
  tag: string
  base: string
  critical: number
  high: number
  /** 패치가 나와 있어 실제로 고칠 수 있는 것 */
  fixableC: number
  fixableH: number
  /** 그중 gosu(Go stdlib) — 베이스를 바꿔도 안 사라진다 */
  gosu: number
  buildsPgBigm: boolean | null
  note?: string
}

export const IMAGE_SCANS: ImageScan[] = [
  { tag: 'postgres:16-bookworm', base: 'Debian 12', critical: 16, high: 93, fixableC: 1, fixableH: 21, gosu: 22, buildsPgBigm: true },
  { tag: 'postgres:16-trixie', base: 'Debian 13', critical: 14, high: 98, fixableC: 1, fixableH: 24, gosu: 22, buildsPgBigm: true, note: 'libicu-dev 를 추가해야 빌드된다' },
  { tag: 'postgres:17-trixie', base: 'Debian 13', critical: 14, high: 98, fixableC: 1, fixableH: 24, gosu: 22, buildsPgBigm: true },
  { tag: 'postgres:18-trixie', base: 'Debian 13', critical: 14, high: 98, fixableC: 1, fixableH: 24, gosu: 22, buildsPgBigm: true },
  { tag: 'postgres:16-alpine', base: 'Alpine (musl)', critical: 1, high: 30, fixableC: 1, fixableH: 30, gosu: 22, buildsPgBigm: true, note: 'with_llvm=no 가 필요하다' },
]

export const SCAN_ENV = {
  tool: 'aquasec/trivy 0.74.0',
  flags: '--scanners vuln --severity CRITICAL,HIGH',
  date: '2026-09-09',
}

/** musl(alpine) 과 glibc(trixie) 에서 같은 값이 나오는지 직접 대조한 것 */
export const MUSL_VS_GLIBC = [
  { probe: "show_bigm('클라우드 클럽')", trixie: `{" 클","드 ",라우,"럽 ",우드,클라,클럽}`, alpine: `{" 클","드 ",라우,"럽 ",우드,클라,클럽}`, same: true },
  { probe: "show_trgm('ab cd')", trixie: `{"  a","  c"," ab"," cd","ab ","cd "}`, alpine: `{"  a","  c"," ab"," cd","ab ","cd "}`, same: true },
  { probe: "show_bigm('192.168.0.1')", trixie: `{" 1",.0,.1,0.,"1 ",16,19,2.,68,8.,92}`, alpine: `{" 1",.0,.1,0.,"1 ",16,19,2.,68,8.,92}`, same: true },
  { probe: "bigm_similarity('클둥이','클동이')", trixie: '0.5', alpine: '0.5', same: true },
  { probe: "similarity('클둥이','클동이')", trixie: '0.14285715', alpine: '0.14285715', same: true },
]

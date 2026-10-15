"""전용 Compose 환경의 psql 실행·지속 세션. 외부 Python 의존성은 없다."""
import json
import selectors
import subprocess
from pathlib import Path
SHARED = Path(__file__).resolve().parent
COMPOSE = ['docker', 'compose', '-f', str(SHARED / 'compose.yaml')]
def docker(*args, **kwargs):
    return subprocess.run(COMPOSE + list(args), check=True, text=True, capture_output=True, **kwargs).stdout

def command(service='local'):
    return COMPOSE + ['exec', '-T', service, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
                      '-U', 'postgres', '-d', 'study' if service == 'local' else 'school']

def sql(query, service='local', timeout=60):
    result = subprocess.run(command(service), input=query, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()

def explain(query):
    return json.loads(sql('EXPLAIN (ANALYZE, VERBOSE, BUFFERS, FORMAT JSON) ' + query))[0]

def nodes(plan):
    yield plan
    for child in plan.get('Plans', []):
        yield from nodes(child)

class Session:
    def __init__(self, service='local'):
        self.proc = subprocess.Popen(command(service), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, text=True, bufsize=1)
        self.count = 0
    def query(self, query, timeout=20):
        # psql stdout을 OS 수준에서 읽어 TextIO 선읽기로 인한 대기를 피한다.
        import os
        self.count += 1
        marker = f'__fdw_done_{self.count}__'
        self.proc.stdin.write(query + f"; SELECT '{marker}';\n")
        self.proc.stdin.flush()
        selector = selectors.DefaultSelector()
        selector.register(self.proc.stdout, selectors.EVENT_READ)
        pending = ''
        lines = []
        try:
            while True:
                if not selector.select(timeout):
                    raise TimeoutError('psql session response timed out')
                chunk = os.read(self.proc.stdout.fileno(), 65536).decode()
                if not chunk:
                    raise RuntimeError(self.proc.stderr.read())
                pending += chunk
                while '\n' in pending:
                    line, pending = pending.split('\n', 1)
                    if line == marker:
                        return '\n'.join(lines).strip()
                    lines.append(line)
        finally:
            selector.close()
    def close(self):
        if self.proc.poll() is None:
            self.proc.stdin.close()
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.proc.terminate()
                self.proc.wait(timeout=5)
        self.proc.stdout.close()
        self.proc.stderr.close()
    def __enter__(self): return self
    def __exit__(self, *args): self.close()

def environment():
    return {'postgresql': sql('SELECT version()'),
            'extensions': json.loads(sql("SELECT json_agg(json_build_object('name',extname,'version',extversion)) FROM pg_extension")),
            'image': docker('images', '--format', 'json').strip(),
            'image_repo_digests': json.loads(subprocess.check_output(['docker','image','inspect','postgres:18.6'],text=True))[0]['RepoDigests'],
            'rows': int(sql('SELECT count(*) FROM public.books', 'remote')),
            'network': '同一ホストDocker Composeの内部ネットワーク'.replace('同一ホストDocker Composeの内部ネットワーク','같은 호스트 Docker Compose 내부 네트워크')}

def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

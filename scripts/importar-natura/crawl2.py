# Recorrido en paralelo (reanudable). Semillas: ids + páginas /c/ ; sigue productos relacionados.
import sys, re, json, time, os, threading
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scrape import fetch, extract_from
out, seeds_file, cats_file, workers = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
lock = threading.Lock()
done = {}
if os.path.exists(out):
    for l in open(out):
        d = json.loads(l)
        if d['code'] in (200, 404): done[d['id']] = d
seen = set(done); queue = []
def add(pid):
    if pid not in seen: seen.add(pid); queue.append(pid)
for d in done.values():
    for v in ((d.get('data') or {}).get('variations') or []):
        if v.get('id'): seen.add(v['id'])
for d in done.values():
    for r in d.get('related', []): add(r)
for s in open(seeds_file).read().split(): add(s)
f = open(out, 'a')
def cat_ids(url):
    code, page = fetch(url)
    return re.findall(r'NATARG-\d{3,9}\b', page) if code == 200 else []
cats = [l.strip() for l in open(cats_file) if l.strip()]
with ThreadPoolExecutor(workers) as ex:
    for ids in ex.map(cat_ids, cats):
        for i in ids: add(i)
print('seeds', len(queue), flush=True)
def work(pid):
    code, page = fetch(f'https://www.naturacosmeticos.com.ar/p/p/{pid}')
    rec = {'id': pid, 'code': code}
    if code == 200:
        rec['related'] = sorted(set(re.findall(r'NATARG-\d{3,9}\b', page)) - {pid})
        try: rec['data'] = extract_from(page, f'https://www.naturacosmeticos.com.ar/p/p/{pid}')
        except Exception as e: rec['err'] = repr(e)
    with lock:
        f.write(json.dumps(rec, ensure_ascii=False) + '\n'); f.flush()
        for v in ((rec.get('data') or {}).get('variations') or []):
            if v.get('id'): seen.add(v['id'])
        for r in rec.get('related', []): add(r)
    time.sleep(0.3)
n = 0
with ThreadPoolExecutor(workers) as ex:
    while queue:
        batch, queue[:] = queue[:], []
        list(ex.map(work, batch)); n += len(batch)
        print('done', n, 'pending', len(queue), flush=True)
print('fin', n, flush=True)

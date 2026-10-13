# Convierte crawl.jsonl en filas para products (+ fotos). Uso: build.py crawl.jsonl out.json [ids...]
import sys, json, re, unicodedata, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scrape import size_of
CATS = {'perfumeria':'59104559-b9c7-4c4f-92b1-638ea2c6f773','chronos':'be4df43b-d4a1-4cbc-9ec0-08556583a581',
 'cabello':'c7489549-12c6-4d40-a646-2664973eb451','respuestos':'ae9613d3-2de7-400e-b0cf-bff92618c173',
 'kits':'1fc0be81-38da-453c-99bb-b8c76f90ea58','maquillajes':'a9436901-409c-411f-932d-b417c67f5f6d',
 'infantiles':'35368a50-d52e-4a34-946c-4ed9083e0d31'}
def norm(s): return unicodedata.normalize('NFKD', s or '').encode('ascii','ignore').decode().lower()
def has(t, *ws): return any(re.search(r'\b'+w+r'\b', t) for w in ws)
def category(d):
    t = norm(' '.join(str(x) for x in [d.get('name'), d.get('rawName'), d.get('brand'), d.get('category'), d.get('productType')]))
    if has(t, 'repuesto', 'repuestos', 'refil', 'recarga'): return 'respuestos'
    if has(t, 'chronos'): return 'chronos'
    if has(t, 'kit', 'kits', 'regalo', 'presente', 'estuche', 'set', 'caja'): return 'kits'
    if has(t, 'infantil', 'infantiles', 'bebe', 'bebes', 'nino', 'ninos', 'nina', 'kids', 'mama y bebe', 'naturé', 'nature'): return 'infantiles'
    if has(t, 'shampoo', 'acondicionador', 'cabello', 'capilar', 'peinar', 'lumina', 'cabellos'): return 'cabello'
    if has(t, 'labial', 'labiales', 'base', 'mascara de pestanas', 'pestanas', 'delineador', 'lapiz', 'sombra', 'sombras', 'rubor',
           'polvo', 'corrector', 'esmalte', 'iluminador', 'gloss', 'kajal', 'primer', 'bb cream', 'cc cream', 'faces', 'una', 'cejas', 'maquillaje'):
        return 'maquillajes'
    if has(t, 'eau de parfum', 'eau de toilette', 'deo parfum', 'parfum', 'colonia', 'body splash', 'perfume', 'perfumeria', 'edp', 'edt', 'fragancia'):
        return 'perfumeria'
    return None
def slugify(s):
    s = re.sub(r'[^a-z0-9]+', '-', norm(s)).strip('-')
    return s[:120].strip('-')
def clean_name(n):
    n = re.sub(r'\s+', ' ', n or '').strip()
    return n[:120]
def build(records):
    groups = {}
    for r in records:
        d = r.get('data')
        if r.get('code') != 200 or not d or not d.get('magazinePrice'): continue
        vids = sorted(v['id'] for v in d.get('variations') or [] if v.get('id'))
        key = ('V', tuple(vids)) if vids else ('P', d['sku'])
        # Preferir la ficha "madre" (la que no aparece como variante)
        if key in groups and (d['sku'] in vids) and not (groups[key]['sku'] in vids): continue
        if key not in groups or d['sku'] not in vids: groups[key] = d
    rows = []
    for d in groups.values():
        name = clean_name(d.get('friendlyFromVariation') if d.get('variations') and d.get('friendlyFromVariation') else d.get('name'))
        if d.get('variations') and d.get('friendlyFromVariation'):
            # sacar el tono del nombre si viene incluido
            pass
        desc = d.get('description') or ''
        shades = [v['shade'] for v in d.get('variations') or [] if v.get('shade') and v.get('orderable') is not False]
        if shades: desc = (desc + '\n\nTonos disponibles: ' + ', '.join(dict.fromkeys(shades))).strip()
        images = list(d.get('images') or [])
        if not images and d.get('variations'): images = [v['img'] for v in d['variations'] if v.get('img')][:1]
        price = float(d['magazinePrice'])
        rows.append({'sku': d['sku'], 'name': name, 'slug': slugify(name), 'description': desc[:5000],
            'size': size_of(name) or d.get('size') or None, 'category': category(d), 'category_id': CATS.get(category(d)),
            'magazine_price': price, 'sale_price': price, 'images': images[:6], 'url': d.get('url')})
    seen = {}
    for r in rows: seen[r['slug']] = seen.get(r['slug'], 0) + 1
    for r in rows:
        if seen[r['slug']] > 1 or len(r['slug']) < 2: r['slug'] = (r['slug'] + '-' + re.sub(r'\D', '', r['sku']).lstrip('0'))[:140]
    return rows
if __name__ == '__main__':
    recs = [json.loads(l) for l in open(sys.argv[1])]
    if len(sys.argv) > 3: recs = [r for r in recs if r['id'] in sys.argv[3:]]
    rows = build(recs)
    json.dump(rows, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
    print(len(rows), 'rows')

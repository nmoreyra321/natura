import re, json, sys, subprocess, html, time
UA=['-H','User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36','-H','Accept-Language: es-AR,es;q=0.9','-H','Accept: text/html,*/*','-H','Sec-Fetch-Mode: navigate','-H','Sec-Fetch-Dest: document','-H','Sec-Fetch-Site: none']
def fetch(url):
    r=subprocess.run(['curl','-sS','--compressed','-L','--max-time','40','-w','\n%{http_code}',*UA,url],capture_output=True,text=True)
    body,_,code=r.stdout.rpartition('\n'); return int(code or 0), body
def parse(page, url):
    chunks=re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)</script>',page,re.S)
    txt=''.join(json.loads('"'+c+'"') for c in chunks)
    i=txt.find('"initialData":{"productId"')
    if i<0: return None
    d,_=json.JSONDecoder().raw_decode(txt[i+len('"initialData":'):])
    raw=txt.encode('utf-8')
    def resolve(v):
        if isinstance(v,str) and re.fullmatch(r'\$[0-9a-f]+',v):
            m=re.search(rb'(?:^|\n)'+v[1:].encode()+rb':T([0-9a-f]+),',raw)
            if m:
                n=int(m.group(1),16); return raw[m.end():m.end()+n].decode('utf-8','replace')
            return ''
        return v
    for k in ('longDescription','description','shortDescription','name','friendlyName','usage'):
        if k in d: d[k]=resolve(d[k])
    return d
def text(h):
    if not h: return ''
    h=re.sub(r'</(li|p|h\d|div)>|<br\s*/?>','\n',h,flags=re.I)
    t=html.unescape(re.sub(r'<[^>]+>','',h))
    lines=[re.sub(r'\s+',' ',l).strip() for l in t.split('\n')]
    lines=[re.sub(r'^[•\-·]\s*','• ',l) for l in lines if l]
    return '\n'.join(lines)
SIZE=re.compile(r'(\d+(?:[.,]\d+)?)\s?(ml|mg|g|gr|kg|l|un|u|unidades)\b',re.I)
def size_of(*ss):
    for s in ss:
        if not s: continue
        m=SIZE.findall(s)
        if m:
            n,u=m[-1]; u=u.lower(); u={'gr':'g','u':'un','unidades':'un'}.get(u,u)
            return f'{n} {u}'
    return None
def extract(url):
    code,page=fetch(url)
    if code!=200: return {'url':url,'error':code}
    return extract_from(page,url)
def extract_from(page,url):
    d=parse(page,url)
    if not d: return {'url':url,'error':'noData'}
    p=d.get('price') or {}
    lst=(p.get('list') or {}).get('value') if isinstance(p.get('list'),dict) else None
    sale=(p.get('sales') or {}).get('value') if isinstance(p.get('sales'),dict) else None
    refs={r.get('searchFor'):r.get('value') for r in d.get('refinements') or [] if isinstance(r,dict)}
    desc=text(d.get('longDescription')) or text(d.get('description'))
    short=text(d.get('description'))
    if short and short not in desc: desc=short+'\n\n'+desc
    return {'url':url,'sku':d.get('productId'),'name':d.get('friendlyName') or d.get('name'),'rawName':d.get('name'),
      'brand':d.get('brand'),'category':d.get('categoryName'),'classification':d.get('classificationName'),
      'productType':refs.get('c_tbs_Tipo_de_Produto'),'size':size_of(d.get('name'),d.get('friendlyName'),d.get('line')),
      'magazinePrice':lst or sale,'salePriceNatura':sale,'inStock':d.get('inStock'),
      'hasVariations':d.get('hasVariations'),
      'variations':[{'id':v.get('productId'),'shade':v.get('sharedColorDescription') or v.get('sharedColor'),'orderable':v.get('orderable'),'img':v.get('bannerImage')} for v in d.get('variations') or [] if isinstance(v,dict)],
      'friendlyFromVariation':next((v.get('friendlyName') for v in d.get('variations') or [] if isinstance(v,dict) and v.get('friendlyName')),None),'images':[i for i in d.get('images') or [] if isinstance(i,str)],'description':desc}
if __name__=='__main__':
    out=[]
    for u in sys.argv[2:]:
        out.append(extract(u)); time.sleep(0.7)
    json.dump(out,open(sys.argv[1],'w'),ensure_ascii=False,indent=1)

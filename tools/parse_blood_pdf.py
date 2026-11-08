import re, json, sys
txt=open('blood.txt',encoding='utf-8').read()
lines=txt.split('\n')
# split off the key table (last page)
ki=[i for i,l in enumerate(lines) if re.match(r'^\s*Q\s+Ans\s+Q\s+Ans',l)]
assert ki, 'no key table'
key_lines=lines[ki[0]+1:]
keys={}
for l in key_lines:
    for m in re.finditer(r'(\d{1,3})\s+([A-Z])\b',l): keys[int(m.group(1))]=m.group(2)
body=lines[:ki[0]]
# drop form feeds / page numbers / contents
Qs={}; cur=None; mode=None
sec_titles=['Body Fluids','Measurement of Body Fluids & Homeostasis','Plasma Proteins','Erythrocytes & Erythropoiesis','Vitamin B12','Iron','Anemia & Polycythemia','Hemostasis','Blood Groups & Rh']
qre=re.compile(r'^(\d{1,3})\s{2,}(\S.*)$')
ore=re.compile(r'^\s+([a-f])\)\s{1,}(\S.*)$')
started=False
for raw in body:
    l=raw.replace('\f','')
    if not started:
        if re.match(r'^1\s{2,}Most of the body weight',l): started=True
        else: continue
    if not l.strip(): continue
    if re.match(r'^\s*\d{1,2}\s*$',l):   # page number
        continue
    m=qre.match(l)
    if m and (cur is None or int(m.group(1))==cur['n']+1):
        cur={'n':int(m.group(1)),'stem':m.group(2).strip(),'opts':[],'past':False,'raw':[]}; Qs[cur['n']]=cur; mode='stem'; continue
    if cur is None: continue
    cur['raw'].append(l)
    mo=ore.match(l)
    if mo:
        cur['opts'].append([mo.group(1),mo.group(2).strip()]); mode='opt'; continue
    s=l.strip()
    if s.lower()=='past exam': cur['past']=True; continue
    if mode=='stem' and not cur['opts']: cur['stem']+=' '+s
    elif mode=='opt' and cur['opts']: cur['opts'][-1][1]+=' '+s
    else: cur.setdefault('extra',[]).append(s)
json.dump({'qs':[Qs[k] for k in sorted(Qs)],'keys':keys},open('parsed.json','w'),ensure_ascii=False,indent=1)
print('questions',len(Qs),'keys',len(keys), 'max',max(Qs), 'missing',[i for i in range(1,186) if i not in Qs],'nokey',[i for i in range(1,186) if i not in keys])
bad=[(k,len(q['opts'])) for k,q in Qs.items() if len(q['opts'])<2 or len(q['opts'])>5]
print('odd option counts',bad)
print('with extra',[k for k,q in Qs.items() if q.get('extra')])
print('past exam count',sum(1 for q in Qs.values() if q['past']))
from collections import Counter
print('opt letters',Counter(len(q['opts']) for q in Qs.values()))
print('keys not in opts',[(k,keys[k],[o[0] for o in Qs[k]['opts']]) for k in Qs if keys.get(k,'').lower() not in [o[0] for o in Qs[k]['opts']]])

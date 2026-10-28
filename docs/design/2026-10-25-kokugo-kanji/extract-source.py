import pdfplumber,re,json,pathlib,hashlib
out={}; current=None
pdf=pdfplumber.open('/tmp/sansu-kanji-sources/readings.pdf')
for pageNo,p in enumerate(pdf.pages[1:],1):
 for col in range(3):
  x=60+240.24*col
  crop=p.crop((x,100,x+237,548))
  words=crop.extract_words(x_tolerance=1,y_tolerance=2)
  lines={}
  for w in words:lines.setdefault(round(w['top']),[]).append(w)
  for _,row in sorted(lines.items()):
   left=''.join(w['text'] for w in row if w['x0']<x+55)
   reading=''.join(w['text'] for w in row if x+55<=w['x0']<x+115).strip()
   elementary=''.join(w['text'] for w in row if x+115<=w['x0']<x+155)
   m=re.fullmatch(r'([\u4e00-\u9fff])\s*([1-6])?',left)
   if m:
    current=m[1]
    if m[2]:out[current]={'grade':int(m[2]),'readings':[],'sourcePage':pageNo+1}
   if current in out and '○' in elementary and re.fullmatch('[ぁ-ゖァ-ヺー]+',reading):out[current]['readings'].append(reading)
print('count',len(out),{i:sum(v['grade']==i for v in out.values()) for i in range(1,7)})
print('empty',[k for k,v in out.items() if not v['readings']]);print({k:out.get(k) for k in '一右雨円茨媛岡阜阪茨后臓'})
pathlib.Path('/tmp/sansu-kanji-sources/extracted.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))

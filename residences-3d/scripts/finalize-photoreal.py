from pathlib import Path
import json,shutil
from PIL import Image,ImageDraw
r=Path(__file__).resolve().parents[1];p=r/'dist/assets/plans';generated=r.parent/'source-assets/photoreal-generated';deliver=r/'deliverables'
for key in ['carina-vega','coral-group','opal-group']:
 Image.open(p/(key+'-photoreal.webp')).verify()
 mf=p/(key+'-units.json');data=json.loads(mf.read_text())
 for unit in data['units']:
  Image.open(p/(unit['key']+'-photoreal.webp')).verify();unit['renderPhoto']=unit['key']+'-photoreal.webp';unit['renderPair']=unit['key']
 mf.write_text(json.dumps(data,separators=(',',':')))
floors=deliver/'photoreal-floor-plans';units=deliver/'photoreal-apartments';floors.mkdir(exist_ok=True);units.mkdir(exist_ok=True)
for key in ['carina-vega','coral-group','opal-group']:
 shutil.copy2(generated/(key+'.png'),floors/(key+'.png'))
 for n in range(1,9):
  name=f'{key}-unit-{n:02}.png';shutil.copy2(generated/name,units/name)
sheet=Image.new('RGB',(1920,360*6),'#eee')
for i,path in enumerate(sorted(units.glob('*.png'))):
 im=Image.open(path).convert('RGB');im.thumbnail((468,325));x=i%4*480;y=i//4*360;sheet.paste(im,(x+(480-im.width)//2,y));ImageDraw.Draw(sheet).text((x+8,y+334),path.stem,fill='black')
sheet.save(deliver/'photoreal-apartment-contact-sheet.jpg',quality=94)
# Keep the prior Blender render exports clearly identified as geometry previews.
old=deliver/'furnished-floors'
if old.exists():
 target=deliver/'blender-floor-previews';target.mkdir(exist_ok=True)
 for path in old.glob('*.png'):shutil.copy2(path,target/path.name)
for key in ['carina-vega','coral-group','opal-group']:
 if old.exists():shutil.copy2(generated/(key+'.png'),old/(key+'-furnished.png'))
html=r/'dist/index.html';s=html.read_text(encoding='utf-8').replace('>3D cutaway</button>','>3D furnished plan</button>').replace('Sai Sai Sun City','Sai Sun City');html.write_text(s,encoding='utf-8')
print('Verified and packaged all 27 photorealistic views; linked every apartment to its final render.')

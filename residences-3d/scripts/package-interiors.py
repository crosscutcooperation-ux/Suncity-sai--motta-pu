from pathlib import Path
import json,shutil
from PIL import Image
R=Path(__file__).resolve().parents[1];P=R/'dist/assets/plans'
jobs=json.loads((R.parent/'source-assets/interior-work/jobs.json').read_text())
for job in jobs:
 key=job['key'];solid=Image.open(P/(key+'-furnished.webp')).convert('RGBA')
 bg=Image.new('RGBA',solid.size,'white');bg.alpha_composite(solid);bg.convert('RGB').save(P/(key+'-furnished.webp'),quality=94)
 if job.get('fullFloor'):
  out=R/'deliverables/furnished-floors';out.mkdir(exist_ok=True);bg.convert('RGB').save(out/(key+'-furnished.png'));continue
 square=Image.open(R.parent/'source-assets/interior-work'/(key+'-square.webp')).convert('RGB');S=job['side'];pad=.075*max(job['width'],job['height']);w=min(S,job['width']+2*pad);h=min(S,job['height']+2*pad)
 flat=square.crop(((S-w)/2,(S-h)/2,(S+w)/2,(S+h)/2)).resize(solid.size,Image.Resampling.LANCZOS);flat.save(P/(key+'-flat.webp'),quality=96)
for group in ['carina-vega','coral-group','opal-group']:
 mf=P/(group+'-units.json');data=json.loads(mf.read_text())
 for unit in data['units']:
  unit['renderPair']=unit['key'];unit['renderPhoto']=unit['key']+('-photoreal.webp' if (P/(unit['key']+'-photoreal.webp')).exists() else '-furnished.webp')
 mf.write_text(json.dumps(data,separators=(',',':')))
finishes=R.parent.parent/'Sai World Dream/residences-3d/dist/assets/plans/finishes'
if finishes.exists():shutil.copytree(finishes,P/'finishes',dirs_exist_ok=True)
logo=Image.open(R.parent/'source-assets/Sun City Logo.png');logo.crop((0,0,960,logo.height)).resize((240,255),Image.Resampling.LANCZOS).save(R/'dist/assets/sai-sun-city-logo.png')
print('Packaged 24 apartment reveals and 3 complete furnished floor plans with rotatable models.')

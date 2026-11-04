"""Extract the exact texture bytes embedded by Blender's GLB exporter."""
from pathlib import Path
import json
import struct
import re

root = Path(__file__).resolve().parents[1]
raw = (root/'Sai Sun City.glb').read_bytes()
length = struct.unpack_from('<I',raw,12)[0]
doc = json.loads(raw[20:20+length])
start = 28+length
out = root/'textures/exported'
out.mkdir(exist_ok=True)
assets = []
for index,image in enumerate(doc['images']):
    view = doc['bufferViews'][image['bufferView']]
    name = re.sub(r'[^a-zA-Z0-9._-]','_',image.get('name','texture'))
    suffix = '.png' if image['mimeType'] == 'image/png' else '.jpg'
    filename = f'{index:02d}-{name}{suffix}'
    offset = start+view.get('byteOffset',0)
    (out/filename).write_bytes(raw[offset:offset+view['byteLength']])
    assets.append({'imageIndex':index,'path':'textures/exported/'+filename,'mimeType':image['mimeType']})
(root/'assets.json').write_text(json.dumps({'model':'Sai Sun City.glb','editable':'Sai Sun City.blend','textures':assets,'requiredExtensions':doc.get('extensionsUsed',[])},indent=2))
print(f'Extracted {len(assets)} embedded texture images.')

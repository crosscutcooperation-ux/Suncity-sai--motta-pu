"""Compare roof perimeters read back from the delivered GLB against brochure p12."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,struct,numpy as np
root=Path(__file__).resolve().parents[1]
out=root/'deliverables'
raw=(out/'sai-sun-city-exterior.glb').read_bytes()
json_length=struct.unpack_from('<I',raw,12)[0]
gltf=json.loads(raw[20:20+json_length]);binary=28+json_length
master=Image.open(root.parent/'reference-previews/master-layout.png').convert('RGB')
crop=(916,284,1906,1010)
base=master.crop(crop)
proof=Image.new('RGB',base.size,'#e4e4db')
draw=ImageDraw.Draw(proof)
for tower in gltf['nodes']:
    info=tower.get('extras',{})
    if 'towerId' not in info:continue
    matrix=np.array(tower.get('matrix',np.eye(4).T.flatten())).reshape(4,4).T
    for child_idx in tower.get('children',[]):
        node=gltf['nodes'][child_idx]
        if not node.get('name','').startswith('Plan-shaped facade'):continue
        primitive=gltf['meshes'][node['mesh']]['primitives'][0]
        acc=gltf['accessors'][primitive['attributes']['POSITION']];view=gltf['bufferViews'][acc['bufferView']]
        start=binary+view.get('byteOffset',0)+acc.get('byteOffset',0)
        pts=np.ndarray((acc['count'],3),dtype='<f4',buffer=raw,offset=start,strides=(view.get('byteStride',12),4))[::4]
        world=(matrix@np.column_stack((pts,np.ones(len(pts)))).T).T
        coords=[((x/.24+1350)-crop[0],(z/.24+630)-crop[1]) for x,y,z,w in world]
        draw.polygon(coords,fill='#adad99',outline='#576552',width=2)
# Side-by-side proof retains original north-up orientation and scale.
width=1380; pw=654
canvas=Image.new('RGB',(width,575),'#192522')
fdir=Path('C:/Windows/Fonts')
title=ImageFont.truetype(str(fdir/'segoeuib.ttf'),27);caption=ImageFont.truetype(str(fdir/'segoeui.ttf'),18)
pen=ImageDraw.Draw(canvas);pen.text((23,12),'Sai Sun City  /  Roof footprint registration',font=title,fill='white')
for i,(im,label) in enumerate([(base,'Published master layout · brochure page 12'),(proof,'Exported GLB · orthographic roof perimeters')]):
    im=im.resize((pw,round(im.height*pw/im.width)),Image.Resampling.LANCZOS)
    left=23+i*681;canvas.paste(im,(left,63));pen.text((left,548),label,font=caption,fill='#f0eee4')
canvas.save(out/'exterior-roof-registration.jpg',quality=94)


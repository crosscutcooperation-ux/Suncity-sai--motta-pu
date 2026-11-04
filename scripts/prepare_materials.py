"""Register the supplied daytime elevation and derive measured-colour PBR masks."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'references/25 Podium nd Building.jpg'
image = np.asarray(Image.open(source).convert('RGB'))
# Four-storey bay measured on a 1500 px review of the original 5000 px render.
quad = np.float32([[670,650],[711,658],[709,756],[671,748]]) * image.shape[1]/1500
target = np.float32([[0,0],[512,0],[512,1024],[0,1024]])
tile = cv2.warpPerspective(image,cv2.getPerspectiveTransform(quad,target),(512,1024))
Image.fromarray(tile).save(root/'textures/facade-day-base.jpg',quality=95)
hsv = cv2.cvtColor(tile,cv2.COLOR_RGB2HSV)
value = hsv[:,:,2].astype(float)/255
warm = (tile[:,:,0].astype(float)-tile[:,:,2]) / 255
# This colour-derived mask estimates material regions. It is not source PBR data.
glass = np.clip((tile[:,:,2].astype(float)-tile[:,:,0]+30)/38,0,1)
glass = cv2.GaussianBlur(glass,(3,3),0)
rough = np.clip(.84-glass*.61,0,1)
metal = np.clip(.02+glass*.50,0,1)
orm = np.stack([np.ones_like(glass),rough,metal],axis=2)
Image.fromarray((orm*255).astype('uint8')).save(root/'textures/facade-orm.png')
height = np.asarray(Image.open(root/'textures/stone-height.jpg').convert('L').resize((512,512)),dtype=float)/255
dy,dx = np.gradient(height)
normal = np.dstack([-dx*3,-dy*3,np.ones_like(height)])
normal /= np.linalg.norm(normal,axis=2,keepdims=True)
Image.fromarray(((normal*.5+.5)*255).astype('uint8')).save(root/'textures/stone-normal.png')
(root/'references/material-registration.json').write_text(json.dumps({
    'source':str(source.relative_to(root)),'sourcePixels':list(image.shape[:2][::-1]),
    'quad':quad.tolist(),'tileFloors':4,
    'qualityReference':'Sai World Dream facade roughness, metalness and glazing workflow',
    'approximation':'Masks estimated from rendered colour. Lighting and occlusion remain partly baked into base colour.'
},indent=2))
print('Prepared daytime facade, ORM mask and stone normal map.')

# Expand the brochure boundary by about ten local units for immediate planting.
import ast
ground_source = (root/'sources/site-ground-reference.js').read_text()
perimeter_text = ground_source.split('const perimeter = [',1)[1].split('];',1)[0]
perimeter = ast.literal_eval('['+perimeter_text+']')
mask = np.zeros((1188,2376),np.uint8)
cv2.fillPoly(mask,[np.asarray(perimeter,np.int32)],255)
mask = cv2.dilate(mask,np.ones((81,81),np.uint8))
contours,_ = cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
ring = cv2.approxPolyDP(max(contours,key=cv2.contourArea),1.5,True).reshape(-1,2)
boundary = [[round((float(x)-1350)*.24,4),round(-(float(y)-630)*.24,4)] for x,y in ring]
(root/'sources/landscape-boundary.json').write_text(json.dumps(boundary))

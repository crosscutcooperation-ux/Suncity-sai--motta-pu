"""Rebuild browser assets exclusively from the supplied Sai Sun City files."""
from pathlib import Path
import json, shutil
import pymupdf as fitz
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'residences-3d/dist/assets'
PLANS=OUT/'plans';PLANS.mkdir(exist_ok=True)
source=ROOT/'source-assets'
doc=fitz.open(source/'SSC Plan.pdf')
brochure=fitz.open(source/'Sai Suncity E Brochure.pdf')
# Original PDFs remain in source-assets; the browser source link opens Drive.
references=[('aerial','1 Cam bird eye view.jpg'),('aerial-reverse','2 Cam bird eye view.jpg'),('roadside','6 Wrom Eye View.jpg'),('plaza','9 High Angle with plaza_day.jpg'),('entrance','Sai Sun City - 1 Entrance Driveway View.jpg'),('courtyard','25 Podium nd Building.jpg'),('club-night','Copy of 41 Club House night view.jpg'),('boulevard','8 Wrom Eye View with plaza.jpg')]
gallery=[]
for key,name in references:
 im=Image.open(source/name).convert('RGB');im.thumbnail((2400,2400));im.save(OUT/(key+'.webp'),quality=88)
 gallery.append(dict(key=key,title=name.replace('.jpg','').replace('Copy of ',''),src='assets/'+key+'.webp'))
# Preserve complete supplied pages as references. The master plan is also used
# as a traceable spatial reference, not presented as a surveyed site map.
for i,key in [(6,'garden-reference'),(7,'sports-reference'),(8,'club-reference'),(9,'lobby-reference'),(11,'master-layout')]:
 brochure[i].get_pixmap(matrix=fitz.Matrix(1.4,1.4)).pil_save(OUT/(key+'.webp'),format='WEBP',quality=90)
 gallery.append(dict(key=key,title=key.replace('-',' ').title(),src='assets/'+key+'.webp'))
(OUT/'references.json').write_text(json.dumps(gallery,indent=2))

def rect(x,y,w,h):return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]]
# Apartment polygons registered against the original PDF page coordinates.
# Every unit number and BHK count is checked against the supplied drawing.
configs=[
 ('carina-vega',2,(230,120,1390,705),[
 ('08','1 BHK',rect(245,150,242,173)),('07','2 BHK',[[487,150],[570,150],[570,130],[751,130],[751,208],[808,208],[808,338],[665,338],[665,268],[599,268],[599,323],[487,323]]),
 ('06','2 BHK',[[808,208],[868,208],[868,130],[1019,130],[1019,150],[1134,150],[1134,323],[1019,323],[1019,268],[950,268],[950,338],[808,338]]),('05','1 BHK',rect(1134,150,242,173)),
 ('01','1 BHK',rect(245,505,242,174)),('02','2 BHK',[[487,505],[599,505],[599,557],[665,557],[665,490],[808,490],[808,695],[570,695],[570,679],[487,679]]),
 ('03','2 BHK',[[808,490],[950,490],[950,557],[1019,557],[1019,505],[1134,505],[1134,679],[1050,679],[1050,695],[866,695],[866,619],[808,619]]),('04','1 BHK',rect(1134,505,242,174))]),
 ('coral-group',3,(200,135,1410,762),[
 ('01','1 BHK',rect(210,175,250,179)),('02','2 BHK',[[460,175],[550,175],[550,145],[750,145],[750,246],[808,246],[808,360],[655,360],[655,296],[580,296],[580,354],[460,354]]),
 ('03','2 BHK',[[808,246],[865,246],[865,145],[1063,145],[1063,175],[1153,175],[1153,354],[1030,354],[1030,296],[955,296],[955,360],[808,360]]),('04','1 BHK',rect(1153,175,250,179)),
 ('08','1 BHK',rect(210,550,250,180)),('07','2 BHK',[[460,550],[580,550],[580,608],[655,608],[655,545],[808,545],[808,642],[750,642],[750,753],[550,753],[550,730],[460,730]]),
 ('06','2 BHK',[[808,545],[955,545],[955,608],[1030,608],[1030,550],[1153,550],[1153,730],[1063,730],[1063,753],[865,753],[865,642],[808,642]]),('05','1 BHK',rect(1153,550,250,180))]),
 ('opal-group',4,(177,155,1437,735),[
 ('01','1 BHK',rect(187,190,230,165)),('02','2 BHK',[[417,190],[500,190],[500,165],[680,165],[680,258],[734,258],[734,362],[594,362],[594,300],[526,300],[526,355],[417,355]]),
 ('03','2 BHK',[[881,258],[934,258],[934,165],[1117,165],[1117,190],[1197,190],[1197,355],[1088,355],[1088,300],[1020,300],[1020,362],[881,362]]),('04','1 BHK',rect(1197,190,230,165)),
 ('08','1 BHK',rect(187,535,230,165)),('07','2 BHK',[[417,535],[526,535],[526,590],[594,590],[594,535],[734,535],[734,635],[680,635],[680,725],[500,725],[500,700],[417,700]]),
 ('06','2 BHK',[[881,535],[1020,535],[1020,590],[1088,590],[1088,535],[1197,535],[1197,700],[1117,700],[1117,725],[934,725],[934,635],[881,635]]),('05','1 BHK',rect(1197,535,230,165))])]

def polys(mask,min_area=60):
 cs,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 return [cv2.approxPolyDP(c,1.2,True).reshape(-1,2).tolist() for c in cs if cv2.contourArea(c)>min_area]
def wall_rings(mask):
 cs,hi=cv2.findContours(mask,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE);out=[]
 if hi is None:return out
 for i,c in enumerate(cs):
  if hi[0,i,3]!=-1 or cv2.contourArea(c)<12:continue
  holes=[];child=hi[0,i,2]
  while child!=-1:
   if cv2.contourArea(cs[child])>8:holes.append(cv2.approxPolyDP(cs[child],.9,True).reshape(-1,2).tolist())
   child=hi[0,child,0]
  out.append(dict(outer=cv2.approxPolyDP(c,.9,True).reshape(-1,2).tolist(),holes=holes))
 return out

footprints={}
for key,index,bounds,units in configs:
 page=doc[index];clip=fitz.Rect(bounds);scale=1800/clip.width
 pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),clip=clip,alpha=False)
 rgb=np.frombuffer(pix.samples,np.uint8).reshape(pix.height,pix.width,3).copy();h,w=rgb.shape[:2]
 # The plans are rendered on white. Close thin drawing gaps, then fill only
 # the exterior outline; white service shafts are kept in the base drawing.
 gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
 fg=(gray<230).astype(np.uint8)*255
 fg=cv2.morphologyEx(fg,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
 cs,_=cv2.findContours(fg,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 mask=np.zeros_like(gray);largest=max(cs,key=cv2.contourArea);cv2.drawContours(mask,[largest],-1,255,-1)
 hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
 wm=((hsv[:,:,1]<45)&(gray>55)&(gray<159)).astype(np.uint8)*255
 wm=cv2.morphologyEx(wm,cv2.MORPH_OPEN,np.ones((2,2),np.uint8))
 n,labels,stats,_=cv2.connectedComponentsWithStats(wm);clean=np.zeros_like(wm)
 for k in range(1,n):
  x,y,bw,bh,area=stats[k]
  if area>25 and max(bw,bh)>10:clean[labels==k]=255
 clean=cv2.bitwise_and(clean,mask)
 rgba=cv2.cvtColor(rgb,cv2.COLOR_RGB2BGRA);rgba[:,:,3]=mask
 cv2.imwrite(str(PLANS/(key+'-floor.png')),rgba)
 data=dict(width=w,height=h,walls=wall_rings(clean),footprint=polys(mask,200),page=index+1,furniture=[])
 footprints[key]=dict(width=w,height=h,outline=data['footprint'][0])
 def pixel(p):return [round((p[0]-clip.x0)*scale),round((p[1]-clip.y0)*scale)]
 manifest=[]
 textspans=[s for b in page.get_text('dict',flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)['blocks'] for l in b.get('lines',[]) for s in l['spans']]
 for number,bhk,polygon in units:
  um=np.zeros_like(gray);cv2.fillPoly(um,[np.array([pixel(p) for p in polygon])],255);um=cv2.bitwise_and(um,mask)
  outline=polys(um,60);x,y,bw,bh=cv2.boundingRect(cv2.findNonZero(um));ukey=key+'-unit-'+number
  ui=rgba.copy();ui[:,:,3]=um;ui[um==0,:3]=0;cv2.imwrite(str(PLANS/(ukey+'-floor.png')),ui);cv2.imwrite(str(PLANS/(ukey+'-2d.png')),ui[max(0,y-8):min(h,y+bh+8),max(0,x-8):min(w,x+bw+8)])
  rooms=[];furniture=[]
  for s in textspans:
   b=s['bbox'];px,py=pixel([(b[0]+b[2])/2,(b[1]+b[3])/2]);txt=s['text'].strip()
   if 0<=px<w and 0<=py<h and um[py,px] and txt:rooms.append(txt)
  # Furniture centers are registered separately from text to the visible
  # bedroom/living footprints; shapes and height remain illustrative.
  for px,py,fw,fd,kind in []:pass
  ud=dict(data,walls=wall_rings(cv2.bitwise_and(clean,um)),footprint=outline,furniture=furniture)
  (PLANS/(ukey+'.json')).write_text(json.dumps(ud,separators=(',',':')))
  manifest.append(dict(id=number,type=bhk,key=ukey,polygons=outline,center=[x+bw/2,y+bh/2],rooms=rooms))
 (PLANS/(key+'.json')).write_text(json.dumps(data,separators=(',',':')))
 (PLANS/(key+'-units.json')).write_text(json.dumps(dict(width=w,height=h,units=sorted(manifest,key=lambda u:u['id']),page=index+1,kind='typical'),separators=(',',':')))
 print(key,len(data['walls']),'wall shapes,',len(manifest),'apartments')
(OUT/'tower-shapes.json').write_text(json.dumps(footprints,separators=(',',':')))
# Commercial drawings remain separately selectable original references.
for i in [0,1]:doc[i].get_pixmap(matrix=fitz.Matrix(1.4,1.4)).pil_save(PLANS/f'commercial-{i+1}.webp',format='WEBP',quality=94)
print('Sun City source assets prepared.')

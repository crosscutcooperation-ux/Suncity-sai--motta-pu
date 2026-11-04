"""Register furnishings to the supplied drawings and prepare Blender jobs."""
from pathlib import Path
import json,cv2,numpy as np
R=Path(__file__).resolve().parents[2];P=R/'residences-3d/dist/assets/plans';W=R/'source-assets/interior-work';W.mkdir(exist_ok=True)
groups={
 'carina-vega':dict(bounds=(230,120,1390,705),sumx=1621,sumy=824,
  one=[['b',256,199,60,52],['s',410,201,47,56],['t',413,284,42,28],['k',345,193,48,62]],
  two=[['b',874,157,70,59],['b',817,259,64,61],['s',1081,193,40,59],['t',1034,272,40,36],['k',991,168,52,77]],
  mapping={'08':('one',False,False),'05':('one',True,False),'01':('one',False,True),'04':('one',True,True),'06':('two',False,False),'07':('two',True,False),'02':('two',True,True),'03':('two',False,True)}),
 'coral-group':dict(bounds=(200,135,1410,762),sumx=1616,sumy=895,
  one=[['b',1335,239,58,59],['s',1160,219,43,62],['t',1194,300,43,33],['k',1260,218,48,63]],
  two=[['b',674,176,65,60],['b',706,286,65,60],['s',465,214,43,57],['t',510,299,43,35],['k',551,188,64,75]],
  mapping={'04':('one',False,False),'01':('one',True,False),'05':('one',False,True),'08':('one',True,True),'02':('two',False,False),'03':('two',True,False),'06':('two',True,True),'07':('two',False,True)}),
 'opal-group':dict(bounds=(177,155,1437,735),sumx=1616,sumy=890,
  one=[['b',1362,239,56,59],['s',1203,235,42,62],['t',1234,303,40,33],['k',1296,224,45,64]],
  two=[['b',630,191,40,51],['b',680,290,45,57],['s',422,235,45,57],['t',464,302,43,35],['k',502,195,60,82]],
  mapping={'04':('one',False,False),'01':('one',True,False),'05':('one',False,True),'08':('one',True,True),'02':('two',False,False),'03':('two',True,False),'06':('two',True,True),'07':('two',False,True)}),
}
jobs=[]
fixtures={
 'carina-vega':{'one':[['wc',300,293,13,17],['wc',370,293,13,17],['basin',264,286,18,14]],'two':[['wc',961,180,13,18],['basin',959,150,14,13],['wc',918,307,15,18],['basin',917,285,13,13]]},
 'coral-group':{'one':[['wc',1276,320,13,18],['wc',1370,320,13,18],['basin',1273,305,15,11]],'two':[['wc',634,204,13,18],['basin',623,177,14,11],['wc',670,324,13,18],['basin',661,301,15,11]]},
 'opal-group':{'one':[['wc',1320,321,13,18],['wc',1400,322,13,18],['basin',1304,306,15,11]],'two':[['wc',577,213,13,18],['basin',565,186,14,11],['wc',609,328,13,18],['basin',596,307,15,11]]},
}
entries={'carina-vega':{'08':(466,306),'07':(500,306),'06':(1118,306),'05':(1145,306),'01':(467,520),'02':(500,520),'03':(1118,520),'04':(1145,520)},'coral-group':{'01':(445,338),'02':(475,338),'03':(1138,338),'04':(1168,338),'08':(445,565),'07':(475,565),'06':(1138,565),'05':(1168,565)},'opal-group':{'01':(405,340),'02':(432,340),'03':(1184,340),'04':(1212,340),'08':(405,550),'07':(432,550),'06':(1184,550),'05':(1212,550)}}
for group,c in groups.items():
 mf=P/(group+'-units.json');manifest=json.loads(mf.read_text());allf=[];flooritems=[];floorlabels=[]
 for unit in manifest['units']:
  key=unit['key'];data=json.loads((P/(key+'.json')).read_text());image=cv2.imread(str(P/(key+'-floor.png')),cv2.IMREAD_UNCHANGED)
  x0,y0,x1,y1=c['bounds'];scale=1800/(x1-x0);typ,flipx,flipy=c['mapping'][unit['id']]
  items=[]
  for kind,x,y,w,h in c[typ]+fixtures[group][typ]:
   if flipx:x=c['sumx']-x-w
   if flipy:y=c['sumy']-y-h
   px=round((x-x0)*scale);py=round((y-y0)*scale);pw=round(w*scale);ph=round(h*scale)
   cx=min(image.shape[1]-1,max(0,px+pw//2));cy=min(image.shape[0]-1,max(0,py+ph//2))
   if image[cy,cx,3]:items.append([kind,px,py,pw,ph])
  if not any(i[0]=='b' for i in items):raise ValueError('Missing bedroom '+key)
  ex,ey=entries[group][unit['id']];items.append(['door',round((ex-x0)*scale),round((ey-y0)*scale),round(18*scale),round(3*scale)])
  furniture=[dict(kind={'b':'bed','s':'sofa','t':'table','k':'kitchen','wc':'wc','basin':'basin','door':'door'}[kind],x=x+w/2,y=y+h/2,width=w,depth=h) for kind,x,y,w,h in items]
  data['furniture']=furniture
  # Remove the drawn furniture from the extracted wall mask to avoid duplicate
  # furniture silhouettes standing up as wall segments in the 3D cutaway.
  mask=np.zeros(image.shape[:2],np.uint8)
  for ring in data['walls']:
   cv2.fillPoly(mask,[np.array(ring['outer'])],255)
   for hole in ring['holes']:cv2.fillPoly(mask,[np.array(hole)],0)
  for _,x,y,w,h in items:mask[max(y+2,0):y+h-2,max(x+2,0):x+w-2]=0
  straight=np.zeros_like(mask)
  for kernel in [(2,13),(13,2)]:straight|=cv2.morphologyEx(mask,cv2.MORPH_OPEN,np.ones(kernel,np.uint8))
  mask=cv2.morphologyEx(straight,cv2.MORPH_CLOSE,np.ones((2,2),np.uint8))
  cs,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
  rings=[cv2.approxPolyDP(a,1,True).reshape(-1,2).tolist() for a in cs if cv2.contourArea(a)>15]
  data['walls']=[dict(outer=r,holes=[]) for r in rings]
  (P/(key+'.json')).write_text(json.dumps(data,separators=(',',':')))
  allf+=furniture;flooritems+=items
  x,y,w,h=cv2.boundingRect(cv2.findNonZero(image[:,:,3]));margin=4;x=max(0,x-margin);y=max(0,y-margin);w=min(image.shape[1]-x,w+margin*2);h=min(image.shape[0]-y,h+margin*2)
  crop=image[y:y+h,x:x+w];white=np.full((h,w,3),255,np.uint8);white[crop[:,:,3]>0]=crop[:,:,:3][crop[:,:,3]>0];cv2.imwrite(str(W/(key+'.png')),white)
  # Clean architectural finish texture, separate from the original 2D drawing.
  # Bedroom wood zones follow the registered bedroom furniture footprints.
  yy,xx=np.indices((h,w));rng=np.random.default_rng(27);noise=rng.normal(0,1.1,(h,w));vein=1.2*np.sin(xx*.021+np.sin(yy*.017)*2)
  clean=np.clip(np.array([233,227,216])[None,None,:]+(noise+vein)[:,:,None],0,255).astype(np.uint8)
  labels=[]
  for kind,px,py,pw,ph in items:
   if kind=='b':
    bx=max(0,px-x-round(pw*.2));by=max(0,py-y-round(ph*.2));br=min(w,px-x+round(pw*1.2));bb=min(h,py-y+round(ph*1.3));wy,wx=np.indices((bb-by,br-bx));grain=5*np.sin(wy*.33+np.sin(wx*.012)*1.2)+3*np.sin(wy*.047);wood=np.clip(np.array([187,166,133])[None,None,:]+grain[:,:,None],0,255).astype(np.uint8);clean[by:bb,bx:br]=wood
    labels.append(dict(text='BEDROOM',x=px+pw/2-x,y=min(y+h-12,py+ph+9)-y))
   if kind=='k':labels.append(dict(text='KITCHEN',x=px+pw/2-x,y=py+ph+11-y))
   if kind=='t':labels.append(dict(text='LIVING + DINING',x=px+pw/2-x,y=py+ph+13-y))
  cv2.imwrite(str(W/(key+'-finish.png')),cv2.cvtColor(clean,cv2.COLOR_RGB2BGR))
  free=crop[:,:,3].copy();free[mask[y:y+h,x:x+w]>0]=0
  for _,px,py,pw,ph in items:
   cv2.rectangle(free,(max(0,px-x-3),max(0,py-y-3)),(min(w-1,px-x+pw+3),min(h-1,py-y+ph+3)),0,-1)
  placed=[]
  for label in labels:
   kw=max(28,round(.19/(2.04/max(next(i[3:]for i in items if i[0]=='b')))*len(label['text'])*.62));kh=13
   valid=cv2.erode(free,np.ones((kh,kw),np.uint8));ys,xs=np.where(valid>0)
   if not len(xs):continue
   dist=(xs-label['x'])**2+(ys-label['y'])**2;i=int(np.argmin(dist))
   if dist[i]>65**2:continue
   label=dict(label,x=int(xs[i]),y=int(ys[i]));placed.append(label)
  labels=placed
  side=round(max(w,h)*1.24);canvas=np.full((side,side,3),255,np.uint8);left=(side-w)//2;top=(side-h)//2;canvas[top:top+h,left:left+w]=white;cv2.imwrite(str(W/(key+'-square.webp')),canvas,[cv2.IMWRITE_WEBP_QUALITY,96])
  shift=lambda poly:[[a-x,b-y]for a,b in poly]
  floorlabels += [dict(text=a['text'],x=a['x']+x,y=a['y']+y)for a in labels]
  jobs.append(dict(key=key,width=w,height=h,side=side,labels=labels,bedHeads=''.join(('R' if flipx else 'L') if pw>=ph else ('B' if flipy else 'T') for kind,px,py,pw,ph in items if kind=='b'),items=[[kind,px-x,py-y,pw,ph]for kind,px,py,pw,ph in items],walls=[shift(r)for r in rings],outline=shift(max(data['footprint'],key=lambda a:cv2.contourArea(np.array(a))))))
 floor=json.loads((P/(group+'.json')).read_text());floor['furniture']=allf;(P/(group+'.json')).write_text(json.dumps(floor,separators=(',',':')))
 full=cv2.imread(str(P/(group+'-floor.png')),cv2.IMREAD_UNCHANGED);fh,fw=full.shape[:2];white=np.full((fh,fw,3),255,np.uint8);white[full[:,:,3]>0]=full[:,:,:3][full[:,:,3]>0];cv2.imwrite(str(W/(group+'.png')),white)
 clean=np.full((fh,fw,3),[216,227,233],np.uint8)
 # Reuse each apartment's finish coordinates in the full-floor composition.
 for unit in manifest['units']:
  img=cv2.imread(str(P/(unit['key']+'-floor.png')),cv2.IMREAD_UNCHANGED);ux,uy,uw,uh=cv2.boundingRect(cv2.findNonZero(img[:,:,3]));ux=max(0,ux-4);uy=max(0,uy-4);finish=cv2.imread(str(W/(unit['key']+'-finish.png')));ch,cw=finish.shape[:2];partmask=img[uy:uy+ch,ux:ux+cw,3]>0;roi=clean[uy:uy+ch,ux:ux+cw];roi[partmask]=finish[partmask]
 cv2.imwrite(str(W/(group+'-finish.png')),clean)
 walls=np.zeros((fh,fw),np.uint8)
 for ring in floor['walls']:
  cv2.fillPoly(walls,[np.array(ring['outer'])],255)
  for hole in ring['holes']:cv2.fillPoly(walls,[np.array(hole)],0)
 for _,px,py,pw,ph in flooritems:walls[max(0,py+2):py+ph-2,max(0,px+2):px+pw-2]=0
 straight=np.zeros_like(walls)
 for kernel in [(2,13),(13,2)]:straight|=cv2.morphologyEx(walls,cv2.MORPH_OPEN,np.ones(kernel,np.uint8))
 cs,_=cv2.findContours(straight,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);rings=[cv2.approxPolyDP(a,1,True).reshape(-1,2).tolist()for a in cs if cv2.contourArea(a)>15]
 jobs.append(dict(key=group,width=fw,height=fh,side=round(fw*1.2),fullFloor=True,items=flooritems,walls=rings,outline=max(floor['footprint'],key=lambda a:cv2.contourArea(np.array(a))),labels=floorlabels,bedHeads='T'*16))
(W/'jobs.json').write_text(json.dumps(jobs))
print('Prepared',len(jobs),'registered furnished jobs: 24 apartments and 3 complete floors.')

"""Build local, north-up context layers. Inputs and attribution live beside the generated files."""
import concurrent.futures
import json
import math
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from shapely.geometry import LineString, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "source-assets" / "location"
OUT = ROOT / "dist" / "assets" / "neighborhood"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
PIN = (19.088846237240855, 73.11042433491059)
BBOX = (73.084, 19.069, 73.133, 19.108)
WEST, SOUTH, EAST, NORTH = BBOX
M_PER_LAT = 110693.0
M_PER_LON = 105238.0

def local(lon, lat):
    return [round((lon-PIN[1])*M_PER_LON), round((PIN[0]-lat)*M_PER_LAT)]

LEFT, TOP = local(WEST, NORTH)
RIGHT, BOTTOM = local(EAST, SOUTH)
CLIP = box(LEFT, TOP, RIGHT, BOTTOM)
N = 129

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Sai Sun City architectural explorer/1.0"})
    return urllib.request.urlopen(req, timeout=45).read()

def save(name, value):
    (OUT/name).write_text(json.dumps(value, separators=(',', ':'),ensure_ascii=False), encoding='utf8')

def satellite():
    metadata=SOURCE/'satellite-item.json'
    if not metadata.exists():
        metadata.write_bytes(fetch('https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/S2A_43QBB_20260319_0_L2A'))
    item = json.loads(metadata.read_text())
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', GDAL_HTTP_TIMEOUT='35'):
        with rasterio.open(item['assets']['visual']['href']) as src:
            with WarpedVRT(src, crs='EPSG:4326', transform=from_bounds(*BBOX, 688, 576), width=688, height=576,
                           resampling=rasterio.enums.Resampling.bilinear) as vrt:
                data = vrt.read([1, 2, 3])
    if (data.sum(axis=0)==0).any():
        raise ValueError('Satellite scene does not cover every point of the selected map extent')
    Image.fromarray(np.moveaxis(data,0,2)).save(OUT/'satellite.webp', quality=94, method=6)
    print('Satellite',data.shape, data.mean(),flush=True)

def terrain():
    zoom = 13
    tile_count = 2**zoom
    def pixel(lon,lat):
        return (tile_count*256*(lon+180)/360, tile_count*256*(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2)
    lo = pixel(WEST,NORTH)
    hi = pixel(EAST,SOUTH)
    tiles={}
    for x in range(int(lo[0]//256),int(hi[0]//256)+1):
        for y in range(int(lo[1]//256),int(hi[1]//256)+1):
            path=SOURCE/f'terrarium-{zoom}-{x}-{y}.png'
            if not path.exists(): path.write_bytes(fetch(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{x}/{y}.png'))
            tiles[(x,y)]=np.asarray(Image.open(path),dtype=float)
    def elevation(lon,lat):
        px,py=pixel(lon,lat)
        ix,iy=int(px),int(py)
        def value(x,y):
            r,g,b=tiles[(x//256,y//256)][y%256,x%256,:3]
            return r*256+g+b/256-32768
        fx,fy=px-ix,py-iy
        return round((1-fy)*((1-fx)*value(ix,iy)+fx*value(ix+1,iy))+fy*((1-fx)*value(ix,iy+1)+fx*value(ix+1,iy+1)),1)
    heights=[elevation(lon,lat) for lat in np.linspace(NORTH,SOUTH,N) for lon in np.linspace(WEST,EAST,N)]
    print('Elevation range',min(heights),max(heights),flush=True)
    save('terrain.json',dict(n=N,extent=[LEFT,TOP,RIGHT,BOTTOM],heights=heights))

def extract():
    source=SOURCE/'osm-map.xml'
    if not source.exists():
        source.write_bytes(fetch('https://api.openstreetmap.org/api/0.6/map?bbox='+','.join(map(str,BBOX))))
    root=ET.parse(source).getroot()
    xy={n.get('id'): local(float(n.get('lon')),float(n.get('lat'))) for n in root.findall('node')}
    groups={'roads':[], 'rail':[], 'waterways':[], 'buildings':[], 'land':[]}
    def flat(coords):
        return [round(v) for pair in coords for v in pair]
    def parts(g,kind):
        if g.is_empty: return []
        if g.geom_type==kind: return [g]
        if hasattr(g,'geoms'): return [p for a in g.geoms for p in parts(a,kind)]
        return []
    for w in root.findall('way'):
        t={x.get('k'):x.get('v') for x in w.findall('tag')}
        pts=[xy[n.get('ref')] for n in w.findall('nd') if n.get('ref') in xy]
        if len(pts)<2: continue
        road=t.get('highway')
        rail=t.get('railway')
        water=t.get('waterway')
        if road or rail in ('subway','rail','light_rail') or water:
            category,kind=('roads',road) if road else ('rail',rail) if rail in ('subway','rail','light_rail') else ('waterways',water)
            for line in parts(LineString(pts).intersection(CLIP).simplify(.8),'LineString'):
                if line.length>2: groups[category].append([kind,int(w.get('id')),flat(line.coords)])
        if pts[0]!=pts[-1] or len(pts)<4: continue
        is_building=t.get('building') not in (None,'no','construction')
        land=t.get('natural') or t.get('landuse')
        if not is_building and land not in ('water','wood','forest','industrial','farmland','residential','construction','quarry'):continue
        poly=Polygon(pts)
        if not poly.is_valid: poly=poly.buffer(0)
        for p in parts(poly.intersection(CLIP).simplify(.6),'Polygon'):
            if p.area<9: continue
            coords=flat(list(p.exterior.coords)[:-1])
            if is_building:
                try: h=float(t['height'].replace('m','').strip());known='height'
                except (KeyError, ValueError):
                    try: h=3*float(t['building:levels']);known='levels'
                    except (KeyError, ValueError): h=10 if t['building'] in ('industrial','shed') else 8;known='estimated'
                groups['buildings'].append([round(max(2,min(h,220)),1),known,int(w.get('id')),coords])
            else: groups['land'].append([land,int(w.get('id')),coords])
    ids={'14078180443':('Pendhar Metro','Metro station'),'6568083144':('Taloje Panchanand','Railway station'),
         '7663521043':('Sai Clinic','Healthcare'),'678725500':('Tondhare','Village'),
         '10837083874':('Taloja Phase I','Neighborhood')}
    places=[dict(id=i,name=name,kind=kind,xy=xy[i]) for i,(name,kind) in ids.items()]
    creek=[(x,z) for _,way,coords in groups['waterways'] if way==778610884 for x,z in zip(coords[::2],coords[1::2])]
    if creek:
        places.append(dict(id='way-778610884',name='Taloje Creek',kind='Mapped stream',xy=min(creek,key=lambda p:math.hypot(*p))))
    groups.update(dict(places=places,origin=PIN,extent=[LEFT,TOP,RIGHT,BOTTOM],attribution='© OpenStreetMap contributors, ODbL 1.0',license='https://opendatacommons.org/licenses/odbl/1-0/'))
    print({k:len(v) for k,v in groups.items() if isinstance(v,list)},flush=True)
    save('map.json',groups)

if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor() as pool:
        jobs=[pool.submit(fn) for fn in (satellite,terrain,extract)]
        for job in jobs: job.result()


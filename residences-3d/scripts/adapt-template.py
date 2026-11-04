from pathlib import Path
import re
d=Path(__file__).resolve().parents[1]/'dist'
p=d/'index.html';s=p.read_text(encoding='utf-8')
s=s.replace('World Dreams','Sai Sun City').replace('WORLD DREAMS','SAI SUN CITY').replace('world-dreams','sun-city').replace('A WORLD WITHIN YOUR WORLD','AN ADDRESS TO RISE & SHINE')
s=s.replace('assets/sai-sun-city-logo.png','assets/sai-sun-city-logo.png').replace('Dombivli','Upper Kharghar')
s=s.replace('eight residential towers with G+35 storeys','G+32 residential towers').replace('tiered green cupolas','green rooftop domes').replace('V.04','V.01')
s=s.replace('The clubhouse</span>','Club Atlantis</span>').replace('Pool & terrace</span>','Club Golden Dunes & pool</span>')
s=s.replace('A world. <br>In every dimension.','Rise. Shine.<br>Explore every dimension.')
s=s.replace('<span>SAI SUN CITY<small>','<span>SAI SUN CITY<small>')
s=s.replace('<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M5 32V13l10-6v25m5 0V17l8-5v20m5 0V21l5-3v14M2 34h38"/></svg>','<img src="assets/sai-sun-city-logo.png" alt="Sai Sun City logo" class="brand-logo">')
s=s.replace('Reconstructed exterior study. Exterior geometry is approximate. Floor drawings come from the supplied plan PDF. The brochure lists G+32 residential towers.','Reference-based 3D study. Building dimensions are approximate. Typical plans come from the supplied PDF; individual floor assignments are unconfirmed. The brochure lists G+32 storeys.')
s=s.replace('<link rel="stylesheet" href="tower-elevation.css?v=blender-1">','<link rel="stylesheet" href="tower-elevation.css?v=sun-city-1"><link rel="stylesheet" href="sun-city.css">')
s=s.replace('app.js?v=blender-1','app.js?v=sun-city-1').replace('floor-plans.js?v=furnished-2','floor-plans.js?v=sun-city-1')
p.write_text(s,encoding='utf-8')

p=d/'scene-optimization.js';s=p.read_text();s=s.replace("import {TOWER_FOOTPRINTS} from './tower-footprints.js';",'')
s=s[:s.index('export function createPickingScene')]
s=s.replace("o.material.transparent)return;","o.material.transparent||o.name==='Plan-shaped facade with projecting wings and recessed courts')return;")
p.write_text(s)

p=d/'model.js';s=p.read_text();s=s.replace("batch(land,leaves,material(0x497039),'Palm fronds')","batch(land,leaves,material(0x497039),unit,'Palm fronds')");p.write_text(s)

p=d/'floor-plans.js';s=p.read_text()
s=s.replace("building.id==='breeze'&&[7,12,17,22,27,32].includes(floor)","false")
s=s.replace("building.id==='breeze'?'Residential plans available for floors 6–35.':'Typical and refuge drawings available. Floor assignments are not specified.'","'Typical plan available. The source does not specify floor assignments.'")
s=s.replace("'Eight residential towers · brochure page 14'","'16 named towers · 3 supplied typical layouts'")
s=s.replace("$('#plan-kind-label').hidden=building.id==='breeze'||!current.available;","$('#plan-kind-label').hidden=true;")
s=s.replace('World Dreams Business Park','Sai Sun City').replace('A Business Park floor plan is unavailable.','Select a residential tower or open the commercial references.')
p.write_text(s)

p=d/'walk-navigation.js';s=p.read_text();start=s.index('export const ZONES=');end=s.index('export function isWalkable')
s=s[:start]+'''const px=156,pz=-62.4,gx=-7.2,gz=-6;
export const ZONES={
 pool:{title:'Club Golden Dunes pool terrace',bounds:[px-17,px+17,pz-11,pz+11],start:[px+14,pz+8],look:[px,pz],floor:1.86},
 garden:{title:'The garden courtyard',bounds:[gx-37,gx+37,gz-5.2,gz+5.2],start:[gx-32,gz+4.4],look:[gx,gz],floor:1.42},
};
export const TOUR_ROUTES={
 pool:[[px+14,pz+8],[px+14,pz-8],[px-14,pz-8],[px-14,pz+8],[px+14,pz+8]],
 garden:[[gx-32,gz+4.4],[gx-20,gz+4.4],[gx,gz+4.4],[gx+30,gz+4.4],[gx+30,gz-4.4],[gx,gz-4.4],[gx-32,gz-4.4]],
};
export function walkFloor(zone){return ZONES[zone].floor;}
'''+s[end:]
s=s.replace("x>-20.5-r&&x<20.5+r&&z>56.8-r&&z<71.2+r","x>px-11.5-r&&x<px+11.5+r&&z>pz-5-r&&z<pz+5+r")
s=s.replace("Math.hypot(x,z-24)<5.4+r","Math.hypot(x-gx,z-gz)<2.1+r")
p.write_text(s)

p=d/'walkthrough-controller.js';s=p.read_text();s=s.replace("const look=zone==='pool'?[0,y+.4,55]:[0,y+1,14];","const look=[ZONES[zone].look[0],y+.2,ZONES[zone].look[1]];")
old="let lx=0,lz=this.zone==='pool'?60:-30,ly=this.zone==='pool'?15.2:4.6;if(this.zone==='pool'&&this.position.z<59){lz=66;ly=13.4;}"
s=s.replace(old,"let lx=ZONES[this.zone].look[0],lz=ZONES[this.zone].look[1],ly=ZONES[this.zone].floor+1.5;")
s=s.replace('world-dreams-','sai-sun-city-');p.write_text(s)

p=d/'tower-elevation.js';s=p.read_text();s=s.replace("'Typical and refuge layouts · floor assignment unconfirmed'","'Typical layout · floor assignment unconfirmed'")
s=s.replace("const mid=(commercial?57:54)+mesh.position.y;","const bounds=new T.Box3().setFromObject(mesh);\n    const mid=(bounds.min.y+bounds.max.y)/2;")
s=s.replace("const span=Math.max(commercial?103:117,52*h/w);","const span=Math.max((bounds.max.y-bounds.min.y)*1.10,36*h/w);")
s=s.replace('2.7','2.85').replace('base-98.5','base-95.2')
p.write_text(s)
print('Sun City branding, floor schedule notices, elevation and walking routes adapted.')

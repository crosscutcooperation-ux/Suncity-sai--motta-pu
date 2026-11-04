// Deliberately bounded outdoor walking zones. No unseen interiors are implied.
export const EYE_HEIGHT=1.65;
const px=156,pz=-62.4,gx=-7.2,gz=-6;
export const ZONES={
 pool:{title:'Club Golden Dunes pool terrace',bounds:[px-17,px+17,pz-11,pz+11],start:[px+14,pz+9.8],look:[px,pz],floor:1.86},
 garden:{title:'The garden courtyard',bounds:[gx-37,gx+37,gz-5.2,gz+5.2],start:[gx-32,gz+4.4],look:[gx,gz],floor:1.42},
};
export const TOUR_ROUTES={
 pool:[[px+14,pz+9.8],[px+14,pz-9.8],[px-14,pz-9.8],[px-14,pz+9.8],[px+14,pz+9.8]],
 garden:[[gx-32,gz+4.4],[gx-20,gz+4.4],[gx,gz+4.4],[gx+30,gz+4.4],[gx+30,gz-4.4],[gx,gz-4.4],[gx-32,gz-4.4]],
};
export function walkFloor(zone){return ZONES[zone].floor;}
export function isWalkable(zone,x,z,obstacles=[]){
  const b=ZONES[zone].bounds,r=.38;
  if(x<b[0]+r||x>b[1]-r||z<b[2]+r||z>b[3]-r)return false;
  if(zone==='pool'&&x>px-11.5-r&&x<px+11.5+r&&z>pz-5-r&&z<pz+5+r)return false;
  if(zone==='garden'&&Math.hypot(x-gx,z-gz)<2.1+r)return false;
  for(const a of obstacles){if(a.zone!==zone)continue;if(a.r!==undefined){if(Math.hypot(x-a.x,z-a.z)<a.r+r)return false;}else if(Math.abs(x-a.x)<a.w/2+r&&Math.abs(z-a.z)<a.d/2+r)return false;}
  return true;
}
export function moveWithin(zone,p,dx,dz,obstacles=[]){
  const result={x:p.x,z:p.z};const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.2));
  for(let i=0;i<steps;i++){const x=result.x+dx/steps,z=result.z+dz/steps;if(isWalkable(zone,x,z,obstacles)){result.x=x;result.z=z;}else{if(isWalkable(zone,x,result.z,obstacles))result.x=x;if(isWalkable(zone,result.x,z,obstacles))result.z=z;}}
  return result;
}
export function nearestWalkable(zone,x,z,obstacles=[]){
  if(isWalkable(zone,x,z,obstacles))return{x,z};
  for(let r=.6;r<35;r+=.6)for(let i=0;i<32;i++){const a=i*Math.PI/16,nx=x+Math.cos(a)*r,nz=z+Math.sin(a)*r;if(isWalkable(zone,nx,nz,obstacles))return{x:nx,z:nz};}
  return null;
}
class Heap{constructor(){this.a=[];}push(v){const a=this.a;a.push(v);let i=a.length-1;while(i){let p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}pop(){const a=this.a,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=last.f)break;a[i]=a[c];i=c;}a[i]=last;}return first;}get length(){return this.a.length;}}
function clearSegment(zone,a,b,obstacles){const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.25);for(let i=0;i<=n;i++)if(!isWalkable(zone,a.x+(b.x-a.x)*i/(n||1),a.z+(b.z-a.z)*i/(n||1),obstacles))return false;return true;}
export function findWalkPath(zone,start,end,obstacles=[]){
  if(!isWalkable(zone,start.x,start.z,obstacles)||!isWalkable(zone,end.x,end.z,obstacles))return[];
  if(clearSegment(zone,start,end,obstacles))return[end];
  const b=ZONES[zone].bounds,cell=.8,nx=Math.ceil((b[1]-b[0])/cell),nz=Math.ceil((b[3]-b[2])/cell),point=(x,z)=>({x:b[0]+x*cell,z:b[2]+z*cell}),grid=p=>({x:Math.round((p.x-b[0])/cell),z:Math.round((p.z-b[2])/cell)});
  const s=grid(start),e=grid(end),key=(x,z)=>x+z*nx,open=new Heap(),cost=new Map(),parents=new Map(),closed=new Set(),passable=new Map();
  const valid=(x,z)=>{if(x<0||z<0||x>=nx||z>=nz)return false;const k=key(x,z);if(!passable.has(k)){const p=point(x,z);passable.set(k,isWalkable(zone,p.x,p.z,obstacles));}return passable.get(k);};
  if(!valid(s.x,s.z)||!valid(e.x,e.z))return[];
  open.push({...s,f:0});cost.set(key(s.x,s.z),0);
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while(open.length){const c=open.pop(),ck=key(c.x,c.z);if(closed.has(ck))continue;closed.add(ck);if(c.x===e.x&&c.z===e.z){const raw=[end];let k=ck;while(parents.has(k)){const p=parents.get(k);raw.push(point(p.x,p.z));k=key(p.x,p.z);}raw.reverse();const result=[];let at=start,i=0;while(i<raw.length){let j=raw.length-1;while(j>i&&!clearSegment(zone,at,raw[j],obstacles))j--;if(!clearSegment(zone,at,raw[j],obstacles))return[];result.push(raw[j]);at=raw[j];i=j+1;}return result;}
    for(const[dX,dZ]of dirs){const x=c.x+dX,z=c.z+dZ;if(!valid(x,z)||!valid(c.x+dX,c.z)||!valid(c.x,c.z+dZ))continue;const k=key(x,z),g=cost.get(ck)+Math.hypot(dX,dZ);if(g>=(cost.get(k)??Infinity))continue;cost.set(k,g);parents.set(k,{x:c.x,z:c.z});open.push({x,z,f:g+Math.hypot(x-e.x,z-e.z)});}
  }
  return[];
}

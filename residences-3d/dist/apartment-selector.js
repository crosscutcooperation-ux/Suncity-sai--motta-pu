import {UnitReveal} from './unit-reveal.js?v=furnished-2';
const NS='http://www.w3.org/2000/svg';
const $=id=>document.getElementById(id);
const color=type=>type.startsWith('3')?'#e6a248':type.startsWith('2.5')?'#b696e5':type.startsWith('2')?'#80b46b':'#57a3db';
export class ApartmentSelector{
  constructor({select,toggle}){
    this.select=select;this.toggle=toggle;this.token=0;
    this.host=$('plan-2d');this.drawing=$('plan-drawing');this.image=$('floor-plan-image');this.svg=$('apartment-hotspots');
    this.reveal=new UnitReveal(this.image);
    new ResizeObserver(()=>this.fit()).observe(this.host);
    this.image.onload=()=>this.fit();
    this.image.onclick=()=>{if(this.unit)this.toggle();};
    this.image.onkeydown=e=>{if(this.unit&&['Enter',' '].includes(e.key)){e.preventDefault();this.toggle();}};
    $('apartment-back').onclick=()=>this.showUnit(null);
    $('floor-plan-dialog').addEventListener('cancel',e=>{if(this.unit){e.preventDefault();this.showUnit(null);}});
  }
  clear(){
    this.reveal.setPair(null);
    this.token++;this.unit=null;this.data=null;this.svg.replaceChildren();$('apartment-list').replaceChildren();
    $('apartment-legend').replaceChildren();$('apartment-summary').textContent='';
    $('floor-plan-dialog').classList.remove('apartment');this.image.removeAttribute('tabindex');
  }
  async load(key,context){
    const request=++this.token;this.key=key;this.context=context;
    $('apartment-summary').textContent='Preparing the apartment layout…';
    try{
      const response=await fetch('assets/plans/'+key+'-units.json');
      if(!response.ok)throw new Error('Apartment data unavailable');
      const data=await response.json();if(request!==this.token)return;
      this.data=data;this.render();this.fit();
    }catch(error){
      if(request===this.token)$('apartment-summary').textContent='The original drawing is available. Apartment selection could not load.';
    }
  }
  fit(){
    const w=this.unit?this.image.naturalWidth:this.data?.width,h=this.unit?this.image.naturalHeight:this.data?.height;
    if(!w||!h)return;
    const padding=getComputedStyle(this.host);
    const availableWidth=this.host.clientWidth-parseFloat(padding.paddingLeft)-parseFloat(padding.paddingRight);
    const availableHeight=this.host.clientHeight-parseFloat(padding.paddingTop)-parseFloat(padding.paddingBottom);
    const scale=Math.min(availableWidth/w,availableHeight/h);
    this.drawing.style.width=w*scale+'px';this.drawing.style.height=h*scale+'px';
  }
  showUnit(unit){
    this.unit=unit;$('floor-plan-dialog').classList.toggle('apartment',Boolean(unit));
    this.image.src='assets/plans/'+(unit?(unit.renderPair?unit.renderPair+'-flat.webp':unit.key+'-2d.png'):this.key+'-floor.png');
    this.reveal.setPair(unit?.renderPair,unit?.renderPhoto);
    this.image.alt=unit?this.context.building+', apartment '+unit.id+', '+unit.type+', original 2D floor plan':this.context.building+', selectable floor plan';
    this.svg.toggleAttribute('hidden',Boolean(unit));
    if(unit){
      this.image.tabIndex=0;
      $('apartment-level').textContent=this.context.building+' / LEVEL '+String(this.context.floor).padStart(2,'0');
      $('apartment-type').textContent=unit.type;
      $('apartment-number').textContent='APARTMENT '+unit.id;
    }else this.image.removeAttribute('tabindex');
    this.select(unit);this.fit();
    if(unit)$('apartment-back').focus({preventScroll:true});
  }
  render(){
    const data=this.data;
    this.svg.setAttribute('viewBox','0 0 '+data.width+' '+data.height);
    this.svg.removeAttribute('hidden');this.svg.replaceChildren();
    const counts=new Map();
    for(const unit of data.units){
      const type=unit.type.split(' · ')[0];counts.set(type,(counts.get(type)??0)+1);
      const g=document.createElementNS(NS,'g');g.setAttribute('role','button');g.setAttribute('tabindex','0');
      g.setAttribute('aria-label','Apartment '+unit.id+' · '+unit.type);g.style.setProperty('--unit-color',color(unit.type));
      const path=document.createElementNS(NS,'path');
      path.setAttribute('d',unit.polygons.map(p=>'M'+p.map(x=>x.join(',')).join('L')+'Z').join(''));
      const text=document.createElementNS(NS,'text');text.setAttribute('x',unit.center[0]);text.setAttribute('y',unit.center[1]);
      text.textContent=unit.id;g.append(path,text);
      g.onclick=()=>this.showUnit(unit);
      g.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();this.showUnit(unit);}};
      this.svg.append(g);
      const button=document.createElement('button');button.type='button';button.style.setProperty('--unit-color',color(unit.type));
      button.textContent=unit.id+' · '+unit.type;button.onclick=()=>this.showUnit(unit);
      button.onpointerenter=()=>g.classList.add('highlight');button.onpointerleave=()=>g.classList.remove('highlight');
      $('apartment-list').append(button);
    }
    $('apartment-summary').textContent=data.units.length+' residences · '+data.kind+' layout'+(this.context.available?'':' reference');
    $('apartment-legend').replaceChildren();
    for(const [type,count] of counts){
      const label=document.createElement('span');label.style.setProperty('--unit-color',color(type));label.textContent=count+' × '+type;
      $('apartment-legend').append(label);
    }
  }
}

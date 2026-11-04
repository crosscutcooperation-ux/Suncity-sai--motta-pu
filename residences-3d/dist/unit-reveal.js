/** Reversible registered-image transition, with the timings of the reference viewer. */
export class UnitReveal {
  constructor(flat){
    this.flat=flat;
    this.solid=new Image();
    this.solid.className='unit-cutaway';
    this.solid.alt='';
    this.solid.hidden=true;
    flat.after(this.solid);
    this.progress=0;
  }
  setPair(key,photo=null){
    cancelAnimationFrame(this.frame);
    this.key=key;this.progress=0;this.destination=0;
    this.flat.style.opacity='';
    this.flat.style.transform='';
    this.solid.hidden=true;
    if(key) this.solid.src='assets/plans/'+(photo??key+'-furnished.webp');
  }
  async show(solid){
    const key=this.key,target=Number(solid);
    this.destination=target;
    if(!key)return;
    if(solid){
      await this.solid.decode();
      if(key!==this.key||this.destination!==target)return;
    }
    cancelAnimationFrame(this.frame);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration=reduced?320:1400;
    const start=performance.now(),from=this.progress;
    const step=now=>{
      const distance=(now-start)/duration*(solid?1:1.25);
      this.progress=solid?Math.min(1,from+distance):Math.max(0,from-distance);
      this.paint(reduced);
      if(this.progress!==target)this.frame=requestAnimationFrame(step);
    };
    this.frame=requestAnimationFrame(step);
  }
  paint(reduced){
    const t=this.progress*1.4;
    const clamp=n=>Math.max(0,Math.min(1,n));
    const ease=(x,p)=>x<.5?Math.pow(2*x,p)/2:1-Math.pow(2*(1-x),p)/2;
    const build=reduced?1:ease(clamp((t-.05)/1.05),2);
    const tilt=reduced?0:1-clamp((t-.05)/1.05);
    this.solid.hidden=this.progress===0;
    this.solid.style.setProperty('--build',String(build));
    this.solid.style.opacity=reduced?this.progress:1-(1-clamp((t-.05)/.35))**2;
    this.solid.style.filter='blur('+(reduced?0:6*(1-clamp((t-.05)/.55))**3)+'px)';
    const shift=tilt===0?0:2**(-10*(1-tilt));
    this.solid.style.transform='translateY('+shift+'%) scale('+(1-.015*shift)+') rotateX('+4*shift+'deg)';
    this.flat.style.opacity=reduced?1-this.progress:1-ease(clamp((t-.6)/.72),3);
    const retreat=reduced?0:1-(1-clamp((t-.45)/.95))**3;
    this.flat.style.transform='scale('+(1+.015*retreat)+') rotateX('+(-2*retreat)+'deg)';
  }
}

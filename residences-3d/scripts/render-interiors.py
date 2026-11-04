"""Render furnished unit cutaways in background Blender using the supplied unit-sheet coordinates."""
from pathlib import Path
import json,math,tempfile,sys
import bpy
from mathutils import Vector
import numpy as np

root=Path(__file__).resolve().parents[1]
work=root.parent/"source-assets/interior-work"
out=root/"dist/assets/plans"

def material(name,color,rough=.6):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get("Principled BSDF");bs.inputs["Base Color"].default_value=m.diffuse_color
    bs.inputs["Roughness"].default_value=rough
    return m

def trace(name,rings,height,base,side,cap):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='2D';curve.fill_mode='BOTH';curve.extrude=height/2
    for ring in rings:
        if len(ring)<3:continue
        spline=curve.splines.new('POLY');spline.points.add(len(ring)-1)
        for point,(x,y) in zip(spline.points,ring):point.co=(x*scale,-y*scale,0,1)
        spline.use_cyclic_u=True
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.location.z=base+height/2
    bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.convert(target='MESH');obj.select_set(False)
    obj.data.materials.append(side);obj.data.materials.append(cap)
    for poly in obj.data.polygons:
        if poly.normal.z>.8:poly.material_index=1
    return obj

def lamp(name,pos,watts,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=watts;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=pos
    ob.rotation_euler=(center-ob.location).to_track_quat('-Z','Y').to_euler()

def piece(name,x,y,z,w,d,h,mat,rounding=.03):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z+h/2))
    ob=bpy.context.object;ob.name=name;ob.dimensions=(max(w,.01),max(d,.01),max(h,.01))
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(mat)
    mod=ob.modifiers.new("Soft edges","BEVEL");mod.width=rounding;mod.segments=4
    mod=ob.modifiers.new("Shaded edges","WEIGHTED_NORMAL")
    return ob

def textile(mat,tone):
    nodes=mat.node_tree.nodes;links=mat.node_tree.links
    shader=nodes.get('Principled BSDF')
    n=nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=185;n.inputs['Detail'].default_value=2
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.2;bump.inputs['Distance'].default_value=.009
    links.new(n.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],shader.inputs['Normal'])
    shader.inputs['Sheen Weight'].default_value=.32
    ramp=nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=(*[c*.78 for c in tone],1);ramp.color_ramp.elements[1].color=(*tone,1)
    links.new(n.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs[0],shader.inputs['Base Color'])

def pillow(name,x,y,z,w,h,depth,mat):
    # Rounded superellipsoid with a pinched perimeter and shallow cloth creases.
    verts=[];faces=[];rows=20;cols=40
    def power(n,p):return math.copysign(abs(n)**p,n)
    for r in range(rows+1):
        lat=-math.pi/2+math.pi*r/rows
        for c in range(cols):
            lon=c*2*math.pi/cols
            a=power(math.cos(lat),.52)*power(math.cos(lon),.42)
            b=power(math.cos(lat),.52)*power(math.sin(lon),.42)
            fold=.008*math.sin(17*a+6*b)*(abs(a)**4+abs(b)**6)
            verts.append((x+w*a/2,y+h*b/2,z+depth*(1+power(math.sin(lat),.68))/2+fold))
    for r in range(rows):
        for c in range(cols):
            i=r*cols+c;j=r*cols+(c+1)%cols;faces.append((i,j,j+cols,i+cols))
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.materials.append(mat)
    for f in m.polygons:f.use_smooth=True
    ob=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(ob);return ob

def oval(name,x,y,z,w,d,h,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=(x,y,z))
    ob=bpy.context.object;ob.name=name;ob.scale=(w/2,d/2,h/2);ob.data.materials.append(mat)
    for f in ob.data.polygons:f.use_smooth=True
    return ob

def greenery(x,y,z):
    oval("Stone planter",x,y,z+.045,.16,.16,.10,ivory)
    for i in range(12):
        angle=i*2.4;r=.042+.006*(i%4)
        leaf=oval("Olive leaf",x+math.cos(angle)*r,y+math.sin(angle)*r,z+.12+.015*(i%3),.038,.105,.029,sage)
        leaf.rotation_euler=(.28,0,angle)

def blanket(cx,cy,z,w,h,mat,across):
    rows,cols=30,36;verts=[];faces=[]
    for j in range(rows+1):
        v=j/rows-.5
        for i in range(cols+1):
            u=i/cols-.5
            a,b=(u,v) if across else (v,u)
            edge=max(abs(u)*2,abs(v)*2)
            drape=.09*max(0,(edge-.82)/.18)**1.7
            # Fine linen folds run across the bed and gather beside the mattress.
            folds=(.007+.015*abs(b)*2)*math.sin(25*a+4*math.sin(4*b)+3*b)
            verts.append((cx+w*u,cy+h*v,z-drape+folds+.008*math.cos(39*b+4*a)))
    for j in range(rows):
        for i in range(cols):
            n=j*(cols+1)+i;faces.append((n,n+1,n+cols+2,n+cols+1))
    mesh=bpy.data.meshes.new('Woven linen');mesh.from_pydata(verts,[],faces);mesh.materials.append(mat)
    for f in mesh.polygons:f.use_smooth=True
    ob=bpy.data.objects.new('Draped bed linen',mesh);bpy.context.collection.objects.link(ob)
    hem=ob.modifiers.new('Folded hem','SOLIDIFY');hem.thickness=.012

def furnish(kind,x,y,w,h,index):
    cx=(x+w/2)*scale;cy=-(y+h/2)*scale;w*=scale;h*=scale
    def part(name,dx,dy,z,width,depth,height,mat,r=.035):
        return piece(name,cx+dx,cy+dy,z,width,depth,height,mat,r)
    if kind=="b":
        # On these sheets balcony-side bedrooms have headboards along distinct walls.
        heads={"p2-06":"RR","p2-07":"LL","p2-04":"BBB","p4-02":"R",
               "p4-10":"BB","p4-04":"TTB","p6-02":"TBB","p6-04":"LRR",
               "p6-06":"TTB","p8-02":"TTB","p8-08":"LLR","p8-06":"TTB",
               "p13-09":"R","p13-07":"B","p13-01":"TL","p13-05":"BB","p13-08":"BBT"}
        direction=job.get('bedHeads','TTTT')[index]
        if 'basis' in job:
            coords={'L':(-1,0),'R':(1,0),'T':(0,-1),'B':(0,1)}
            target=tuple(np.array(job['basis'])@coords[direction])
            direction=next(d for d,v in coords.items() if v==target)
        side=direction in "LR";sign=1 if direction in "RT" else -1
        part("Walnut upholstered base",0,0,.07,w,h,.27,oak)
        part("Piped mattress",0,0,.32,w*.98,h*.98,.21,linen,.075)
        hx=sign*w*.5 if side else 0;hy=0 if side else sign*h*.5
        part("Upholstered headboard",hx,hy,.08,.095 if side else w+.12,h+.12 if side else .095,.78,upholstery)
        blanket(cx-hx*.26,cy-hy*.26,.62,w*(.74 if side else 1.02),h*(1.02 if side else .74),linen,side)
        blanket(cx-hx*.62,cy-hy*.62,.652,w*(.23 if side else 1.025),h*(1.025 if side else .23),sage,side)
        for k in (-1,1):
            pillow("Tailored pillow",cx+hx*.69+(0 if side else k*w*.235),cy+hy*.69+(k*h*.235 if side else 0),.53,
                 w*(.23 if side else .44),h*(.44 if side else .23),.22,ivory)
    elif kind=="s":
        horizontal=w>h
        part("Sofa plinth",0,0,.07,w*.96,h*.96,.18,oak)
        part("Upholstered sofa frame",0,0,.24,w,h,.22,upholstery,.065)
        seats=max(1,round(max(w,h)/.68))
        for i in range(seats):
            offset=(i+.5)/seats-.5
            part("Seat cushion",w*offset if horizontal else .03,0 if horizontal else h*offset,.43,
                 w/seats-.02 if horizontal else w*.8,h*.8 if horizontal else h/seats-.02,.17,ivory,.055)
        part("Sofa back",0 if horizontal else -w*.42,h*.39 if horizontal else 0,.42,
             w if horizontal else w*.19,h*.19 if horizontal else h,.43,upholstery,.06)
        for end in (-1,1):
            part("Padded armrest",end*w*.46 if horizontal else 0,0 if horizontal else end*h*.46,.40,
                 w*.075 if horizontal else w,h if horizontal else h*.075,.27,ivory,.055)
    elif kind=="coffee":
        part("Coffee table",0,0,.34,w,h,.055,marble)
        part("Walnut pedestal",0,0,.015,w*.67,h*.67,.325,oak)
        greenery(cx,cy,.395)
    elif kind=="t":
        long=w>=h
        tw=w*.70;th=h*.70
        for i in (-1,1):
            for j in (-1,1):
                part("Table leg",i*tw*.41,j*th*.38,.02,.05,.05,.69,oak)
        part("Marble dining top",0,0,.71,tw,th,.065,marble)
        for k in (-1,1):
            for q in (-1,1):
                dx=q*tw*.25 if long else k*w*.39;dy=k*h*.39 if long else q*th*.25
                cw=min(.43,w*.29);ch=min(.43,h*.28)
                part("Dining chair",dx,dy,.36,cw,ch,.09,upholstery)
                part("Chair back",dx+(0 if long else k*cw*.45),dy+(k*ch*.45 if long else 0),.40,
                     cw if long else .045,.045 if long else ch,.38,oak)
        greenery(cx,cy,.78)
    elif kind=="wc":
        long=h>w
        oval("Vitreous china bowl",cx,cy,.27,w*.93,h*.86,.42,ivory)
        oval("Recessed bowl",cx,cy,.46,w*.67,h*.65,.04,basin)
        oval("Bowl interior",cx,cy,.482,w*.46,h*.48,.018,ivory)
    elif kind=="basin":
        part("Vanity cabinet",0,0,.0,w,h,.62,oak)
        oval("Ceramic basin",cx,cy,.66,w,h,.16,ivory)
        oval("Washbasin recess",cx,cy,.735,w*.69,h*.67,.025,basin)
    elif kind=="door":
        door=part("Open oak door",0,0,0,w,h,1.12,oak,.012)
        door.rotation_euler.z=math.radians(35)
        part("Brushed door handle",w*.30,0,.63,.08,.055,.035,basin,.008)
    elif kind=="rail":
        part("Balcony glazing",0,0,.015,w,h,.56,glazing,.009)
        part("Brushed rail",0,0,.57,w+.012,h+.012,.032,basin,.008)
    elif kind=="k":
        part("Kitchen cabinets",0,0,.03,w,h,.80,oak)
        top=part("Stone worktop",0,0,.83,w+.02,h+.02,.045,printed,.012)
        # Project the actual drawn sink and burners onto the countertop.
        uv=top.data.uv_layers.active
        for loop in top.data.loops:
            pt=top.matrix_world@top.data.vertices[loop.vertex_index].co
            uv.data[loop.index].uv=(pt.x/(W*scale),1+pt.y/(H*scale))
    # Bathroom fittings and sanitaryware on the published drawing stay visible at floor level.
def uvmap(mesh):
    uv=mesh.uv_layers.active or mesh.uv_layers.new()
    uv.active_render=True
    for loop in mesh.loops:
        x,y,_=mesh.vertices[loop.vertex_index].co
        uv.data[loop.index].uv=(x/(W*scale),1+y/(H*scale))

def gpu(scene):
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='OPTIX';prefs.get_devices()
        devices=[d for d in prefs.devices if d.type=='OPTIX']
        if devices:
            for d in prefs.devices:d.use=d in devices
            scene.cycles.device='GPU'
    except (TypeError,RuntimeError):pass

for job in sorted(json.loads((work/("registered.json" if "--registered" in sys.argv else "jobs.json")).read_text()),key=lambda j:not j.get('fullFloor',False)):
    key=job["key"]
    if "--only" in sys.argv and key not in sys.argv[sys.argv.index("--only")+1:]:continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    W,H=job['width'],job['height']
    bed=next(rect for rect in job['items'] if rect[0]=='b')
    scale=2.04/max(bed[3:]);center=Vector((W*scale/2,-H*scale/2,0))
    wall=material('Limestone plaster',(.66,.60,.51))
    graphite=material('Graphite wall cap',(.037,.047,.053),.35)
    oak=material('Oak joinery',(.41,.28,.17));upholstery=material('Ivory upholstery',(.58,.52,.44))
    printed=material('Furnishings and finishes from the architect sheet',(1,1,1))
    image=printed.node_tree.nodes.new('ShaderNodeTexImage');image.image=bpy.data.images.load(str(work/(key+'.png')))
    printed.node_tree.links.new(image.outputs['Color'],printed.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    finish=material('Ivory stone and oak floors',(1,1,1),.38)
    finish_image=finish.node_tree.nodes.new('ShaderNodeTexImage');finish_image.image=bpy.data.images.load(str(work/(key+'-finish.png')))
    finish.node_tree.links.new(finish_image.outputs['Color'],finish.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    slab=trace('Apartment floor',[job['outline']],.16,-.16,wall,finish);uvmap(slab.data)
    trace('Partition walls',job['walls'],1.28,0,wall,graphite)
    linen=material('Cotton percale',(.82,.79,.72))
    ivory=material('Ivory linen',(.9,.87,.80))
    sage=material('Muted olive weave',(.35,.39,.31))
    marble=material('Warm white marble',(.82,.79,.72),.30)
    noise=marble.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=6
    ramp=marble.node_tree.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.38;ramp.color_ramp.elements[0].color=(.48,.46,.42,1)
    ramp.color_ramp.elements[1].position=.46;ramp.color_ramp.elements[1].color=(.92,.9,.83,1)
    marble.node_tree.links.new(noise.outputs[0],ramp.inputs[0]);marble.node_tree.links.new(ramp.outputs[0],marble.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    textile(ivory,(.89,.85,.76));textile(linen,(.82,.78,.71));textile(sage,(.32,.34,.24))
    basin=material('Satin pewter',(.32,.34,.34),.35)
    glazing=material('Balcony glass',(.67,.83,.86),.14)
    glass=glazing.node_tree.nodes.get('Principled BSDF');glass.inputs['Transmission Weight'].default_value=.94
    counts={}
    for kind,*rect in job['items']:
        furnish(kind,*rect,counts.get(kind,0));counts[kind]=counts.get(kind,0)+1
    ink=material('Room label charcoal',(.075,.08,.075),.9)
    for label in job.get('labels',[]):
        curve=bpy.data.curves.new('Room label','FONT');curve.body=label['text'];curve.align_x='CENTER';curve.align_y='CENTER';curve.size=.19 if not job.get('fullFloor') else .22
        ob=bpy.data.objects.new(label['text'],curve);bpy.context.collection.objects.link(ob);ob.location=(label['x']*scale,-label['y']*scale,.025);ob.data.materials.append(ink)
    if '--models' in sys.argv or '--both' in sys.argv:
        bpy.ops.export_scene.gltf(filepath=str(out/(key+'.glb')),export_format='GLB',export_apply=True)
        if '--both' not in sys.argv:continue
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.17))
    bpy.context.object.data.materials.append(material('Warm white studio',(.95,.95,.95)))
    bpy.context.object.is_shadow_catcher=True
    scene=bpy.context.scene;scene.render.film_transparent=True;scene.world=bpy.data.worlds.new('Studio daylight');scene.world.use_nodes=True
    scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.92,.96,1,1)
    scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.40
    lamp('Softbox',center+Vector((-6,5,12)),1050,7)
    lamp('Fill',center+Vector((5,-3,9)),520,6)
    bpy.ops.object.camera_add(location=center+Vector((0,-8,20)))
    cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO';cam.data.ortho_scale=job['side']*scale;scene.camera=cam
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.render.engine='CYCLES';gpu(scene);scene.cycles.samples=48 if job.get('fullFloor') else 32;scene.cycles.use_denoising=True
    scene.render.resolution_x=2560 if job.get('fullFloor') else 1536;scene.render.resolution_y=scene.render.resolution_x;scene.render.resolution_percentage=100
    # Crop the square camera gate and drawing by the same amount to register the pair.
    side=job['side'];pad=.075*max(W,H)
    xfrac=min(1,(W+2*pad)/side);yfrac=min(1,(H+2*pad)/side)
    scene.render.use_border=True;scene.render.use_crop_to_border=True
    scene.render.border_min_x=(1-xfrac)/2;scene.render.border_max_x=(1+xfrac)/2
    scene.render.border_min_y=(1-yfrac)/2;scene.render.border_max_y=(1+yfrac)/2
    scene.render.image_settings.color_mode='RGBA'
    scene.render.image_settings.file_format='WEBP';scene.render.image_settings.quality=94
    bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
    blend_dir=root/('deliverables/floors' if job.get('fullFloor') else 'deliverables/apartments');blend_dir.mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_dir/(key+'.blend')),compress=True)
    scene.render.filepath=str(out/(key+'-furnished.webp'));bpy.ops.render.render(write_still=True)

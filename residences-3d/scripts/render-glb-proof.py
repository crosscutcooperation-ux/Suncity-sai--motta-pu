"""Render orthographic proof directly from the final GLB with OpenGL."""
from pathlib import Path
from PIL import Image
import json,struct,io
import numpy as np
import moderngl as gl
from scipy.spatial.transform import Rotation

root=Path(__file__).resolve().parents[1];out=root/'deliverables'
raw=(out/'sai-sun-city-exterior.glb').read_bytes()
n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);binary=28+n
ctx=gl.create_standalone_context();ctx.enable(gl.DEPTH_TEST)
program=ctx.program(vertex_shader="""#version 330
in vec3 pos;in vec3 normal;in vec2 uv;in mat4 instance;
uniform mat4 vp;uniform mat4 world;out vec2 t;out vec3 norm;
void main(){mat4 m=world*instance;gl_Position=vp*m*vec4(pos,1);norm=normalize(transpose(inverse(mat3(m)))*normal);t=uv;}
""",fragment_shader="""#version 330
in vec3 norm;in vec2 t;uniform vec3 tint;uniform sampler2D tex;uniform int textured;uniform vec2 texScale;uniform vec2 texOffset;out vec4 result;
void main(){vec3 n=normalize(norm);vec3 col=tint;if(textured!=0){col*=pow(texture(tex,t*texScale+texOffset).rgb,vec3(2.2));}
float light=.66+.64*max(0.,dot(n,normalize(vec3(-.55,.84,.50))));result=vec4(pow(clamp(col*light,0.,1.),vec3(1./2.2)),1.);}
""")
def accessor(index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
    k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];s=np.dtype(dtype).itemsize
    return np.ndarray((a['count'],k),dtype=dtype,buffer=raw,offset=binary+v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',k*s),s)).copy()
def transform(node):
    if 'matrix' in node:return np.array(node['matrix']).reshape(4,4).T
    m=np.eye(4);m[:3,:3]=Rotation.from_quat(node.get('rotation',[0,0,0,1])).as_matrix()@np.diag(node.get('scale',[1]*3));m[:3,3]=node.get('translation',[0]*3);return m
def instances(node):
    attrs=node.get('extensions',{}).get('EXT_mesh_gpu_instancing',{}).get('attributes')
    if not attrs:return np.eye(4,dtype='f4')[None]
    values={k:accessor(i) for k,i in attrs.items()};count=len(next(iter(values.values())));matrix=np.repeat(np.eye(4,dtype='f4')[None],count,axis=0)
    if 'ROTATION' in values:matrix[:,:3,:3]=Rotation.from_quat(values['ROTATION']).as_matrix()
    if 'SCALE' in values:matrix[:,:3,:3]*=values['SCALE'][:,None,:]
    if 'TRANSLATION' in values:matrix[:,:3,3]=values['TRANSLATION']
    return matrix
images=[]
for tex in doc['textures']:
    source=doc['images'][tex['source']];v=doc['bufferViews'][source['bufferView']];start=binary+v['byteOffset']
    im=Image.open(io.BytesIO(raw[start:start+v['byteLength']])).convert('RGB')
    tex=ctx.texture(im.size,3,im.tobytes());tex.build_mipmaps();images.append(tex)
white=ctx.texture((1,1),3,bytes([255,255,255]))
def draw_node(index,parent):
    node=doc['nodes'][index];world=parent@transform(node)
    if 'mesh' in node:
        matrices=instances(node).transpose(0,2,1).astype('f4').tobytes()
        for p in doc['meshes'][node['mesh']]['primitives']:
            attrs=p['attributes'];positions=accessor(attrs['POSITION'])
            normals=accessor(attrs['NORMAL']) if 'NORMAL' in attrs else np.repeat([[0,1,0]],len(positions),axis=0)
            uv=accessor(attrs['TEXCOORD_0']) if 'TEXCOORD_0' in attrs else np.zeros((len(positions),2))
            vertices=ctx.buffer(np.column_stack((positions,normals,uv)).astype('f4').tobytes())
            ins=ctx.buffer(matrices);indices=ctx.buffer(accessor(p['indices']).astype('u4').tobytes()) if 'indices' in p else None
            vao=ctx.vertex_array(program,[(vertices,'3f 3f 2f','pos','normal','uv'),(ins,'16f/i','instance')],index_buffer=indices,index_element_size=4)
            mat=doc['materials'][p['material']].get('pbrMetallicRoughness',{})
            info=mat.get('baseColorTexture');details=(info or {}).get('extensions',{}).get('KHR_texture_transform',{})
            program['world'].write(world.T.astype('f4').tobytes());program['tint'].value=mat.get('baseColorFactor',[1,1,1,1])[:3]
            program['textured'].value=int(bool(info));program['texScale'].value=details.get('scale',[1,1]);program['texOffset'].value=details.get('offset',[0,0])
            (images[info['index']] if info else white).use(0)
            vao.render(instances=len(matrices)//64);vao.release();vertices.release();ins.release()
            if indices:indices.release()
    for child in node.get('children',[]):draw_node(child,world)
def render(ids,center,normal,width,name):
    w,h=1400,930;W,H=w*2,h*2;f=ctx.simple_framebuffer((W,H));f.use()
    f.clear(.925,.921,.903,1);eye=np.array(normal,dtype=float);eye/=np.linalg.norm(eye)
    up0=[0,0,-1] if eye[1]>.99 else [0,1,0]
    right=np.cross(up0,eye);right/=np.linalg.norm(right);up=np.cross(eye,right)
    vp=np.eye(4);vp[0,:3]=right*2/width;vp[1,:3]=up*2/(width*h/w);vp[2,:3]=-eye/350
    vp[:3,3]=-vp[:3,:3]@center;program['vp'].write(vp.T.astype('f4').tobytes())
    for i,node in enumerate(doc['nodes']):
        if node.get('extras',{}).get('towerId') in ids:draw_node(i,np.eye(4))
    im=Image.frombytes('RGB',(W,H),f.read(components=3)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    im.resize((w,h),Image.Resampling.LANCZOS).save(out/name);f.release()
    print('Verified GLB render:',name,flush=True)
render({'coral','opal','emerald'},[-5,33,-19.7],[0,0,1],108,'exterior-court-elevation.png')
render({'tower-17','tower-18'},[71,1,20],[0,1,0],92,'exterior-plaza-roofs.png')
render({'tower-17','tower-18'},[71,30,20],[.74,.40,.78],118,'exterior-plaza-perspective.png')


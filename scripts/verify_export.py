"""Check the exported hierarchy and registered facade outlines against the source."""
from pathlib import Path
import json
import struct
import hashlib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    raw = path.read_bytes()
    assert raw[:4] == b'glTF'
    assert struct.unpack_from('<I',raw,8)[0] == len(raw)
    length = struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+length]),raw[28+length:]

def local(node):
    if 'matrix' in node:
        return np.array(node['matrix']).reshape(4,4).T
    x,y,z,w = node.get('rotation',[0,0,0,1])
    r = np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                  [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                  [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    matrix = np.eye(4)
    matrix[:3,:3] = r @ np.diag(node.get('scale',[1,1,1]))
    matrix[:3,3] = node.get('translation',[0,0,0])
    return matrix

def geometry(doc,data):
    towers = {}
    def visit(index,parent,current=None):
        node = doc['nodes'][index]
        world = parent @ local(node)
        extra = node.get('extras',{})
        if 'towerId' in extra:
            current = extra['towerId']
            towers[current] = {'center':world[:3,3], 'floors':extra.get('floors'),'points':[]}
        if current and 'mesh' in node and node.get('name','').startswith('Plan-shaped facade'):
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                a = doc['accessors'][primitive['attributes']['POSITION']]
                v = doc['bufferViews'][a['bufferView']]
                assert a['componentType'] == 5126
                offset = v.get('byteOffset',0)+a.get('byteOffset',0)
                points = np.ndarray((a['count'],3),dtype='<f4',buffer=data,offset=offset,strides=(v.get('byteStride',12),4))
                points = np.column_stack([points,np.ones(len(points))]) @ world.T
                towers[current]['points'].append(points[:,:3])
        for child in node.get('children',[]):
            visit(child,world,current)
    for index in doc['scenes'][doc.get('scene',0)]['nodes']:
        visit(index,np.eye(4))
    return towers

source_doc,source_data = read(ROOT/'sources/baseline.glb')
doc,data = read(ROOT/'Sai Sun City.glb')
before = geometry(source_doc,source_data)
after = geometry(doc,data)
assert set(before) == set(after) and len(after) == 26
position_error = 0
outline_error = 0
for tower_id, result in after.items():
    assert result['floors'] == before[tower_id]['floors'] == 32
    position_error = max(position_error,float(np.max(np.abs(result['center']-before[tower_id]['center']))))
    assert result['points'],f'Missing facade for {tower_id}'
    old = np.concatenate(before[tower_id]['points'])
    new = np.concatenate(result['points'])
    outline_error = max(outline_error,float(np.max(np.abs(old.min(axis=0)-new.min(axis=0)))),float(np.max(np.abs(old.max(axis=0)-new.max(axis=0)))))
assert position_error < .01 and outline_error < .05
assert doc.get('images'), 'The GLB must contain textures'
assert any('roughnessTexture' in json.dumps(m) or 'metallicRoughnessTexture' in json.dumps(m) for m in doc['materials'])
report = {
    'registeredTowers':len(after), 'residentialFloors':32,
    'maximumTowerPositionChange':position_error,'maximumFacadeBoundsChange':outline_error,
    'embeddedImages':len(doc['images']),'nodes':len(doc['nodes']),
    'gpuInstanceGroups':sum('EXT_mesh_gpu_instancing' in n.get('extensions',{}) for n in doc['nodes']),
    'extensions':doc.get('extensionsUsed',[]),'glbBytes':(ROOT/'Sai Sun City.glb').stat().st_size,
    'glbSha256':hashlib.sha256((ROOT/'Sai Sun City.glb').read_bytes()).hexdigest(),
    'verification':'Registered placement and facade bounds retained from the brochure-based baseline. This is a consistency check, not a dimensional survey.'
}
(ROOT/'verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))

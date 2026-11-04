"""Refine and export the Sun City exterior. Run with Blender --background."""
from pathlib import Path
import json
import math
import hashlib
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
scene = bpy.context.scene
towers = [obj for obj in scene.objects if 'towerId' in obj]
assert len(towers) == 26, 'The source must contain all 26 master-layout towers.'

def image(name, non_color=False):
    result = bpy.data.images.load(str(ROOT/'textures'/name),check_existing=True)
    if non_color:
        result.colorspace_settings.name = 'Non-Color'
    return result

day = image('facade-day-base.jpg')
orm = image('facade-orm.png',True)
normal = image('stone-normal.png',True)
stone_shader_count = 0
for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = next((node for node in nodes if node.type == 'BSDF_PRINCIPLED'),None)
    if shader is None:
        continue
    if 'registered balcony masonry' in material.name:
        material.name = 'Sun City | daytime stone and recessed glazing'
        base = next(node for node in nodes if node.type == 'TEX_IMAGE')
        base.image = day
        mask = nodes.new('ShaderNodeTexImage')
        mask.name = 'Estimated glass and masonry response'
        mask.image = orm
        for link in base.inputs['Vector'].links:
            links.new(link.from_socket,mask.inputs['Vector'])
        separate = nodes.new('ShaderNodeSeparateColor')
        links.new(mask.outputs['Color'],separate.inputs['Color'])
        links.new(separate.outputs['Green'],shader.inputs['Roughness'])
        links.new(separate.outputs['Blue'],shader.inputs['Metallic'])
        shader.inputs['Coat Weight'].default_value = .24
        shader.inputs['Coat Roughness'].default_value = .18
        material['estimated'] = 'PBR regions inferred from supplied rendered colours'
    else:
        roughness = shader.inputs['Roughness'].default_value
        metallic = shader.inputs['Metallic'].default_value
        base_color = shader.inputs['Base Color'].default_value
        if metallic > .2 and roughness < .35:
            material.name = 'Sun City | reflective architectural glazing'
            shader.inputs['Roughness'].default_value = .16
            shader.inputs['Metallic'].default_value = .55
            shader.inputs['Coat Weight'].default_value = .35
            shader.inputs['Coat Roughness'].default_value = .12
            shader.inputs['IOR'].default_value = 1.45
        elif roughness > .7 and base_color[0] > base_color[2] and not shader.inputs['Base Color'].is_linked:
            material.name = 'Sun City | honed stone '+str(stone_shader_count+1)
            texture = nodes.new('ShaderNodeTexImage')
            texture.image = normal
            normal_node = nodes.new('ShaderNodeNormalMap')
            normal_node.inputs['Strength'].default_value = .18
            links.new(texture.outputs['Color'],normal_node.inputs['Color'])
            links.new(normal_node.outputs['Normal'],shader.inputs['Normal'])
            shader.inputs['Roughness'].default_value = .74
            stone_shader_count += 1
        elif metallic > .4:
            shader.inputs['Roughness'].default_value = .29
            shader.inputs['Metallic'].default_value = .72

def tower_ancestor(obj):
    current = obj
    while current:
        if 'towerId' in current:
            return current
        current = current.parent
    return None

# Keep only planting on or immediately beside the registered development.
boundary = json.loads((ROOT/'sources/landscape-boundary.json').read_text())
def within_boundary(x,y):
    inside = False
    for i,a in enumerate(boundary):
        b = boundary[(i+1)%len(boundary)]
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:
            inside = not inside
    return inside
removed = []
for obj in list(scene.objects):
    if obj.name == 'Render environment ground':
        removed.append(obj)
    elif obj.type == 'MESH' and tower_ancestor(obj) is None:
        p = obj.matrix_world.translation
        if not within_boundary(p.x,p.y):
            removed.append(obj)
bpy.data.batch_remove(removed)

# The ground follows the supplied parcel shape with a small planting margin.
ground_mesh = bpy.data.meshes.new('Immediate landscape surface')
ground_mesh.from_pydata([(x,y,-.7) for x,y in boundary],[],[list(range(len(boundary)))])
ground_mesh.update()
ground = bpy.data.objects.new('Immediate landscaped ground',ground_mesh)
scene.collection.objects.link(ground)
ground['estimated'] = 'Level ground with approximately ten local units of planting margin beyond the brochure boundary'
mat = bpy.data.materials.get('Sun City | landscape turf')
if mat:
    ground_mesh.materials.append(mat)
uv = ground_mesh.uv_layers.new(name='Ground texture coordinates')
for face in ground_mesh.polygons:
    for loop in face.loop_indices:
        point = ground_mesh.vertices[ground_mesh.loops[loop].vertex_index].co
        uv.data[loop].uv = (point.x*.025,point.y*.025)

beveled = 0
for obj in list(scene.objects):
    if obj.type != 'MESH' or obj.data.users != 1 or not tower_ancestor(obj):
        continue
    if obj.name.startswith('Batched static architecture') and len(obj.data.polygons) < 12000:
        bevel = obj.modifiers.new('Architectural edge highlight','BEVEL')
        bevel.width = .012
        bevel.segments = 1
        bevel.limit_method = 'ANGLE'
        bevel.angle_limit = 1.2
        beveled += 1

for obj in towers:
    obj.name = 'Sun City | '+obj.get('name',obj.name)
    obj['verification'] = 'Footprint and placement retained from brochure registration; heights inferred'

for obj in list(scene.objects):
    if obj.type == 'LIGHT':
        bpy.data.objects.remove(obj,do_unlink=True)
sun_data = bpy.data.lights.new('Soft architectural daylight','SUN')
sun_data.energy = 2.6
sun_data.angle = math.radians(5)
sun = bpy.data.objects.new('Soft architectural daylight',sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = Vector((.7,.6,-1.4)).to_track_quat('-Z','Y').to_euler()
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .7
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.render.resolution_x = 1500
scene.render.resolution_y = 1050
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'

# The selected export excludes the camera rig and studio ground while preserving
# nested tower IDs and named amenity groups for browser object selection.
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type not in {'LIGHT','CAMERA'}:
        obj.select_set(True)
print('EXPORT_BEGIN',flush=True)
bpy.ops.export_scene.gltf(
    filepath=str(ROOT/'Sai Sun City.glb'),export_format='GLB',use_selection=True,
    export_extras=True,export_gpu_instances=True,export_animations=False,
    export_cameras=False,export_lights=False,export_apply=True,
    export_draco_mesh_compression_enable=False,
)
print('EXPORT_SAVED',flush=True)

# Reuse the existing packed HDR but retain only its active image in the source.
for data_image in bpy.data.images:
    if data_image.name.startswith('environment'):
        data_image.filepath = str(ROOT/'textures/daylight.hdr')
bpy.ops.object.select_all(action='DESELECT')
scene.name = 'Sun City | Building exterior'
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version = 0
scene['quality_reference'] = 'Sai World Dream stepped facades and separate PBR glass/masonry response'
scene['source_scope'] = 'Building exterior and immediate landscaping'
scene.camera.data.type = 'ORTHO'
scene.camera.data.ortho_scale = 380
scene.camera.location = (-210,-270,180)
target = Vector((45,-10,24))
scene.camera.rotation_euler = (target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Sai Sun City.blend'),compress=True)

def render(name,position,target,span):
    scene.camera.location = position
    scene.camera.rotation_euler = (Vector(target)-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera.data.ortho_scale = span
    scene.render.filepath = str(ROOT/'previews'/name)
    bpy.ops.render.render(write_still=True)

render('01-overview.png',(-210,-270,180),(45,-10,24),380)
render('02-facade.png',(-131,-103,36),(-86,0,31),110)
render('03-top.png',(48,-10,400),(48,-10,0),370)
(ROOT/'build-report.json').write_text(json.dumps({
    'towerCount':len(towers),'floors':[int(obj.get('floors',0)) for obj in towers],
    'stoneMaterials':stone_shader_count,'beveledMeshes':beveled,
    'distantContextObjectsRemoved':len(removed),
    'sourceBlendSha256':hashlib.sha256((ROOT/'sources/baseline.blend').read_bytes()).hexdigest(),
    'blendSha256':hashlib.sha256((ROOT/'Sai Sun City.blend').read_bytes()).hexdigest(),
    'glbSha256':hashlib.sha256((ROOT/'Sai Sun City.glb').read_bytes()).hexdigest(),
    'mode':'Blender background, Cycles render and native glTF export',
},indent=2))
print('BUILD_AND_RENDER_COMPLETE',flush=True)

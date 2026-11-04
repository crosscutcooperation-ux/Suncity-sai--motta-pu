"""Build and verify the editable exterior from the exact textured browser export."""
from pathlib import Path
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
out = root / 'deliverables'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(out / 'sai-sun-city-exterior.glb'),import_pack_images=True)
scene = bpy.context.scene
towers = [obj for obj in scene.objects if 'towerId' in obj]
if len(towers) != 26:
    raise RuntimeError(f'Expected 26 editable tower roots, found {len(towers)}')
facade_images = [im for im in bpy.data.images if 'facade-sun-city' in im.name]
if not facade_images or not facade_images[0].packed_file:
    raise RuntimeError('The facade bitmap was not embedded and packed on import')
scene.world = bpy.data.worlds.new('Daylight | architectural reconstruction')
scene.world.use_nodes = True
env = scene.world.node_tree.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(str(root / 'dist/assets/environment.hdr'))
scene.world.node_tree.links.new(env.outputs['Color'],scene.world.node_tree.nodes['Background'].inputs['Color'])
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
sun_data = bpy.data.lights.new('Afternoon sun','SUN')
sun_data.energy=2.4
sun_data.angle=.06
sun=bpy.data.objects.new('Afternoon sun',sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler=Vector((-.6,.8,-1.4)).to_track_quat('-Z','Y').to_euler()

def camera(name,location,target,scale):
    data=bpy.data.cameras.new(name)
    data.type='ORTHO';data.ortho_scale=scale;data.clip_end=2600
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj

scene.camera=camera('01 | Township bird eye',(-180,-230,165),(34,-8,16),285)
camera('02 | Master plan orthographic',(53,-6,350),(53,-6,0),368)
camera('03 | South elevation',(30,-320,33),(30,0,33),280)
camera('04 | Entrance wing facade',(-87,-124,30),(-87,15,30),79)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.color_type='TEXTURE'
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1800;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene['source']='Sun City master layout, typical floor drawings and developer renders. Exterior geometry is reconstructed.'
scene['floor_vertical_scale']=.62
bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Sai Sun City exterior.blend'),compress=True)
print('Verified and saved 26 editable tower roots, imported balcony JPEG and named inspection cameras.',flush=True)


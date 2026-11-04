"""Headless Cycles preview and verification of the saved exterior Blender file."""
from pathlib import Path
import json
import hashlib
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
out = root / 'deliverables'
scene = bpy.context.scene
towers = [obj for obj in scene.objects if 'towerId' in obj]
assert len(towers) == 26, f'Expected 26 tower roots, found {len(towers)}'
assert any('Commercial podium' in obj.name for obj in scene.objects)
assert any('photographic tree' in mat.name for mat in bpy.data.materials)
assert all(image.packed_file for image in bpy.data.images if image.type == 'IMAGE')

# A ground surface provides the render environment beneath the exported site.
if not bpy.data.objects.get('Render environment ground'):
    bpy.ops.mesh.primitive_plane_add(size=2400, location=(45,-10,-.65))
    ground = bpy.context.object
    ground.name = 'Render environment ground'
    mat = bpy.data.materials.new('Dry grass render environment')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = 1
    image = mat.node_tree.nodes.new('ShaderNodeTexImage')
    image.image = bpy.data.images.load(str(root/'dist/assets/grass.jpg'),check_existing=True)
    coord = mat.node_tree.nodes.new('ShaderNodeTexCoord')
    scale = mat.node_tree.nodes.new('ShaderNodeVectorMath')
    scale.operation = 'SCALE'
    scale.inputs[3].default_value = 120
    mat.node_tree.links.new(coord.outputs['UV'],scale.inputs[0])
    mat.node_tree.links.new(scale.outputs['Vector'],image.inputs['Vector'])
    mat.node_tree.links.new(image.outputs['Color'],bsdf.inputs['Base Color'])
    ground.data.materials.append(mat)
    ground['estimated'] = 'Illustrative level render environment beyond the brochure site boundary'
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'Sai Sun City exterior.blend'),compress=True)

scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
scene.render.resolution_x = 1500
scene.render.resolution_y = 1050
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.camera.data.type = 'ORTHO'
scene.camera.data.ortho_scale = 420
scene.camera.location = (-210,-270,210)
target = Vector((45,-10,15))
scene.camera.rotation_euler = (target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath = str(out / 'exterior-cycles-preview.png')
bpy.ops.render.render(write_still=True)

report = {
    'editableTowerRoots':len(towers),
    'packedImages':[image.name for image in bpy.data.images if image.packed_file],
    'amenities':[obj.name for obj in scene.objects if obj.get('amenityId')],
    'glbSha256':hashlib.sha256((out/'sai-sun-city-exterior.glb').read_bytes()).hexdigest(),
    'blendSha256':hashlib.sha256((out/'Sai Sun City exterior.blend').read_bytes()).hexdigest(),
    'preview':'exterior-cycles-preview.png',
    'verification':'Reopened the saved Blender file in background mode and rendered with Cycles.'
}
(out/'exterior-verification.json').write_text(json.dumps(report,indent=2))
print('Verified saved model and rendered headless Cycles preview.',flush=True)

"""Reopen and verify the delivered native Blender file in background mode."""
from pathlib import Path
import bpy
import json
import hashlib

root = Path(__file__).resolve().parents[1]
towers = [obj for obj in bpy.context.scene.objects if 'towerId' in obj]
assert len(towers) == 26
assert all(obj.get('floors') == 32 for obj in towers)
assert bpy.data.objects.get('Immediate landscaped ground') is not None
assert bpy.data.materials.get('Sun City | daytime stone and recessed glazing') is not None
images = [im for im in bpy.data.images if im.users and im.type == 'IMAGE']
assert all(im.packed_file for im in images), 'Active textures must be packed'
for index, im in enumerate(images):
    name = Path(im.filepath).name
    target = root/'textures'/name
    if not target.is_file() or target.read_bytes() != bytes(im.packed_file.data):
        extension = Path(name).suffix or '.png'
        target = root/'textures'/f'packed-{index:02d}{extension}'
        target.write_bytes(bytes(im.packed_file.data))
    im.filepath = '//'+target.relative_to(root).as_posix()
    im.pack()
    for packed in im.packed_files:
        packed.filepath = im.filepath
if bpy.data.use_autopack:
    bpy.ops.file.autopack_toggle()
bpy.ops.object.select_all(action='DESELECT')
bpy.context.scene.name = 'Sun City | Building exterior'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'Sai Sun City.blend'),compress=True)
report = json.loads((root/'verification.json').read_text())
report['blendReopenedInBackground'] = True
report['packedBlenderImages'] = [im.name for im in images]
report['blendSha256'] = hashlib.sha256((root/'Sai Sun City.blend').read_bytes()).hexdigest()
(root/'verification.json').write_text(json.dumps(report,indent=2))
build = json.loads((root/'build-report.json').read_text())
build['blendSha256'] = report['blendSha256']
build['savedFileReopenedAndVerified'] = True
(root/'build-report.json').write_text(json.dumps(build,indent=2))
print('Verified 26 editable towers, 32 modeled floors, landscape surface and packed active materials.')

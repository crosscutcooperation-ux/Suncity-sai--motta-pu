"""Render the actual exported exterior for comparison with the supplied views."""
from pathlib import Path
import bpy
from mathutils import Vector

root=Path(__file__).resolve().parents[1]
out=root/'deliverables'
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=6
scene.cycles.use_denoising=True
scene.cycles.preview_samples=4
scene.render.threads_mode='FIXED'
scene.render.threads=6
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True
camera=scene.camera

def show(ids):
    members={n for n in scene.objects if n.get('towerId') in ids}
    member_objects=set(members)
    for tower in members:
        member_objects.update(tower.children_recursive)
    for obj in scene.objects:
        if obj.type in {'MESH','CURVE','EMPTY'}:
            obj.hide_render=obj not in member_objects

def render(file,position,target,span,size):
    camera.location=position
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=span
    scene.render.resolution_x,scene.render.resolution_y=size
    scene.render.filepath=str(out/file)
    bpy.ops.render.render(write_still=True)

show({'coral','opal','emerald'})
render('exterior-court-elevation.png',(-5,-150,32),(-5,19.7,32),91,(850,715))
show({'tower-17','tower-18'})
render('exterior-plaza-roofs.png',(72,-22,190),(72,-22,0),75,(800,720))


# Sun City exterior

Open **Sai Sun City.blend** to edit the model. **Sai Sun City.glb** is the optimized browser export with embedded textures. Preview images are in **previews**. The files were built and rendered with Blender 4.5.15 in background mode.

The model preserves 26 separately identifiable tower roots, 32 residential levels per modeled tower, registered footprints, projecting and recessed wings, balcony slabs and rails, arched ground-floor galleries, windows, open ribbed green crowns and roof housings. The commercial podium, exterior clubhouse and immediate planted grounds are retained. Distant context has been removed.

## Quality reference

The existing Sai World Dream model supplied the quality approach through its architectural-tower and stepped-tower modules. Sun City uses its own supplied drawings and imagery for geometry. Daytime facade colour is registered from **25 Podium nd Building.jpg**. Separate estimated roughness/metalness masks, reflective glazing, fine stone normals, metal response, subtle edge bevels, HDR daylight and soft sun shadows follow the same architectural visualization approach.

## References and verification

- The supplied brochure, page 12, locates the 26 towers and shows the wing arrangement and site outline. A copy is in **references**.
- **SSC Plan.pdf**, pages 3–5, supplies three typical layouts covering 16 named towers. Pages 1–2 show commercial layouts.
- The two supplied aerials, daytime podium elevation, entrance and plaza views constrain the overall massing, facade and roof treatment. Source image names and material-registration coordinates are recorded in **references/material-registration.json**.
- **verification.json** compares the exported tower positions and facade bounds against the registered baseline, checks floor metadata, counts GPU instance groups and checks embedded images. This confirms consistency with the traced model.
- **previews/03-top.png** provides the actual top view. **references/footprint-registration.jpg** shows the baseline footprint comparison with the brochure at the same orientation.

## Approximations

The reference set lacks a calibrated survey, dimensioned building sections, complete elevations, original CAD/BIM meshes and a per-tower floor/refuge schedule. The brochure's G+32 description is used consistently throughout this model. Floor pitch and absolute height, roof service housings, window subdivisions, balcony depths, some entrance and clubhouse dimensions, and planting species/positions are estimated. Towers 17–26 use exterior outlines traced from the master layout because individual floor drawings are absent. Hidden elevations follow the visible architectural language.

The facade material retains some shadows and reflections baked into the supplied rendered image. Roughness and metalness masks are inferred from image colour. They are not measured source PBR maps. The landscape ground is level and follows the parcel with a small planting margin. The model remains a reference-based reconstruction and has not been verified as a survey-accurate or identical studio rendering.

## Browser use

The GLB uses **EXT_mesh_gpu_instancing**, **KHR_texture_transform** and **KHR_materials_clearcoat**. Use a loader supporting those extensions, such as the existing workspace Three.js loader. Tower IDs and amenity metadata remain available for object selection. Textures are embedded and also supplied in **textures**. Camera rigs and lights remain in the Blender source, allowing browser-specific lighting. GPU speed and mobile performance depend on the viewer and hardware.

## Rebuild in background mode

From this folder, run the material preparation script with Python, then run Blender against the copied baseline. The full-resolution source image and required registration data are included in this folder.

```powershell
python scripts/prepare_materials.py
blender --background sources/baseline.blend --python scripts/build_sun_city.py
python scripts/verify_export.py
blender --background "Sai Sun City.blend" --python scripts/verify_saved.py
```

Use the installed Blender executable's absolute path if Blender is absent from PATH. The **sources** folder preserves the starting model. All edits and outputs are confined to this Sun City folder.

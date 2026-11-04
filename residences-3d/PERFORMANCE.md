# Exterior viewer performance

The viewer uses shared GPU instance batches, merged static details within each selectable owner, lighter PBR materials, a smaller cached shadow map and adaptive pixel resolution. Tower footprints, facade textures and editable model files are preserved. The detail toggle was removed during the interface cleanup; the adaptive rendering remains active.

Repeated instances are rendered in nine shared batches. Their source meshes remain in their tower or amenity hierarchy for isolated elevation views and selection. Pointer picking first checks owner bounds before intersecting individual geometry, avoiding a raycast through every township instance.

Local verification on 5 November 2026, in the in-app browser's narrow viewport:

- Courtyard overview: 236 draw calls, down from 397 in the older viewer (40.6% fewer).
- Orbit sample: 2,194 frames over 37.416 seconds, approximately 58.6 fps with a 60 fps target.
- Single-tower top view: 13 draw calls.
- Verified geometry selection, tower elevation return, isolated top view and Smooth/High switching, with no browser errors.

These are observations from the performance pass on this machine and viewport, before the interface cleanup and three lighting modes. The current lighting uses three landscape point lights and three architectural uplights without extra shadow passes. The first model load includes shader and shadow preparation. Resolution decreases on slow animation frames and settles at a sharper view when movement stops. Rendering pauses when the model is hidden or scrolled out of view.

The interface uses a compact building/floor panel beside the model, available through Explore on mobile, with brochure facts, selected-tower details and amenity shortcuts. Day and evening settings follow Sai World Dream. The latest supplied night reference is matched with darker masonry and warm lit panes on every tower. Pane rectangles are registered to the four-storey facade texture; emission intensity and landscape fixture placement are illustrative. The lighting uses the existing facade meshes and shared materials rather than per-window point lights. Building and floor-plan selection use a neutral background. Floor picking uses the actual exported tower's podium height and floor pitch metadata, including all facade wings; it does not substitute World Dream's floor heights.

Run `npm run check` and `npm test`. The batching tests check preserved world transforms, independent tower visibility, selected-tower restoration and unchanged static geometry bounds.

The current editable source and export live in the parent Sai Sun City folder: `Sai Sun City.blend` and `Sai Sun City.glb`. The website uses the matching GLB in `dist/assets/sun-city-new.glb`.

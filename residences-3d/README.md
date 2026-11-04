# Sai Sun City architectural explorer

The viewer opens on the rotatable development with a compact building and floor selector, brochure overview, selected-tower details and seven amenity shortcuts. On mobile, Explore opens that panel. Morning and Evening follow Sai World Dream's lighting approach; Night uses warm illuminated glazing across all towers against darker masonry, with entrance and landscape lighting. Select a tower, then click a floor or level number to open the corresponding plan. Building and plan views use a neutral light background, without the former dark-blue overlay. The top mode navigation, detail switch and promotional copy remain removed.

See RECONSTRUCTION.md for the complete 39-image audit, method selection, missing views and inferred details. The current `Sai Sun City.blend`, `Sai Sun City.glb`, textures, references and asset list are in the parent Sai Sun City project folder. Previous deliverables and furnished apartment sources remain in `deliverables`.

An independent Sun City adaptation of the World Dream interface: an orbitable 3D township, building elevation and floor selection, apartment hotspots, registered 2D/furnished reveals, rotatable furnished GLBs, and outdoor walking with guided routes and recording.

The primary furnished-plan view uses 27 photorealistic images created with built-in image generation against the supplied layouts and the user's approved style reference. There are three complete floor views and 24 apartment views. `render-prompts.json` records the prompt set. Final PNG copies are in `deliverables/photoreal-floor-plans` and `deliverables/photoreal-apartments`. The images are illustrative visualizations; furnishing details and some rendered proportions are inferred. Use the original PDF for architectural verification. The separate Rotate model mode loads the editable Blender-derived geometry and materials.

## Run and verify

```
npm start
npm run check
npm test
npm run export
```

The local URL is http://127.0.0.1:4174/. The app is buildless and all runtime dependencies are bundled. WebGL is required. MediaRecorder support is checked before offering recording. Nothing is uploaded by walking or recording; the visitor can download the resulting clip.

## Source mapping

Source folder: https://drive.google.com/drive/folders/1sIcFZ-Leqw6GZM0O4IJqCDM7R38ECwBX

- `SSC Plan.pdf` page 3: Carina and Vega typical layout.
- Page 4: Coral, Emerald, Ivory, Jade, Altair, Atria, Callisto, Orion and Galaxy.
- Page 5: Opal, Ruby, Avior, Nova and Polaris.
- Pages 1 and 2: commercial drawings, retained among the reference assets.
- Sun City brochure page 12: township master layout and amenity locations.
- The brochure describes G+32 residential towers, two clubhouses and 1/2 BHK homes.
- Eight original Sun City JPEG renders are included as optimized references. The supplied logo is cropped to one of the two identical marks in its original PNG. One visible balcony bay from `6 Wrom Eye View.jpg` is perspective-registered as a facade material.

The scene contains 26 master-layout tower positions. Sixteen towers are named by the plan PDF. Towers 17–26 use their printed numbers because their names are not sufficiently legible in the supplied master-layout image. Their apartment drawings are absent from the supplied five-page set, and the viewer reports that explicitly. Their exterior shapes reuse illustrative massing; they are not verified tower-specific geometry.

Each of the three provided typical layouts has eight selectable units: four 1 BHK and four 2 BHK. The site includes 24 unique registered unit assets, reused by the towers listed for each source sheet. It does not imply that every floor contains the same layout: individual floor assignments and refuge schedules were not supplied. Ground-floor residential plans are also unavailable.

## Reconstruction limits

This is reference-based geometry, not the developer's original CAD/BIM model. Dimensions, hidden elevations, wall heights, furniture shape/height, the outdoor walking surfaces and surrounding context are illustrative. Furnishing positions are traced from the supplied drawings and mirrored where the published sheet shows corresponding unfurnished units. Exterior shapes and floor heights do not claim survey accuracy or equivalence to the supplied offline renders.

## Rebuilding derived assets

Python preparation uses Pillow, OpenCV, NumPy and PyMuPDF. Run `scripts/prepare-assets.py`, `scripts/prepare-facade.py`, then `scripts/prepare-interiors.py`. Run Blender in background mode with `scripts/render-interiors.py -- --both`, then `scripts/package-interiors.py` to register the flat/render pairs and enable apartment GLB mode. `scripts/adapt-template.py` records the one-time template migration and should not be rerun on the finished project.

`npm run export` writes the exterior geometry GLB into `deliverables`. Blender's `scripts/save-exterior-blend.py` imports that model and saves the editable exterior scene there. The GLB embeds the registered facade tile and landscape textures. The Blender source packs textures and an HDR environment and provides four inspection cameras.

`npm test` verifies building/plan mapping, missing-plan states, all 24 furnished assets and GLB headers, guided route reachability and collision avoidance. Browser QA covers the township, elevation, apartment reveal/model, responsive layout, walking and recording.

Three.js is MIT licensed; see `dist/vendor/LICENSE.three`. The reused general environment image is Poly Haven's Kloppenheim 05 Pure Sky (CC0). The Sun City brochure, plans, logo and architectural renders remain supplied project assets.

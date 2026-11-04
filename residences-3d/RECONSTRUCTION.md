# Sai Sun City reconstruction sources

The [numbered contact sheet](docs/exterior-source-audit.jpg) covers all 39 files listed in the [supplied render folder](https://drive.google.com/drive/folders/1lGBcm-H0-kMa2YadJpw-YRSvDOk3fLuB). Eight JPEGs and two TIFFs were inspected as original 5,000 px files. The other 29 TIFFs were inspected through their Drive thumbnails. A thumbnail establishes composition and visible correspondences. Fine materials and dimensions require the original or a drawing. The ten selected full-resolution sources are indexed in [views.json](dist/assets/exteriors/views.json).

## Views and correspondences

Numbers below refer to the contact sheet, in Drive inventory order. The building names come from the plans. The render filenames do not identify individual towers.

| Subject | Views | What can be matched |
| --- | --- | --- |
| Township aerials | 02, 03 | Opposite oblique views show the same pattern of parallel residential rows, curved tower ends, roof crowns and planted perimeter. Useful for massing and orientation. Landscaping outside the development is part of the studio rendering. |
| Tower and podium | 08 | The clearest continuous daylight elevation, from commercial arcade and colonnade up the stacked balconies to the green crowns. This is the opening image. |
| Entrance approach and gate | 06, 12, 14, 16 | The day and night avenue views, 06 and 14, show paired crown towers on the same approach axis. The close views document the arched gate and its illuminated underside. |
| Fountain plaza and residential wings | 04, 05, 07, 13, 15, 24, 27, 29 | The arcades, fountain sculpture and repeated balcony wings connect the low, high and overhead compositions. The JPEG and TIFF at 04 and 15 depict the same day composition. The night counterpart at 13 adds lighting evidence; 27 looks down into the same round court. These images support the plaza arrangement, without resolving each visible wing to a named tower. |
| Pool and clubhouse | 01, 35 | Pool edge, parasols and the stepped clubhouse match across day and night. |
| Garden, lounge and sports exteriors | 10, 11, 17–20, 28, 30–34, 36, 38, 39 | The waterside pavilion recurs in 10 and 11. The paired hedges and water channel in 17 and 38 repeat the same composition. The other views document local amenity finishes, planting and furniture. |
| Commercial arcade and sports deck | 09, 22, 23, 25, 26 | Open shop arcades line the podium. Views 09 and 26 repeat a passage composition; 22 and 23 show opposite angles of the court and terrace above the roadside shops. |
| Interiors | 21, 37 | A wood-lined reception/lounge composition filed as “Conference” and a separate illuminated lobby. Neither shows an apartment interior. |

## Drawings and dimensions

The [five-page plan PDF](https://drive.google.com/file/d/1nE4XFflBSq28CFBcqy5xB1_D44X_vBQn/view) has commercial drawings on pages 1–2. Pages 3–5 give the three typical residential layouts for 16 named towers. Each has eight apartments. Tower placements follow the 26 numbered positions on page 12 of the [developer brochure](https://drive.google.com/file/d/1ZVApjTAIm6sowDQDQqtmQgwwEQ6Qy3DJ/view). The brochure describes a 29-acre G+32 scheme at Survey Nos. 33, 61 and 62/1 in Village Ghot, Panvel.

Printed apartment dimensions and room adjacencies constrain the floor plans. Tower height, floor-to-floor spacing, balcony depth, parapet heights, roof profiles and the site-to-world transform are estimates. The supplied plan set gives no floor assignment schedule, sections, complete elevations, survey coordinates for individual towers or drawings for towers 17–26. The brochure's location diagram is schematic.

## Model and rendering choices

The explorer combines the studio's original camera views with editable, plan-based tower geometry for orbiting, selecting towers and exploring floors. The views establish a cream arcade, stacked projecting slabs, recessed dark glazing, vertical pilasters, pale coping, ribbed green crowns and palm-lined courts. Glass reflections, shadows, landscaping, vehicles and sky in a studio image belong to that camera and lighting setup.

Repeated and near-identical views, different lighting, reflective glazing and large gaps in façade coverage make a continuous multi-view reconstruction uncertain. There is no calibrated orbit around each tower, rear and roof survey, depth pass or source camera rig in this render set. A photogrammetry mesh or Gaussian splat could reproduce some visible angles, but these inputs do not support reliable geometry for arbitrary viewpoints or selectable floors. The original frames preserve the studio appearance at known angles; conventional geometry supplies depth and navigation elsewhere.

For a closer free-view match, useful additional inputs are dimensioned sections and elevations for each tower, roof plans, calibrated rear/side/roof views, and the studio's exterior scene or source meshes. Independent plaster/stone, glazing, metal, paving and vegetation materials need base colour, roughness and surface detail separated from rendered shadows. Without those assets, hidden roof plant, rear façades, service elements and exact material response remain inferred. The studio aerials are useful building references; geographically placed surroundings need their own map sources and scale.


## Final exterior delivery

The site and one representative tower were established from the master layout and typical plan, then their overhead outlines were compared with the source sheet. The final model includes the traced tower wings, projecting slab edges, glazing and rail details, open ribbed crowns, roof housings, commercial podium with shopfronts and sports deck, stepped clubhouses, roads, pool and planting. Tree canopies use alpha-masked texture cards. Palm fronds use curved leaflet geometry. The visible tower outlines and wing connections follow supplied drawings. Heights, roof service housings, individual window divisions, shopfront divisions, clubhouse heights, planting species and unseen elevations are estimated.

The GLB embeds four texture images and preserves 26 tower identities and amenity groups. Instanced balcony and vegetation geometry limits duplication. The viewer reduces distant rail detail, limits pixel ratio, and renders on demand during still views. The 360-degree mode renders continuously. The 17.1 MB GLB uses EXT_mesh_gpu_instancing and KHR_texture_transform, supported by the bundled Three.js and verified Blender importer. Large scenes remain more demanding on mobile GPUs. Daylight is an estimated match to the reference grade. The original studio camera rig, full material maps and hidden geometry are unavailable, so exact studio-render equivalence has not been established.

Run npm run export to rebuild the GLB. Build the editable file in headless Blender with blender --background --python scripts/save-exterior-blend.py. Verify the saved file and create the Cycles preview with blender --background "deliverables/Sai Sun City exterior.blend" --python scripts/render-delivery.py.

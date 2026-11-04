# Sai Sun City

The Sun City project is kept entirely in this folder. The existing Sai World Dream project is separate.

Shared website: https://sai-sun-city-architectural-explorer.crosscutcooperation.chatgpt.site/#model

The current editable exterior is `Sai Sun City.blend`, with its browser export in `Sai Sun City.glb`. All model scripts, textures, references, verification reports and previews are now in this same Sai Sun City project folder. See `MODEL-README.md` for the modeling workflow and documented approximations. The former separate `Sun City` folder has been consolidated here.

Finished furnished visuals: 3 complete typical floor layouts and 24 apartment views in `residences-3d/deliverables/photoreal-floor-plans` and `residences-3d/deliverables/photoreal-apartments`. See `residences-3d/render-prompts.json` for the built-in image generation prompt set. These are illustrative renders based on the supplied typical plans; individual floor assignments were not provided.

- `residences-3d/dist`: deployable website and local Three.js runtime.
- `residences-3d/deliverables`: previous exterior deliverables, 24 apartment Blender files, rendered contact sheet, browser screenshots and walkthrough recordings. Use the root `Sai Sun City.blend` for the latest exterior source.
- `source-assets`: downloaded Sun City brochure, complete five-page plan PDF, original logo, selected full-resolution architectural renders and registered interior jobs.
- `reference-previews`: extracted text, PDF contact sheets and inspection images.
- `drive-inventory.json`: inventory of the supplied Drive folder's principal subfolders. This is an inventory, not a claim that every large TIFF or video has been downloaded.

Run the website from `residences-3d` with `npm start`, then open http://127.0.0.1:4174/.

See `residences-3d/README.md` for features, provenance, checks and source limitations.

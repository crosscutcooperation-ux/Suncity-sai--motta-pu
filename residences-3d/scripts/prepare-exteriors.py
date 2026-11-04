"""Prepare full-frame, color-managed versions of the supplied architectural views."""

import io
import json
from pathlib import Path

from PIL import Image, ImageCms, ImageOps


PROJECT = Path(__file__).resolve().parents[2]
SOURCES = PROJECT / "source-assets"
DESTINATION = PROJECT / "residences-3d/dist/assets/exteriors"
URL_ROOT = "assets/exteriors"

# The podium frame keeps the central building's whole elevation in one shot.
VIEWS = [
    ("podium", "25 Podium nd Building.jpg", "The residential skyline",
     "A full-height view of the residential towers, from the arcaded podium to the green domes."),
    ("arrival", "Sai Sun City - 1 Entrance Driveway View.jpg", "The entrance avenue",
     "Paired domes frame the tree-lined drive through the main entrance."),
    ("aerial", "1 Cam bird eye view.jpg", "Township from above",
     "An aerial view across the residential blocks, central gardens and clubhouse."),
    ("aerial-reverse", "2 Cam bird eye view.jpg", "The reverse aerial",
     "The second aerial angle shows the towers grouped around their courtyards."),
    ("plaza", "6 Wrom Eye View.jpg", "Plaza at sundown",
     "Warm light crosses the balconies and the sculptural fountain in the arrival plaza."),
    ("plaza-night", "6 Wrom Eye View Night.tiff", "Plaza after dark",
     "Illuminated residential façades rise above the fountain at night."),
    ("boulevard", "8 Wrom Eye View with plaza.jpg", "The central boulevard",
     "A street-level perspective across the plaza toward the residential wings."),
    ("fountain", "9 High Angle with plaza_day.jpg", "The palm court",
     "The curved arrival court, palm planting and central fountain from above."),
    ("downward", "7 Top To Bottom.tif", "From the upper floors",
     "A downward perspective into the landscaped grounds."),
    ("club-night", "Copy of 41 Club House night view.jpg", "The pool at night",
     "The illuminated pool terrace and stepped clubhouse overlook the gardens."),
]


def web_color(image):
    image = ImageOps.exif_transpose(image)
    profile = image.info.get("icc_profile")
    if profile:
        embedded = ImageCms.ImageCmsProfile(io.BytesIO(profile))
        return ImageCms.profileToProfile(image.convert("RGB"), embedded,
                                        ImageCms.createProfile("sRGB"), outputMode="RGB")
    return image.convert("RGB")


def write_size(image, name, max_dimension, quality):
    resized = image.copy()
    resized.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
    resized.save(DESTINATION / name, format="WEBP", quality=quality, method=5)
    return resized.size


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    inventory = json.loads((PROJECT / "drive-inventory.json").read_text(encoding="utf-8"))
    by_name = {row["title"]: row for row in inventory["folders"]["renders"]}
    rows = []
    for key, name, title, description in VIEWS:
        original = SOURCES / name
        if not original.is_file():
            continue
        with Image.open(original) as source:
            image = web_color(source)
        width, height = write_size(image, f"{key}.webp", 3840, 94)
        preview_width, _ = write_size(image, f"{key}-screen.webp", 1600, 91)
        write_size(image, f"{key}-thumb.webp", 320, 83)
        rows.append({
            "key": key, "title": title, "description": description,
            "src": f"{URL_ROOT}/{key}.webp", "thumb": f"{URL_ROOT}/{key}-thumb.webp",
            "preview": f"{URL_ROOT}/{key}-screen.webp", "previewWidth": preview_width,
            "width": width, "height": height, "sourceUrl": by_name[name]["url"],
        })
        print(f"{key}: {width} × {height}", flush=True)
    pending = DESTINATION / "views.tmp"
    pending.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    pending.replace(DESTINATION / "views.json")


if __name__ == "__main__":
    main()

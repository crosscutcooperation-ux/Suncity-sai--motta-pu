"""Register a two-bay, four-storey tile from the supplied full-size elevation."""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[2]
image = np.asarray(Image.open(root / 'source-assets/6 Wrom Eye View.jpg').convert('RGB'))
# These corners track the same two pilaster axes and slab edges on the central
# facade. The frame on which the axes were measured starts at (895, 490) on an
# 1800px-wide copy of the original; corner offsets are full-resolution pixels.
origin = np.round(np.array([895, 490]) * image.shape[1] / 1800)
quad = np.float32([[6, 324], [278, 324], [287, 576], [6, 576]]) + origin.astype(np.float32)
size = (384, 384)
matrix = cv2.getPerspectiveTransform(quad, np.float32([[0, 0], [384, 0], [384, 384], [0, 384]]))
tile = cv2.warpPerspective(image, matrix, size, flags=cv2.INTER_CUBIC)
# The supplied photograph is a dusk view. Keep relief and fenestration while
# shifting violet stone toward the warm daytime aerial material.
tile = np.clip(tile.astype(float) * [1.16, 1.14, 1.02] + [10, 9, 5], 0, 255).astype(np.uint8)
Image.fromarray(tile).save(root / 'residences-3d/dist/assets/facade-sun-city.jpg', quality=96)

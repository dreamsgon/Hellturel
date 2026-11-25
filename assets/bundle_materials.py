"""Build the offline texture script from Elturel and Greenest material maps."""
from pathlib import Path
from io import BytesIO
import base64
import json
from PIL import Image
import numpy as np

target = Path(__file__).resolve().parent
staging = target.parents[1] / "elturel-texture-work"
greenest = target.parents[1] / "Greenest" / "assets"
sources = {}
for app_name, folder, source, suffixes in [
    ("timber", "sol", "charred-timber", ["-color.webp", "-normal.webp", "-roughness.png"]),
    ("limestone", "sol", "weathered-limestone", ["-color.webp", "-normal.webp", "-roughness.png"]),
    ("slate", "sol", "roof-slate", ["-color.webp", "-normal.webp", "-roughness.png"]),
    ("cobble", "terra", "ash_cobble", ["_basecolor.png", "_normal.png", "_roughness.png"]),
    ("basalt", "terra", "fractured_basalt", ["_basecolor.png", "_normal.png", "_roughness.png"]),
    ("clay", "terra", "weathered_clay", ["_basecolor.png", "_normal.png", "_roughness.png"]),
]:
    for kind, suffix in zip(["color", "normal", "roughness"], suffixes):
        with Image.open(staging / folder / (source + suffix)) as original:
            image = original.convert("RGB")
            if kind == "roughness":
                image.thumbnail((512, 512), Image.Resampling.LANCZOS)
            buffer = BytesIO()
            image.save(buffer, "WEBP", quality=86 if kind == "color" else 80, method=6)
            data = base64.b64encode(buffer.getvalue()).decode("ascii")
            sources[f"{app_name}-{kind}"] = "data:image/webp;base64," + data

for app_name, source in [
    ("wall-stone", "stone"),
    ("wall-plaster", "plaster"),
    ("grain", "timber"),
    ("pitched-slate", "slate"),
    ("pitched-clay", "tiles"),
    ("paving", "cobble"),
    ("cinder-soil", "lane"),
]:
    for kind in ("color", "normal"):
        path = greenest / f"{source}-{kind}.webp"
        with Image.open(path) as original:
            image = original.convert("RGB")
            if source == "tiles":
                image = image.transpose(Image.Transpose.ROTATE_90)
                if kind == "normal":
                    red, green, blue = image.split()
                    image = Image.merge("RGB", (green.point(lambda value: 255 - value), red, blue))
            buffer = BytesIO()
            image.save(buffer, "WEBP", quality=89 if kind == "color" else 85, method=6)
        data = base64.b64encode(buffer.getvalue()).decode("ascii")
        sources[f"{app_name}-{kind}"] = "data:image/webp;base64," + data

# The upper hemisphere provides real cloud structure without the terrestrial horizon.
with Image.open(greenest / "sky.webp") as panorama:
    width, height = panorama.size
    clouds = panorama.crop((0, 0, width, round(height * .465))).resize((2048, 476), Image.Resampling.LANCZOS)
    buffer = BytesIO()
    clouds.save(buffer, "WEBP", quality=87, method=6)
    sources["cloud-panorama"] = "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")

rock = target.parents[1] / "Ruined Thaig" / "Textures"
for kind, suffix in [("color", "diff_2k.jpg"), ("normal", "disp_2k.png")]:
    with Image.open(rock / ("rock_face_03_" + suffix)) as original:
        image = original.resize((1024, 1024), Image.Resampling.LANCZOS)
        if kind == "normal":
            height = np.asarray(image.convert("F"))
            height = height / max(1, height.max())
            dx = np.roll(height, 1, 1) - np.roll(height, -1, 1)
            dy = np.roll(height, -1, 0) - np.roll(height, 1, 0)
            normals = np.stack((dx * 4, dy * 4, np.ones_like(dx)), axis=-1)
            normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
            image = Image.fromarray(((normals * .5 + .5) * 255).astype("uint8"))
        buffer = BytesIO()
        image.convert("RGB").save(buffer, "WEBP", quality=87, method=6)
        sources["cliff-" + kind] = "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")

(target / "materials.js").write_text(
    "window.ELTUREL_TEXTURES=" + json.dumps(sources, separators=(",", ":")) + ";\n",
    encoding="utf-8",
)


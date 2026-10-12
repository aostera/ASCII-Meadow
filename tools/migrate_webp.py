#!/usr/bin/env python3
"""Deterministic lossless WebP migration and validation of *non-knight* source art.

--apply: convert the eight retained source PNGs into exact RGBA WebP and
         remove the PNG copies. Never touch knight atlases or their cloak mask.
--check: fail if non-knight PNGs remain; check WebP decode, authoring assets,
         and regenerated NPC artwork on every CI run.
Requires Pillow (offline authoring dependency, not a runtime browser dependency).
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from PIL import Image, features
import argparse
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
EXPECTED = [
    "assets/cow/cow_animation_atlas.webp",
    *[f"assets/cow_v2/cow_{state}_atlas.webp" for state in ("eat", "idle", "jump", "run", "walk")],
    "assets/npc/villager-starter.webp",
    "assets/npc/hermit-starter.webp",
]


def non_knight(p):
    return not any("knight" in part.lower() for part in p.relative_to(ROOT).parts)


def rgba(path):
    with Image.open(path) as im:
        return im.convert("RGBA").copy()


def apply():
    if not features.check("webp"):
        raise SystemExit("Pillow must be built with WebP support")
    candidates = sorted(p for p in ASSETS.rglob("*.png") if non_knight(p))
    if not candidates:
        print("No non-knight PNGs to migrate (already converted).")
        return
    for source in candidates:
        image = rgba(source)
        destination = source.with_suffix(".webp")
        # exact=True is essential: invisible RGB values and alpha must survive.
        image.save(destination, "WEBP", lossless=True, quality=100, method=5, exact=True)
        check = rgba(destination)
        if check.size != image.size or check.tobytes() != image.tobytes():
            destination.unlink(missing_ok=True)
            raise RuntimeError(f"Lossless pixel equivalence failed for {source}")
        old_bytes = source.stat().st_size
        new_bytes = destination.stat().st_size
        print(f"{source.relative_to(ROOT)}: {old_bytes:,} → {new_bytes:,} bytes")
        source.unlink()


def check():
    leftovers = [p.relative_to(ROOT) for p in ASSETS.rglob("*.png") if non_knight(p)]
    if leftovers:
        raise RuntimeError(f"Non-knight PNGs remain: {leftovers}")
    for name in EXPECTED:
        filename = ROOT / name
        if not filename.is_file():
            raise RuntimeError(f"Missing WebP asset: {name}")
        with Image.open(filename) as im:
            if im.format != "WEBP" or im.width < 1 or im.height < 1:
                raise RuntimeError(f"Not a valid WebP atlas: {name}")
    # The original generative sprite pipelines still output indexed PNG *to a
    # temporary directory*. Verify the committed lossless WebP matches exactly.
    with TemporaryDirectory() as temp:
        for actor in ("villager", "hermit"):
            generated = Path(temp) / f"{actor}.png"
            subprocess.run(["node", f"tools/npc/generate-{actor}.cjs", str(generated)],
                           cwd=ROOT, check=True, capture_output=True)
            old = rgba(generated)
            new = rgba(ROOT / f"assets/npc/{actor}-starter.webp")
            if old.size != new.size or old.tobytes() != new.tobytes():
                raise RuntimeError(f"{actor}: generated source art differs from committed WebP")
    knights = list(ASSETS.rglob("*knight*.png"))
    if len(knights) < 11:
        raise RuntimeError("Knight master atlases appear to be missing")
    total = sum((ROOT / n).stat().st_size for n in EXPECTED)
    print(f"PASS 8 lossless WebP assets, {total / 1048576:.2f} MiB; "
          f"2 NPC sources pixel-perfect; {len(knights)} knight PNG masters retained")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--apply", action="store_true")
    group.add_argument("--check", action="store_true")
    args = parser.parse_args()
    apply() if args.apply else check()

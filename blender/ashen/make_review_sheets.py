"""Side-by-side review sheets: source bind / V22 Idle / repaired, same cameras (Pillow)."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

D = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "review")
ROWS = [("00_source_bind", "Исходник Tripo", "T-поза, без изменений"),
        ("01_v22_idle", "V22 Idle", "брак: руки в корпусе"),
        ("02_repaired", "Ремонт v01", "руки вниз, веса плаща")]
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 22)
small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 16)
for views, out in ((["front", "side", "back"], "compare_body.png"),
                   (["shoulderL", "shoulderR", "backShoulders"], "compare_shoulders.png")):
    tiles = []
    for pre, label, note in ROWS:
        ims = [Image.open(D / f"{pre}_{v}.png").convert("RGB").resize((320, 380)) for v in views]
        row = Image.new("RGB", (200 + 325 * len(ims), 380), (24, 24, 24))
        d = ImageDraw.Draw(row)
        d.text((14, 160), label, font=font, fill=(235, 235, 235))
        d.text((14, 192), note, font=small, fill=(170, 170, 170))
        for k, im in enumerate(ims):
            row.paste(im, (200 + 325 * k, 0))
        tiles.append(row)
    sheet = Image.new("RGB", (tiles[0].width, sum(t.height for t in tiles) + 10), (24, 24, 24))
    y = 0
    for t in tiles:
        sheet.paste(t, (0, y))
        y += t.height + 5
    sheet.save(D / out)
    print(D / out, sheet.size)

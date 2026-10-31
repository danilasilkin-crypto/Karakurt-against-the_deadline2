"""Original procedural key art. Run: skpy tools/make_preview.py (Pillow).
No downloaded assets. Windows fonts are rasterised, never redistributed.
Only regenerates the two named artwork files in assets/.
"""
from pathlib import Path
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
S = 2
MINT = '#bbf880'
WHITE = '#f2f3e8'
FONTS = Path('C:/Windows/Fonts')


def font(size, bold=False, mono=False):
    name = ('consolab.ttf' if bold else 'consola.ttf') if mono else ('arialbd.ttf' if bold else 'arial.ttf')
    return ImageFont.truetype(str(FONTS / name), round(size * S))


def box(values):
    return tuple(round(v * S) for v in values)


def line(draw, points, fill, width=1):
    draw.line([(round(x * S), round(y * S)) for x, y in points], fill=fill, width=max(1, round(width * S)), joint='curve')


def text(draw, xy, value, size, fill, bold=False, mono=False):
    draw.text((round(xy[0] * S), round(xy[1] * S)), value, font=font(size, bold, mono), fill=fill, stroke_width=0)


def rect(draw, values, fill, outline=None, radius=10, width=1):
    draw.rounded_rectangle(box(values), radius=round(radius * S), fill=fill, outline=outline, width=round(width * S))


def ellipse(draw, values, fill, outline=None, width=1):
    draw.ellipse(box(values), fill=fill, outline=outline, width=round(width * S))


def glow(image, xy, radius, colour, strength=100):
    layer = Image.new('RGBA', image.size)
    d = ImageDraw.Draw(layer)
    x, y = xy
    ellipse(d, (x - radius, y - radius, x + radius, y + radius), (*colour, strength))
    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(radius * S * .55)))


def keycap(d, x, y, label, target=False, warning=False, width=112):
    top, edge, side = ('#425f37', '#bbf880', '#142b21') if target else ('#553239', '#bd6860', '#27191e') if warning else ('#273a46', '#4b5f6c', '#0b171f')
    rect(d, (x, y + 10, x + width, y + 103), side, radius=13)
    rect(d, (x, y, x + width, y + 84), top, edge, 12, 1.5)
    line(d, [(x + 14, y + 3), (x + width - 14, y + 3)], '#95b190' if target else '#5e707b', 1)
    rect(d, (x + 9, y + 8, x + width - 9, y + 71), None, '#58744b' if target else '#304550', 8)
    text(d, (x + 16, y + 12), label, 20, MINT if target else '#a7b5b9', mono=True)


def keyboard(image, x, y):
    layer = Image.new('RGBA', (710 * S, 340 * S))
    d = ImageDraw.Draw(layer)
    rect(d, (4, 21, 700, 329), '#030b12', radius=24)
    rect(d, (0, 0, 694, 304), '#18252e', '#4b5a60', 22, 2)
    text(d, (28, 15), 'NIGHT SHIFT   /   SAVE HUMAN', 11, '#94a8a5', mono=True)
    ellipse(d, (644, 18, 650, 24), MINT)
    for row, labels in enumerate([['Q', 'W', 'E', 'R', 'T'], ['A', 'S', 'D', 'F', 'G']]):
        for col, label in enumerate(labels):
            keycap(d, 23 + col * 129 + row * 8, 45 + row * 116, label, row == 0 and col == 2, row == 0 and col == 4)
    rotated = layer.rotate(10, Image.Resampling.BICUBIC, expand=True)
    image.alpha_composite(rotated, (round(x * S), round(y * S)))


def finger(image, x, y):
    layer = Image.new('RGBA', (230 * S, 480 * S))
    d = ImageDraw.Draw(layer)
    rect(d, (43, -80, 202, 440), '#392e35', '#bb8d77', 78, 2)
    rect(d, (48, -80, 191, 425), '#8e6b60', radius=71)
    rect(d, (58, -80, 178, 415), '#b19077', radius=60)
    rect(d, (68, -80, 162, 400), '#c6ab8a', radius=48)
    rect(d, (65, 258, 175, 388), '#dbc6a8', '#927569', 42, 2)
    rect(d, (76, 267, 164, 369), '#e4d5bb', radius=32)
    line(d, [(76, 376), (104, 384), (137, 385), (162, 377)], '#fff0d2', 2)
    for yy in [195, 206, 219]:
        d.arc(box((67, yy - 12, 170, yy + 18)), 12, 166, fill='#92715f', width=2 * S)
    # Muted, human warmth against the cool keyboard; not a horror-game hand.
    rotated = layer.rotate(-27, Image.Resampling.BICUBIC, expand=True)
    image.alpha_composite(rotated, (round(x * S), round(y * S)))


def spider(image, x, y, scale=1):
    d = ImageDraw.Draw(image)
    def p(a, b):
        return x + a * scale, y + b * scale
    def oval(bounds, colour, edge=None):
        a, b, c, e = bounds
        ellipse(d, (*p(a, b), *p(c, e)), colour, edge, 1.5 * scale)
    # Eight articulated legs; red hourglass and four mint eyes match NightArt.
    legs = [(-12, -12, -42, -59, -57, -81), (-15, -4, -63, -34, -76, -45), (-16, 9, -64, 16, -82, 34), (-12, 20, -45, 52, -59, 74)]
    for side in [-1, 1]:
        for ax, ay, kx, ky, fx, fy in legs:
            pts = [p(ax * side, ay), p(kx * side, ky), p(fx * side, fy)]
            for width, colour in [(11, '#050d15'), (7, '#304654'), (2, '#9ea992')]:
                line(d, pts, colour, width * scale)
            oval((kx * side - 4, ky - 4, kx * side + 4, ky + 4), '#49616c')
    oval((-33, -3, 33, 67), '#09121b', '#65776e')
    oval((-26, 1, 23, 58), '#182936')
    oval((-23, 7, -12, 38), '#344c59')
    hourglass = [(-10, 12), (10, 12), (3, 29), (11, 48), (-11, 48), (-3, 29)]
    d.polygon([(round(p(a, b)[0] * S), round(p(a, b)[1] * S)) for a, b in hourglass], fill='#ff7964')
    oval((-23, -34, 23, 7), '#273a46', '#6f8c84')
    for ex, ey, r in [(-9, -23, 5), (9, -23, 5), (-17, -14, 3), (17, -14, 3)]:
        oval((ex-r, ey-r, ex+r, ey+r), MINT)
        oval((ex-r/2, ey-r/2, ex, ey), WHITE)
    for side in [-1, 1]:
        line(d, [p(side*9, -33), p(side*16, -45)], '#c2d1b1', 2 * scale)


def make_cover(height=630, compact=False):
    width = 1200
    # Render a deliberately subtle gradient at low resolution, then supersample.
    base = Image.new('RGB', (300, round(height / 4)))
    pixels = []
    for yy in range(base.height):
        for xx in range(base.width):
            light = math.exp(-(((xx-225)/95)**2 + ((yy-base.height*.65)/85)**2))
            pixels.append((round(9+13*light), round(17+29*light), round(24+25*light)))
    base.putdata(pixels)
    image = base.resize((width*S, height*S), Image.Resampling.BICUBIC).convert('RGBA')
    d = ImageDraw.Draw(image)
    # Thin web threads frame the hand and connect the two protagonists.
    origin = (1175, 30)
    for end in [(530, 0), (570, 170), (640, 290), (760, 430), (950, 570), (1200, height)]:
        line(d, [origin, end], '#304045')
    for rr in [110, 210, 310, 410, 530]:
        d.arc(box((1175-rr, 30-rr, 1175+rr, 30+rr)), 81, 190, fill='#24383e', width=S)
    # Small terminal annotations add context without competing with the title.
    text(d, (836, 66 if not compact else 360), '03:47', 44, '#6f8d88', mono=True)
    text(d, (838, 116 if not compact else 414), 'BUILD FAILED_', 13, '#a0b99d', mono=True)
    ay = 0 if not compact else 170
    glow(image, (870, 418+ay), 130, (153, 215, 100), 55)
    keyboard(image, 620 if not compact else 420, 295+ay)
    finger(image, 875 if not compact else 850, -140+ay)
    sx, sy = (932, 442) if not compact else (735, 610)
    glow(image, (sx, sy), 95, (187, 248, 128), 65)
    spider(image, sx, sy, 1.22 if not compact else 1.55)
    d = ImageDraw.Draw(image)
    # Trail: the player is breaking the build, not attacking the person.
    line(d, [(sx-60, sy+65), (sx-170, sy+112), (sx-185, sy+135)], '#a2b88a', 1)
    random.seed(347)
    for _ in range(40):
        px, py = random.randrange(620, 1180), random.randrange(180, height-40)
        ellipse(d, (px, py, px+1.5, py+1.5), '#506559')
    rect(d, (58, 46, 303, 76), '#24372d', '#465e46', 15)
    ellipse(d, (73, 58, 79, 64), MINT)
    text(d, (91, 51), 'SHARROWKIN JAM 2026', 13, MINT, True, True)
    text(d, (60, 122), 'КАРАКУРТ', 82, WHITE, True)
    text(d, (64, 217), 'ПРОТИВ', 23, '#9bb3ad', True, True)
    text(d, (58, 247), 'ДЕДЛАЙНА', 82, MINT, True)
    text(d, (64, 370), 'Сломай сборку.', 27, WHITE, True)
    text(d, (64, 409), 'Спаси человека.', 27, WHITE, True)
    text(d, (64, 464), 'МАЛЕНЬКИЙ ПАУК. БОЛЬШАЯ ЗАБОТА.', 13, '#9db2ad', mono=True)
    # Three distinct night accents and a strong footer stay legible in a small card.
    badge_y = height - 147
    for bx, word, colour in [(64, '01  ДОЛГ', '#bbf880'), (222, '02  ГРОЗА', '#99dfff'), (390, '03  ПОКАЗ', '#ffc77a')]:
        rect(d, (bx, badge_y, bx+145, badge_y+32), '#16272d', '#405852', 8)
        text(d, (bx+12, badge_y+7), word, 13, colour, True, True)
    bottom = height - 68
    line(d, [(64, bottom-24), (540 if not compact else 1136, bottom-24)], '#3d514d')
    text(d, (64, bottom-5), '3 НОЧИ  /  15 ГЛАВ', 17, MINT, True, True)
    text(d, (64, bottom+24), 'БРАУЗЕРНАЯ АРКАДА · ПАУК ПРОТИВ ЧЕЛОВЕКА', 11, '#8ca49f', mono=True)
    line(d, [(20, 0), (20, 38)], MINT, 2)
    line(d, [(0, 20), (38, 20)], MINT, 2)
    return image.convert('RGB')


def main():
    out = ROOT / 'assets'
    out.mkdir(exist_ok=True)
    for name, height, compact, size in [('preview.png', 630, False, (1200, 630)), ('jam-cover.png', 952, True, (630, 500))]:
        image = make_cover(height, compact).resize(size, Image.Resampling.LANCZOS)
        image.save(out / name, optimize=True)
        print(f'{name}: {size[0]}x{size[1]}, {(out / name).stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    main()

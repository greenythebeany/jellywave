"""Regenerates every app icon, splash screen and logo image of Triptych.

    python -I scripts/brand-icons.py [--out DIR]

The mark is three rounded bars (short, tall, short), measured from the
Gemini artwork, with the right bar in the accent red. It is drawn here, not
traced from the artwork, so every size stays crisp. Light backgrounds get
black bars, dark backgrounds white ones. The in-app copy is the inline SVG in
src/index.html (BRAND_SVG in app.js), whose right bar follows the accent colour.
"""
import argparse
import glob
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = 'android/app/src/main/res'
DENSITY = {'ldpi': 0.75, 'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

# geometry in mark units (viewBox 0 0 411 453)
BAR_W, GAP, TALL, SHORT, RADIUS = 113, 36, 453, 350, 24
MARK_W, MARK_H = 3 * BAR_W + 2 * GAP, TALL
BLACK, WHITE, RED = (0, 0, 0), (255, 255, 255), (215, 25, 33)


def svg(bar_fill, accent_fill):
    bars = []
    for i in range(3):
        h = TALL if i == 1 else SHORT
        fill = accent_fill if i == 2 else bar_fill
        bars.append(f'<rect x="{i * (BAR_W + GAP)}" y="{TALL - h}" width="{BAR_W}" height="{h}" rx="{RADIUS}" fill="{fill}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MARK_W} {MARK_H}">{"".join(bars)}</svg>\n'


def mark(height, bar):
    """The mark `height` px tall, transparent around it (4x supersampled)."""
    s = 4 * height / MARK_H
    w, h = round(MARK_W * s), round(MARK_H * s)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i in range(3):
        bh = TALL if i == 1 else SHORT
        x = i * (BAR_W + GAP) * s
        d.rounded_rectangle((x, (TALL - bh) * s, x + BAR_W * s - 1, h - 1), radius=RADIUS * s,
                            fill=(RED if i == 2 else bar) + (255,))
    return img.resize((max(1, round(MARK_W * height / MARK_H)), max(1, round(height))), Image.LANCZOS)


def place(size, scale, bar, bg=None, shape=None):
    """Mark centred on a canvas, its height `scale` of the canvas' short side."""
    w, h = size if isinstance(size, tuple) else (size, size)
    canvas = Image.new('RGBA', (w, h), bg + (255,) if bg else (0, 0, 0, 0))
    if shape:
        m = Image.new('L', (w * 4, h * 4), 0)
        d = ImageDraw.Draw(m)
        if shape == 'circle':
            d.ellipse((0, 0, w * 4 - 1, h * 4 - 1), fill=255)
        else:
            d.rounded_rectangle((0, 0, w * 4 - 1, h * 4 - 1), radius=int(w * 4 * 0.225), fill=255)
        canvas.putalpha(m.resize((w, h), Image.LANCZOS))
    if scale:
        mk = mark(min(w, h) * scale, bar)
        layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        layer.alpha_composite(mk, ((w - mk.width) // 2, (h - mk.height) // 2))
        canvas = Image.alpha_composite(canvas, layer) if not shape else _masked(canvas, layer)
    return canvas


def _masked(canvas, layer):
    out = Image.alpha_composite(canvas, layer)
    out.putalpha(canvas.getchannel('A'))
    return out


def app_icon(size):
    """Black rounded square with the white mark (desktop, favicon, README)."""
    return place(size, 0.5, WHITE, BLACK, 'rounded')


def save(img, out, rel, opaque=False):
    path = os.path.join(out, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if opaque or rel.endswith('.jpg'):
        flat = Image.new('RGB', img.size, BLACK)
        flat.paste(img, mask=img.getchannel('A'))
        img = flat
    img.save(path, quality=92) if rel.endswith('.jpg') else img.save(path)
    return rel


def write(out, rel, text):
    path = os.path.join(out, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(text)
    return rel


def download_button():
    w, h = 820, 300
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((30, 30, w - 30, h - 30), radius=60, fill=RED + (255,))
    font = None
    for f in ('C:/Windows/Fonts/arialbd.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(f):
            font = ImageFont.truetype(f, 92)
            break
    font = font or ImageFont.load_default()
    cx = w // 2
    d.rectangle((cx - 12, 48, cx + 12, 100), fill='white')
    d.polygon([(cx - 36, 96), (cx + 36, 96), (cx, 132)], fill='white')
    d.line([(cx - 64, 120), (cx - 64, 146), (cx + 64, 146), (cx + 64, 120)], fill='white', width=14, joint='curve')
    tw = d.textlength('DOWNLOAD', font=font)
    d.text(((w - tw) / 2, 156), 'DOWNLOAD', font=font, fill='white')
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=ROOT)
    out = ap.parse_args().out
    done = []

    # brand kit: the mark alone (tightly cropped) and the app icon
    done.append(write(out, 'brand/triptych-light.svg', svg('#000000', '#D71921')))
    done.append(write(out, 'brand/triptych-dark.svg', svg('#FFFFFF', '#D71921')))
    done.append(save(mark(1024, BLACK), out, 'brand/triptych-light.png'))
    done.append(save(mark(1024, WHITE), out, 'brand/triptych-dark.png'))
    done.append(save(app_icon(1024), out, 'brand/triptych-icon.png'))

    # desktop window/taskbar, Linux packages, website favicon
    done.append(save(app_icon(1024), out, 'logo.png'))
    done.append(save(app_icon(512), out, 'src/assets/icon.png'))
    done.append(save(app_icon(64), out, 'website/public/media/favicon.png'))
    done.append(save(app_icon(512), out, 'website/public/media/icon.png'))
    ico = app_icon(256)
    path = os.path.join(out, 'build/icon.ico')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ico.save(path, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    done.append('build/icon.ico')
    # full-bleed icons the OS rounds itself
    done.append(save(place(1024, 0.5, WHITE, BLACK), out, 'assets/icon.png', opaque=True))
    done.append(save(place(1254, 0.42, WHITE, BLACK), out, 'logo_apps.jpg'))
    done.append(save(place(1024, 0.5, WHITE, BLACK), out, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', opaque=True))
    # Android launcher icons
    for dens, f in DENSITY.items():
        legacy, adaptive = round(48 * f), round(108 * f)
        d = f'{RES}/mipmap-{dens}'
        done.append(save(place(legacy, 0.5, WHITE, BLACK, 'rounded'), out, f'{d}/ic_launcher.png'))
        done.append(save(place(legacy, 0.5, WHITE, BLACK, 'circle'), out, f'{d}/ic_launcher_round.png'))
        # the adaptive layers are inset 16.7% (mipmap-anydpi-v26), so the
        # whole canvas is the visible area; keep the mark inside the safe circle
        done.append(save(place(adaptive, 0.5, WHITE), out, f'{d}/ic_launcher_foreground.png'))
        done.append(save(place(adaptive, 0, WHITE, BLACK), out, f'{d}/ic_launcher_background.png'))
    done.append(write(out, f'{RES}/values/ic_launcher_background.xml',
                      '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                      '    <color name="ic_launcher_background">#000000</color>\n</resources>\n'))
    # splash screens keep their sizes: light = black bars on white, night/dark = white on black
    splashes = glob.glob(os.path.join(ROOT, RES, 'drawable*/splash.png')) + \
        glob.glob(os.path.join(ROOT, 'ios/App/App/Assets.xcassets/Splash.imageset/*.png'))
    for p in splashes:
        rel = os.path.relpath(p, ROOT).replace('\\', '/')
        size = Image.open(p).size
        dark = 'night' in rel or 'dark' in rel
        done.append(save(place(size, 0.16, WHITE if dark else BLACK, BLACK if dark else WHITE), out, rel))
    done.append(save(download_button(), out, 'download_icon.png'))
    print(f'{len(done)} files written')


if __name__ == '__main__':
    main()

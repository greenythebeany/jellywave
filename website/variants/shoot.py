"""Screenshots of every design direction at 375 and 1440 px, dark and light,
into variants/screenshots/, plus one side-by-side sheet per width/theme.
Run with the dev server up:  python -I variants/shoot.py http://localhost:5173/"""
import os, sys
from playwright.sync_api import sync_playwright
from PIL import Image

BASE = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'http://localhost:5173'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots')
os.makedirs(OUT, exist_ok=True)
VARIANTS = ['a', 'b', 'c', 'd']
report = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for theme in ('dark', 'light'):
        for w in (375, 1440):
            page = browser.new_page(viewport={'width': w, 'height': 900 if w > 500 else 812}, color_scheme=theme,
                                    device_scale_factor=1 if w > 500 else 2)
            for v in VARIANTS:
                page.goto(f'{BASE}/variants/{v}.html?theme={theme}')
                page.wait_for_load_state('networkidle')
                page.evaluate('document.fonts.ready')
                # scroll through once so lazy images load, then back to the top
                page.evaluate('''async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); }''')
                page.wait_for_timeout(1500)
                path = os.path.join(OUT, f'{v}-{w}-{theme}.png')
                page.screenshot(path=path, full_page=True)
                over = page.evaluate('document.documentElement.scrollWidth - innerWidth')
                fonts = page.evaluate("[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight).join(', ')")
                report.append(f'{v} {w} {theme}: overflow {over}px; fonts: {fonts}')
            page.close()
    browser.close()

# side-by-side sheets: the first screens (and the full pages scaled down)
for theme in ('dark', 'light'):
    for w, cols_h in ((1440, 1800), (375, 2600)):
        ims = [Image.open(os.path.join(OUT, f'{v}-{w}-{theme}.png')).convert('RGB') for v in VARIANTS]
        tw = 700 if w == 1440 else 360
        thumbs = [im.resize((tw, round(im.height * tw / im.width))) for im in ims]
        thumbs = [t.crop((0, 0, tw, min(t.height, cols_h))) for t in thumbs]
        H = max(t.height for t in thumbs)
        sheet = Image.new('RGB', (len(thumbs) * (tw + 16) + 16, H + 32), (90, 90, 90))
        for i, t in enumerate(thumbs):
            sheet.paste(t, (16 + i * (tw + 16), 16))
        sheet.save(os.path.join(OUT, f'sheet-{w}-{theme}.jpg'), quality=82)
print('\n'.join(report))

"""Renders scripts/og.html to public/og.jpg (1200x630). Run: python scripts/og.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

here = Path(__file__).resolve().parent
png = here / 'og.png'
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1200, 'height': 630})
    page.goto((here / 'og.html').as_uri())
    page.evaluate('document.fonts.ready')
    page.wait_for_timeout(300)
    page.screenshot(path=str(png))
    browser.close()
Image.open(png).convert('RGB').save(here.parent / 'public' / 'og.jpg', quality=86, optimize=True)
png.unlink()

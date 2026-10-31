"""Local jam ZIP: skpy pack.py [--site-url https://host/path/].
Does not publish anything. A public URL makes social-image metadata absolute
inside the archive; source files are left unchanged.
"""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
from urllib.parse import urlsplit, urljoin
import argparse
import re
import zipfile

ROOT = Path(__file__).resolve().parent
FILES = ['index.html', 'style.css', 'model.js', 'campaign.js', 'nights.js', 'journey.js', 'story.js', 'art.js', 'menu.js',
         'backdrop.js', 'scene.js', 'render.js', 'display.js', 'game.js',
         'soundtrack.js', 'audio.js', 'audio-ui.js',
         'assets/preview.png', 'assets/jam-cover.png']


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        values = [attrs.get('src', '')]
        if tag == 'link':
            values.append(attrs.get('href', ''))
        if tag == 'a' and 'download' in attrs:
            values.append(attrs.get('href', ''))
        if tag == 'meta' and (attrs.get('property') == 'og:image' or attrs.get('name') == 'twitter:image'):
            values.append(attrs.get('content', ''))
        for value in values:
            parsed = urlsplit(value)
            if value and not parsed.scheme and not parsed.netloc and parsed.path:
                self.paths.add(parsed.path.removeprefix('./'))


def build(site_url=None):
    missing = [name for name in FILES if not (ROOT / name).is_file()]
    if missing:
        raise SystemExit(f'Не найдены файлы: {", ".join(missing)}')
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    refs = References()
    refs.feed(html)
    absent = sorted(refs.paths - set(FILES))
    if absent:
        raise SystemExit(f'В списке сборки нет ресурсов: {", ".join(absent)}')
    if site_url:
        parsed = urlsplit(site_url)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or not parsed.path.endswith('/'):
            raise SystemExit('--site-url: нужен публичный HTTPS-адрес папки с завершающим /, без пароля и query.')
        image_url = escape(urljoin(site_url, 'assets/preview.png'), quote=True)
        for key, name in [('property', 'og:image'), ('name', 'twitter:image')]:
            html = re.sub(rf'(<meta {key}="{name}" content=")[^"]+("\s*>)', lambda m: m[1] + image_url + m[2], html)
        html = html.replace('</head>', f'<meta property="og:url" content="{escape(site_url, quote=True)}">\n</head>')
    out = ROOT / 'dist'
    out.mkdir(exist_ok=True)
    target = out / 'karakurt-protiv-dedlajna.zip'
    # Write atomically: an interrupted build must not destroy the last good ZIP.
    temporary = target.with_suffix('.zip.tmp')
    with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in FILES:
            archive.writestr(name, html.encode('utf-8')) if name == 'index.html' else archive.write(ROOT / name, name)
    with zipfile.ZipFile(temporary) as archive:
        assert archive.testzip() is None, 'Повреждён архив'
    temporary.replace(target)
    print(f'{target} — {len(FILES)} файлов, {target.stat().st_size / 1024:.1f} КБ')
    if not site_url:
        print('Превью локальное. Для публичного сайта пересоберите с --site-url https://host/path/.')
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site-url', help='Публичный HTTPS-адрес папки игры, с завершающим /')
    build(parser.parse_args().site_url)

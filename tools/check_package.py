"""Validate the actual ZIP, exercise absolute social URLs in isolation, extract a preview.
Run after pack.py. Creates only a new .sharrowkin/jam-preview-* directory and temp files.
"""
from pathlib import Path
import importlib.util
import io
import shutil
import tempfile
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('jam_pack', ROOT / 'pack.py')
pack = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pack)
archive = ROOT / 'dist' / 'karakurt-protiv-dedlajna.zip'
with zipfile.ZipFile(archive) as source:
    assert source.testzip() is None
    assert set(source.namelist()) == set(pack.FILES), 'ZIP manifest differs'
    for name in pack.FILES:
        assert source.read(name) == (ROOT / name).read_bytes(), f'Stale resource: {name}'
    html = source.read('index.html').decode('utf-8')
    refs = pack.References()
    refs.feed(html)
    assert refs.paths <= set(source.namelist()), 'Missing HTML resources'
    for name, size in [('assets/preview.png', (1200, 630)), ('assets/jam-cover.png', (630, 500))]:
        data = source.read(name)
        with Image.open(io.BytesIO(data)) as image:
            assert image.size == size and image.format == 'PNG'
            image.verify()
    print(f'PASS: {len(pack.FILES)} exact current files; all local references; two valid PNG covers.')
    # Fixed manifest checked above, so no path traversal / arbitrary ZIP entries.
    base = ROOT / '.sharrowkin'
    base.mkdir(exist_ok=True)
    preview = Path(tempfile.mkdtemp(prefix='jam-preview-', dir=base))
    source.extractall(preview)
    print('ARCHIVE_PREVIEW_PATH=' + preview.relative_to(ROOT).as_posix() + '/index.html')

with tempfile.TemporaryDirectory(prefix='karakurt-pack-check-') as folder:
    pack.ROOT = Path(folder)
    for name in pack.FILES:
        target = pack.ROOT / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    before = (pack.ROOT / 'index.html').read_bytes()
    target = pack.build('https://example.invalid/karakurt/')
    with zipfile.ZipFile(target) as source:
        html = source.read('index.html').decode('utf-8')
        assert html.count('https://example.invalid/karakurt/assets/preview.png') == 2
        assert '<meta property="og:url" content="https://example.invalid/karakurt/">' in html
    assert (pack.ROOT / 'index.html').read_bytes() == before, 'Source was modified'
    for invalid in ['http://example.invalid/', 'https://example.invalid/game', 'https://user:pass@example.invalid/']:
        try:
            pack.build(invalid)
            raise AssertionError('Accepted invalid publication URL')
        except SystemExit:
            pass
    print('PASS: absolute OG/Twitter URLs, unchanged source, invalid URLs rejected. No publication performed.')

"""Remove the retired crash label while preserving artwork and game behavior."""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import fitz

ROOT = Path.cwd()
OUT = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'crash-cleanup-results'
OUT.mkdir(parents=True, exist_ok=True)
OLD = re.compile(r'moo[\W_]*napped!?', re.I)
VERSION = '20260922-crash-label-cleanup'
PDF = Path('assets/deliverables/Cow_and_Aliens_Test_Presentation.pdf')
SOURCE_HASH = '5ce7a2d938b1a1412aaf0921e4407467dd8a324c698294b12e6318357cfcc7c2'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def tracked():
    return [Path(p) for p in subprocess.check_output(['git', 'ls-files', '-z']).decode().split('\0') if p]


def text_content(path):
    if not path.is_file() or path.stat().st_size > 8_000_000:
        return None
    data = path.read_bytes()
    if b'\0' in data:
        return None
    try:
        return data.decode('utf-8')
    except UnicodeError:
        return None


def rewrite(text, path):
    text = re.sub(r'<section\b[^>]*>\s*<h2>About the name</h2>[\s\S]*?</section>\s*', '', text, flags=re.I)
    substitutions = [
        (OLD.pattern + r'\s+is a character-led crash concept built around', 'This character-led crash concept is built around'),
        (OLD.pattern + r'\s+Final game screens\.', 'Final crash game screens.'),
        (OLD.pattern + r'\s+Crash game\.', 'Crash game presentation.'),
        (OLD.pattern + r'\s+Crash concept', 'Crash-game concept'),
        (r'the\s+' + OLD.pattern + r'\s+game', 'the crash game'),
        (r'for\s+' + OLD.pattern, 'for the crash game.'),
        (OLD.pattern + r'\s+·\s+CRASH', 'CRASH GAME'),
        (OLD.pattern + r'\s+/\s+CRASH\s+/', 'CRASH GAME /'),
    ]
    for pattern, replacement in substitutions:
        text = re.sub(pattern, replacement, text, flags=re.I)
    if path.as_posix() == 'source-notes/reviewer-redesign.md':
        text = re.sub(r'^- Working title[^\n]*$', '- Neutral Crash Game labels across page branding and browser titles.', text, flags=re.M)
    text = OLD.sub('Crash Game', text)
    # Keep the existing PDF address, but refresh links to bypass cached copies.
    text = re.sub(r'(Cow_and_Aliens_Test_Presentation\.pdf)(?:\?v=[^\s\"\'<>]*)?', r'\1?v=' + VERSION, text)
    # Download filenames must not contain URL query parameters.
    text = text.replace('download="Cow_and_Aliens_Test_Presentation.pdf?v=' + VERSION + '"', 'download="Cow_and_Aliens_Test_Presentation.pdf"')
    for filename in ('site.js', 'scene-player.js'):
        text = re.sub(r'(/game-art-review/' + re.escape(filename) + r')(?:\?v=[^\s\"\'<>]*)?', r'\1?v=' + VERSION, text)
    if path.as_posix() == 'site.js':
        text = text.replace("active + '-content.html'", "active + '-content.html?v=" + VERSION + "'")
    if path.as_posix() == 'instant/index.html':
        text = text.replace('<title>Game Art Review · Crash Game</title>', '<title>Game Art Review · Instant Game</title>')
    return text


def apply():
    paths = tracked()
    before_hashes = {p.as_posix(): sha(p.read_bytes()) for p in paths if p.is_file()}
    original_pdf = PDF.read_bytes()
    if sha(original_pdf) != SOURCE_HASH:
        raise RuntimeError('The source presentation changed after inspection. Refusing to overwrite a newer PDF.')
    changes = []
    for p in paths:
        if p.parts[0] == '.github':
            continue
        text = text_content(p)
        if text is None:
            continue
        updated = rewrite(text, p)
        if text != updated:
            p.write_text(updated, encoding='utf-8')
            changes.append(p.as_posix())

    doc = fitz.open(stream=original_pdf, filetype='pdf')
    if len(doc) != 25:
        raise RuntimeError('Unexpected presentation page count.')
    page = doc[0]
    spans = [s for b in page.get_text('dict', flags=0)['blocks'] for line in b.get('lines', []) for s in line['spans']]
    old_parts = {'MOO' + '-', 'NAPPED' + '!'}
    title_spans = sorted([s for s in spans if s['text'] in old_parts], key=lambda s:s['origin'][1])
    if len(title_spans) != 2:
        raise RuntimeError('The inspected two-line cover title was not found.')
    for span in title_spans:
        page.add_redact_annot(fitz.Rect(span['bbox']), fill=False, cross_out=False)
    # Remove only text: no image deletion, recoloring, or vector deletion.
    page.apply_redactions(images=0, graphics=0, text=0)
    font = '/usr/share/fonts/opentype/urw-base35/URWBookman-Demi.otf'
    page.insert_font(fontname='CrashCover', fontfile=font)
    for span, replacement in zip(title_spans, ('CRASH', 'GAME')):
        c = span['color']
        color = ((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255)
        page.insert_text(span['origin'], replacement, fontname='CrashCover', fontsize=span['size'], color=color)
    metadata = doc.metadata
    metadata['title'] = 'Crash Game - Final assets presentation'
    metadata['keywords'] = 'crash game, cow, farmer, alien, UFO, final Figma, review'
    doc.set_metadata(metadata)
    xml = doc.get_xml_metadata()
    if xml:
        doc.set_xml_metadata(OLD.sub('Crash Game', xml))
    temporary = OUT / PDF.name
    doc.save(temporary, garbage=4, deflate=True)
    doc.close()
    clean = fitz.open(temporary)
    original = fitz.open(stream=original_pdf, filetype='pdf')
    unchanged = []
    for i in range(1, 25):
        a = clean[i].get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
        b = original[i].get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
        if a.samples != b.samples:
            raise RuntimeError(f'Unexpected visual change on page {i + 1}.')
        unchanged.append(i + 1)
    # The cover artwork and supporting copy are unchanged outside the title area.
    a = clean[0].get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
    b = original[0].get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
    for y in range(a.height):
        for x in range(a.width):
            if 45 <= x <= 430 and 115 <= y <= 300:
                continue
            at = (y * a.width + x) * 3
            if a.samples_mv[at:at+3] != b.samples_mv[at:at+3]:
                raise RuntimeError('Unexpected cover change outside the title region.')
    clean[0].get_pixmap(matrix=fitz.Matrix(1.3, 1.3), alpha=False).save(OUT / 'cover-after.png')
    if clean[24].get_links() == [] and original[24].get_links():
        raise RuntimeError('Figma link lost from the PDF.')
    clean.close()
    original.close()
    PDF.write_bytes(temporary.read_bytes())
    changes.append(PDF.as_posix())

    residual = []
    for p in paths:
        if p.parts[0] in {'.git', '.github'}:
            continue
        if OLD.search(p.as_posix()):
            residual.append(p.as_posix())
        text = text_content(p)
        if text is not None and OLD.search(text):
            residual.append(p.as_posix())
        if p.suffix.lower() == '.pdf':
            with fitz.open(p) as pdf:
                contents = '\n'.join(page.get_text() for page in pdf) + str(pdf.metadata) + pdf.get_xml_metadata() + str(pdf.get_toc())
                if OLD.search(contents):
                    residual.append(p.as_posix())
    if residual:
        raise RuntimeError('Retired label remains in: ' + str(residual))
    # Apart from the presentation, existing binary artwork must be byte-identical.
    unchanged_art = 0
    for p in paths:
        if p.suffix.lower() in {'.png','.jpg','.jpeg','.webp','.svg','.ttf','.woff','.woff2','.mp4'}:
            if sha(p.read_bytes()) != before_hashes[p.as_posix()]:
                raise RuntimeError('Unexpected artwork change: ' + str(p))
            unchanged_art += 1
    report = {
        'changed_files': sorted(set(changes)),
        'remaining_retired_label_matches': 0,
        'pdf_pages': 25,
        'pdf_pages_pixel_identical': unchanged,
        'cover_artwork_preserved': True,
        'unchanged_artwork_files': unchanged_art,
        'pdf_sha256': sha(PDF.read_bytes()),
        'pdf_bytes': PDF.stat().st_size,
        'version': VERSION,
        'expected_live_hashes': {p:sha(Path(p).read_bytes()) for p in sorted(set(changes))},
    }
    (OUT / 'verification.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


def verify_live():
    report = json.loads((OUT / 'verification.json').read_text())
    base = 'https://norohtn.github.io/game-art-review/'
    for path, expected in report['expected_live_hashes'].items():
        url = base + path + '?v=' + VERSION
        for attempt in range(12):
            try:
                request = urllib.request.Request(url, headers={'Cache-Control':'no-cache', 'User-Agent':'Game-Art-Review-Verification/1.0'})
                with urllib.request.urlopen(request, timeout=60) as response:
                    data = response.read()
                if sha(data) == expected:
                    print('LIVE VERIFIED:', path)
                    break
                error = 'stale public cache'
            except Exception as exc:
                error = str(exc)
            if attempt == 11:
                raise RuntimeError('Live verification failed for ' + path + ': ' + error)
            time.sleep(10)
    report['live_files_verified'] = len(report['expected_live_hashes'])
    report['live_pdf_verified'] = True
    (OUT / 'verification.json').write_text(json.dumps(report, indent=2))
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f:
        f.write('## Crash-label cleanup complete\n\n')
        f.write(f"Updated and verified {report['live_files_verified']} live files. No retired-label matches remain.\n\n")
        f.write('The 25-page PDF has a neutral cover and metadata. Pages 2–25 are pixel-identical to the prior presentation. All artwork and game screens are preserved.\n')


if __name__ == '__main__':
    {'apply': apply, 'verify-live': verify_live}[sys.argv[1]]()

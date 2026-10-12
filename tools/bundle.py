# Bundles the game into one self-contained HTML file (for the claude.ai artifact or a single-file copy).
# The repository itself needs no build: index.html loads styles/main.css and src/ directly.
# Each src file becomes its own inline <script>, in the same order, so the scripts share the global scope
# exactly as the <script src> tags do.
# usage: python3 tools/bundle.py out.html [--body]   (--body: no <html>/<head>/<body> wrapper, artifact style)
import base64, re, sys, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out, body_only = sys.argv[1], '--body' in sys.argv
page = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
css = open(os.path.join(root, 'styles/main.css'), encoding='utf-8').read()
def script(m):
    filename = m.group(1)
    src = open(os.path.join(root, filename), encoding='utf-8').read()
    if filename == 'src/data/npc-atlases.js':
        # A real standalone HTML must carry both NPC PNGs: relative URLs cannot
        # resolve after dist/ascii-meadow.html is copied anywhere on its own.
        # Replace manifest path literals only; the normal web build is untouched.
        def inline_png(match):
            relative = match.group(2)
            if not re.fullmatch(r'assets/npc/[A-Za-z0-9_-]+\.png', relative):
                sys.exit('unsafe NPC atlas path in manifest: ' + relative)
            path = os.path.join(root, relative)
            with open(path, 'rb') as file:
                data = file.read()
            if not data.startswith(b'\x89PNG\r\n\x1a\n'):
                sys.exit('invalid NPC atlas PNG: ' + relative)
            return match.group(1) + 'data:image/png;base64,' + base64.b64encode(data).decode('ascii') + match.group(3)
        src, count = re.subn(r"(source:\s*['\"])(assets/npc/[^'\"\n]+)(['\"])", inline_png, src)
        if count != 2:
            sys.exit('standalone bundle expected exactly 2 NPC PNG atlases, found ' + str(count))
    if re.search(r'</script', src, re.I): sys.exit('cannot inline %s: it contains </script' % filename)
    return '<script>\n' + src + '</script>'
page = page.replace('<link rel="stylesheet" href="styles/main.css">', '<style>\n' + css + '</style>')
page = re.sub(r'<script src="([^"]+)"></script>', script, page)
if body_only:
    head = page[page.index('<title>'):page.index('</head>')]
    page = head + page[page.index('<body>') + len('<body>'):page.index('</body>')]
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, 'w', encoding='utf-8').write(page)
print(out, len(page), 'bytes')

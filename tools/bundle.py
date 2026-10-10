# Bundles the game into one self-contained HTML file (for the claude.ai artifact or a single-file copy).
# The repository itself needs no build: index.html loads styles/main.css and src/ directly.
# Each src file becomes its own inline <script>, in the same order, so the scripts share the global scope
# exactly as the <script src> tags do.
# usage: python3 tools/bundle.py out.html [--body]   (--body: no <html>/<head>/<body> wrapper, artifact style)
import re, sys, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out, body_only = sys.argv[1], '--body' in sys.argv
page = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
css = open(os.path.join(root, 'styles/main.css'), encoding='utf-8').read()
def script(m):
    src = open(os.path.join(root, m.group(1)), encoding='utf-8').read()
    if re.search(r'</script', src, re.I): sys.exit('cannot inline %s: it contains </script' % m.group(1))
    return '<script>\n' + src + '</script>'
page = page.replace('<link rel="stylesheet" href="styles/main.css">', '<style>\n' + css + '</style>')
page = re.sub(r'<script src="([^"]+)"></script>', script, page)
if body_only:
    head = page[page.index('<title>'):page.index('</head>')]
    page = head + page[page.index('<body>') + len('<body>'):page.index('</body>')]
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, 'w', encoding='utf-8').write(page)
print(out, len(page), 'bytes')

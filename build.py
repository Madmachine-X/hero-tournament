import pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
enc = dict(encoding='utf-8')
shell = (src / 'shell.html').read_text(**enc)
css = (src / 'style.css').read_text(**enc)
js = '\n'.join((src / f).read_text(**enc) for f in ['data.js', 'game.js', 'story.js', 'sprites.js', 'battle.js', 'map.js', 'main.js'])
out = shell.replace('/*__CSS__*/', css).replace('/*__JS__*/', js)
# Claude 아티팩트 게시용 (문서 껍데기 없이 본문만)
(root / 'cheonha.html').write_text(out, **enc)
# 브라우저에서 바로 여는 완전한 문서 (로컬 실행·테스트용)
(root / 'index.html').write_text('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + out + '</body></html>', **enc)
print(len(out))

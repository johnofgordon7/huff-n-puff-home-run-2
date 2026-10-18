from pathlib import Path
import re,json,base64
root=Path(__file__).resolve().parents[1];d=root/'dist'
s=(d/'review-game.html').read_text(encoding='utf-8')
# Embed artwork once in the sandbox document; normal review page uses local assets.
art_paths={'johnny-sheet.png': 'assets/official-hnp-v1/wolf.webp', 'horizon.webp': 'assets/huff/forest-stadium.png', 'chicken/rig-atlas.png': 'assets/official-hnp-v1/pig-wood.webp', 'pig-straw': 'assets/official-hnp-v1/pig-straw.webp', 'pig-brick': 'assets/official-hnp-v1/pig-brick.webp', 'official-hat': 'assets/official-hnp-v1/hard-hat.webp', 'props.png': 'assets/huff/props.png', 'bird.png': 'assets/huff/seagull.webp', 'home-sign': 'assets/huff/home-plate-sign.webp'}
art={k:'data:image/'+('webp' if v.endswith('.webp') else 'png')+';base64,'+base64.b64encode((d/v).read_bytes()).decode() for k,v in art_paths.items()}
s=re.sub(r'<script src="game[.]js[^\"]*"></script>',lambda m:'<script>window.__reviewArt='+json.dumps(art)+';</script>'+m[0],s)
s=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(d/m[1].split('?')[0]).read_text(encoding='utf-8')+'</style>',s)
s=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>'+(d/m[1].split('?')[0]).read_text(encoding='utf-8').replace('</script','<\\/script')+'</script>',s)
# All image and font URLs become self-contained; opaque sandbox requests no protected assets.
def inline(m):
 value=m[2]
 if value.startswith('data:'):return m[0]
 file=d/value
 if not file.is_file():raise ValueError('Unresolved preview resource: '+value)
 mime={'.svg':'image/svg+xml','.ttf':'font/ttf','.png':'image/png','.webp':'image/webp'}[file.suffix]
 return 'url("data:'+mime+';base64,'+base64.b64encode(file.read_bytes()).decode()+'")'
s=re.sub(r'url\(([\'\"]?)([^)\'\"]+)\1\)',inline,s)
s=re.sub(r'(<img[^>]*src=")([^"<]+)(")',lambda m:m[0] if m[2].startswith('data:') else m[1]+'data:'+('image/svg+xml' if m[2].endswith('.svg') else 'image/webp' if m[2].endswith('.webp') else 'image/png')+';base64,'+base64.b64encode((d/m[2]).read_bytes()).decode()+m[3],s)
(d/'review-document.js').write_text('window.IGReviewDocument='+json.dumps(s)+';\n',encoding='utf-8')
print('Built self-contained sandbox document')

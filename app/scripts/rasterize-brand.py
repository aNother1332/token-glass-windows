import pathlib,pymupdf
base=pathlib.Path('D:/TOKSCALE/app/ui/assets')
svg=(base/'copilot.svg').read_text(encoding='utf-8-sig')
for name,color in [('copilot','#26313b'),('copilot-dark','#e5ecf2')]:
    doc=pymupdf.open(stream=svg.replace('<svg ','<svg fill="'+color+'" ',1).encode(),filetype='svg')
    doc[0].get_pixmap(matrix=pymupdf.Matrix(4,4),alpha=True).save(base/(name+'.png'))

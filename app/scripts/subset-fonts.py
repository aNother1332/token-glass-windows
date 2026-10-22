import pathlib,sys,json,re,shutil
sys.path.insert(0,'D:/TOKSCALE/work/font-tools')
from fontTools.ttLib import TTFont
from fontTools import subset
base=pathlib.Path('D:/TOKSCALE');dest=base/'app/ui/fonts';dest.mkdir(parents=True,exist_ok=True)
text=''.join(p.read_text(encoding='utf-8-sig') for root in [base/'app/ui',base/'app/src',base/'native'] for p in root.rglob('*') if p.suffix in ['.js','.cjs','.html','.cs'])
chars=set(range(32,127))|{ord(c) for c in text if ord(c)>127}
report=[]
for style in ['Regular','SemiBold']:
    font=TTFont(base/f'work/fonts/MapleMono-CN-{style}.ttf')
    opts=subset.Options();opts.name_IDs=['*'];opts.name_legacy=True;opts.name_languages=['*'];opts.notdef_outline=True;opts.recalc_timestamp=False
    worker=subset.Subsetter(options=opts);worker.populate(unicodes=chars);worker.subset(font)
    for platform,encoding,lang in [(3,1,0x409),(1,0,0)]:
        for key,value in {1:'TokenGlass Maple',2:'Bold' if style=='SemiBold' else 'Regular',3:f'TokenGlassMaple-{style}-7.9',4:f'TokenGlass Maple {style}',6:f'TokenGlassMaple-{style}',16:'TokenGlass Maple',17:'Bold' if style=='SemiBold' else 'Regular'}.items():font['name'].setName(value,key,platform,encoding,lang)
    if style=='SemiBold':font['OS/2'].fsSelection=(font['OS/2'].fsSelection|32)&~64;font['head'].macStyle|=1
    ttf=dest/f'TokenGlassMaple-{style}.ttf';font.save(ttf);font.flavor='woff2';woff=dest/f'TokenGlassMaple-{style}.woff2';font.save(woff)
    report.append({'style':style,'glyphs':len(font.getGlyphOrder()),'ttfBytes':ttf.stat().st_size,'woff2Bytes':woff.stat().st_size})
shutil.copyfile(base/'work/fonts/OFL.txt',dest/'OFL.txt')
(dest/'BUILD.json').write_text(json.dumps({'source':'Maple Mono CN v7.9','sourceURL':'https://github.com/subframe7536/maple-font/releases/tag/v7.9','requestedCodepoints':len(chars),'fonts':report},indent=2),encoding='utf8')
print(json.dumps(report))

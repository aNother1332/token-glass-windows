import urllib.request,struct,zlib,pathlib,hashlib,json,subprocess
out=pathlib.Path('D:/TOKSCALE/work/fonts');out.mkdir(parents=True,exist_ok=True)
url='https://github.com/subframe7536/maple-font/releases/download/v7.9/MapleMono-CN.zip'
def read_range(start,end):
    result=subprocess.run(['gh','api','repos/subframe7536/maple-font/releases/assets/324740703','-H','Accept: application/octet-stream','-H',f'Range: bytes={start}-{end}'],capture_output=True,timeout=120,check=True)
    if len(result.stdout)!=end-start+1:raise RuntimeError('Server did not honor bounded range request')
    return result.stdout
size=140799242
tail=read_range(size-65557,size-1);p=tail.rfind(b'PK\x05\x06')
_,_,_,_,_,cdsize,cdoff,_=struct.unpack_from('<4s4H2IH',tail,p)
cd=read_range(cdoff,cdoff+cdsize-1);i=0;selected=[]
while cd[i:i+4]==b'PK\x01\x02':
    f=struct.unpack_from('<4s6H3I5H2I',cd,i);n,e,c=f[10:13];name=cd[i+46:i+46+n].decode();offset=f[-1];compressed=f[8]
    if name.endswith(('MapleMono-CN-Regular.ttf','MapleMono-CN-SemiBold.ttf','OFL.txt')):
        header=read_range(offset,offset+29);ln,le=struct.unpack_from('<HH',header,26);start=offset+30+ln+le
        body=read_range(start,start+compressed-1);data=zlib.decompress(body,-15) if f[4]==8 else body
        if zlib.crc32(data)!=f[7]:raise RuntimeError('CRC mismatch')
        target=out/pathlib.PurePosixPath(name).name;target.write_bytes(data);selected.append({'file':target.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    i+=46+n+e+c
print(json.dumps(selected))

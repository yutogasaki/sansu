"""Read old full registries or Sansu's lossless generated shards."""
import base64,gzip,hashlib,json,re
from pathlib import Path
def load_registry(portal):
    portal=Path(portal);catalog=json.loads((portal/'data/unification.json').read_text())
    if isinstance(catalog.get('items'),list):return catalog
    storage=catalog.pop('itemStorage')
    if storage['format']!='sansu-record-shards/1':raise ValueError('Unsupported registry storage')
    items=[]
    for row in storage['shards']:
        if not re.fullmatch(r'data/records/[a-f0-9]+\.js',row['path']):raise ValueError('Unsafe registry shard')
        data=(portal/row['path']).read_bytes()
        if hashlib.sha256(data).hexdigest()!=row['sha256']:raise ValueError('Registry shard hash mismatch')
        match=re.fullmatch(rb'window\.__sansuRegistryChunks\[("[^"]+")\]=("[A-Za-z0-9+/=]+")\s*;\n?',data)
        if not match or json.loads(match[1])!=row['id']:raise ValueError('Invalid registry shard')
        chunk=json.loads(gzip.decompress(base64.b64decode(json.loads(match[2]))))
        if len(chunk)!=row['count']:raise ValueError('Registry shard count mismatch')
        items.extend(chunk)
    if len(items)!=storage['count']:raise ValueError('Registry item count mismatch')
    return dict(catalog,items=items)

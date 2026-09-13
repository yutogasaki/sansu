"""Offline study geometry only; NumPy/scikit-image are not application dependencies."""
import sys,json,hashlib
from pathlib import Path
import numpy as np
from scipy.ndimage import map_coordinates
from skimage.measure import marching_cubes
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

source=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=False)
spec=json.loads(source.read_text());step=.08
lo=np.array([-4.1,-1.15,-5.2],dtype=np.float32);hi=np.array([4.6,5.3,-2.2],dtype=np.float32)
axes=[np.arange(a,b+step,step,dtype=np.float32) for a,b in zip(lo,hi)]
X=np.stack(np.meshgrid(*axes,indexing='ij'),axis=-1)
def spine_distance(coords,spine):
    result=np.full(coords.shape[:-1],100,dtype=np.float32)
    points=np.asarray(spine['points'],dtype=np.float32)
    for a,b in zip(points[:-1],points[1:]):
        d=b[:3]-a[:3];t=np.clip(np.sum((coords-a[:3])*d,axis=-1)/np.sum(d*d),0,1)
        dist=np.linalg.norm(coords-a[:3]-t[...,None]*d,axis=-1)-(a[3]+t*(b[3]-a[3]))
        result=np.minimum(result,dist)
    return result

def smooth_union(a,b,k):
    h=np.maximum(k-np.abs(a-b),0)/k
    return np.minimum(a,b)-h*h*k*.25

def linear(hex_color):
    rgb=np.array([int(hex_color[i:i+2],16)/255 for i in (1,3,5)])
    return np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)

manifest={'spinesSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'step':step,'coordinateSpace':spec['coordinateSpace'],'variants':{}}
for name,cfg in spec['variants'].items():
    fields=[spine_distance(X,s) for s in cfg['spines']]
    field=fields[0].copy()
    for f in fields[1:]:field=smooth_union(field,f,cfg['blend'])
    # Never grow new root mass toward the playable first row. Preserve the traced base volume there.
    base=np.minimum.reduce(fields[:cfg['baseCount']])
    # Two-cell halo also protects interpolation and gradient stencils at the visible boundary.
    protected=(X[...,2]>-2.5-2*step)&(X[...,1]<1.2+2*step)
    field=np.where(protected,np.maximum(field,base),field)
    vertices,faces,_,_=marching_cubes(field,level=0,spacing=(step,step,step),gradient_direction='ascent')
    vertices+=lo
    a=np.concatenate([faces[:,0],faces[:,1],faces[:,2]]);b=np.concatenate([faces[:,1],faces[:,2],faces[:,0]])
    _,labels=connected_components(coo_matrix((np.ones(len(a)),(a,b)),shape=(len(vertices),len(vertices))),directed=False)
    sizes=np.bincount(labels);largest=int(sizes.argmax());removed=[]
    for component,size in enumerate(sizes):
        if component!=largest:
            assert size<=12 and size/len(vertices)<.001, 'Substantial disconnected timber: reject geometry'
            removed.append({'vertices':int(size),'bounds':[vertices[labels==component].min(0).tolist(),vertices[labels==component].max(0).tolist()]})
    if removed:
        keep=labels==largest;mapping=np.cumsum(keep)-1
        faces=mapping[faces[np.all(keep[faces],axis=1)]];vertices=vertices[keep]
    coords=((vertices-lo)/step).T
    normals=np.stack([map_coordinates(g,coords,order=1,mode='nearest') for g in np.gradient(field,step)],axis=1)
    normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-8)
    tri=vertices[faces]
    if np.mean(np.sum(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])*normals[faces].mean(axis=1),axis=1))<0:faces=faces[:,::-1]
    distances=np.stack([spine_distance(vertices,s) for s in cfg['spines']],axis=1)
    weights=np.exp(-np.clip(distances-distances.min(axis=1,keepdims=True),0,10)*7)
    cool=np.array([s['cool'] for s in cfg['spines']],dtype=np.float32)
    amount=(weights*cool).sum(axis=1)/weights.sum(axis=1)
    colors=linear('#e2d4b7')[None,:]*(1-amount[:,None])+linear('#75a89b')[None,:]*amount[:,None]
    bend=np.clip((vertices[:,1]-.8)/1.8,0,1);bend=bend*bend*(3-2*bend)
    uv=np.stack([(vertices[:,1]+1)*.16+(2.9-vertices[:,0])*.13*bend,(vertices[:,2]+4.5)*.3],axis=1)
    attributes={}
    for key,data in [('position',vertices),('normal',normals),('uv',uv),('color',colors)]:
        assert np.isfinite(data).all();attributes[key]={'itemSize':data.shape[1],'type':'Float32Array','array':np.round(data,5).reshape(-1).tolist()}
    geometry={'metadata':{'version':4.7,'type':'BufferGeometry','generator':'Sansu offline smooth timber study'},'data':{'attributes':attributes,'index':{'type':'Uint32Array','array':faces.reshape(-1).tolist()}}}
    path=out/(name+'.json');path.write_text(json.dumps(geometry,separators=(',',':')))
    manifest['variants'][name]={'vertices':len(vertices),'triangles':len(faces),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bounds':[vertices.min(axis=0).tolist(),vertices.max(axis=0).tolist()],'blend':cfg['blend'],'removedSubvoxelComponents':removed}
    print(name,len(vertices),len(faces),flush=True)
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')

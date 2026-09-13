import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { disposeGeometry } from '../three/primitives';
import { loadCanopySculpt } from './canopySculptStudy';

afterEach(()=>vi.restoreAllMocks());
function fixture() {
    let done: ((g:T.BufferGeometry)=>void)|undefined, fail:((error:unknown)=>void)|undefined;
    vi.spyOn(T.BufferGeometryLoader.prototype,'load').mockImplementation((_url,onLoad,_progress,onError)=>{done=onLoad;fail=onError;});
    const root=new T.Group(),timber=new T.Group(),material=new T.MeshStandardMaterial();root.add(timber);
    const stop=loadCanopySculpt(root,timber,material,'traced');
    return{root,timber,material,stop,done:(g:T.BufferGeometry)=>done!(g),fail:()=>fail!(new Error('offline'))};
}
it('keeps original timber during loading and on failure',()=>{
    const f=fixture();expect(f.timber.visible).toBe(true);f.fail();
    expect(f.timber.visible).toBe(true);expect(f.root.children).toHaveLength(1);expect(f.root.userData.sculptStatus).toBe('fallback');f.stop();f.material.dispose();
});
it('switches to the unified mesh only when ready, with geometry owned by the scene',()=>{
    const f=fixture(),geometry=new T.BoxGeometry(),disposed=vi.fn();geometry.addEventListener('dispose',disposed);
    f.done(geometry);expect(f.timber.visible).toBe(false);expect(f.root.userData.sculptStatus).toBe('ready');
    expect((f.root.getObjectByName('life-canopy-sculpt') as T.Mesh).material).toBe(f.material);
    f.stop();disposeGeometry(f.root);expect(disposed).toHaveBeenCalledOnce();f.material.dispose();
});
it('releases a late geometry without reviving a closed scene',()=>{
    const f=fixture(),geometry=new T.BoxGeometry(),disposed=vi.fn();geometry.addEventListener('dispose',disposed);
    f.stop();f.done(geometry);expect(f.timber.visible).toBe(true);expect(f.root.children).toHaveLength(1);expect(disposed).toHaveBeenCalledOnce();f.material.dispose();
});
const load=(variant:string)=>new T.BufferGeometryLoader().parse(JSON.parse(readFileSync(new URL(`../../../../docs/design/2026-09-14-canopy-sculpt/meshes/${variant}.json`,import.meta.url),'utf8')));
it('loads three closed, connected meshes and preserves the traced foreground volume',()=>{
    let originalForeground:Set<string>|undefined;
    for(const variant of ['traced','buttress','recess']) {
        const g=load(variant),pos=g.getAttribute('position'),indices=g.index!,edges=new Map<number,number>(),parent=Array.from({length:pos.count},(_,i)=>i),foreground=new Set<string>();
        const find=(v:number):number=>{while(parent[v]!==v){parent[v]=parent[parent[v]];v=parent[v];}return v;};
        try {
            for(const key of ['position','normal','uv','color']) expect(Array.from(g.getAttribute(key).array).every(Number.isFinite)).toBe(true);
            for(let i=0;i<indices.count;i+=3) for(let j=0;j<3;j++) {
                const a=indices.getX(i+j),b=indices.getX(i+(j+1)%3);expect(a).toBeLessThan(pos.count);
                parent[find(a)]=find(b);const key=Math.min(a,b)*pos.count+Math.max(a,b);edges.set(key,(edges.get(key)??0)+1);
            }
            expect([...edges.values()].every(count=>count===2)).toBe(true);
            expect(new Set(parent.map((_,i)=>find(i))).size).toBe(1);
            for(let i=0;i<pos.count;i++) if(pos.getZ(i)>-2.5&&pos.getY(i)<1.2) foreground.add([pos.getX(i),pos.getY(i),pos.getZ(i)].join(','));
            expect(foreground.size).toBeGreaterThan(0);
            if(originalForeground) expect(foreground).toEqual(originalForeground);else originalForeground=foreground;
        } finally {g.dispose();}
    }
});

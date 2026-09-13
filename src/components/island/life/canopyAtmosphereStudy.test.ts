import {expect,it,vi} from 'vitest';
import * as T from 'three';
import {createCanopyLightingStudy} from './canopyAtmosphereStudy';

it('restores the exact caller lighting when returning from a current scene to an old memory',()=>{
    const scene=new T.Scene(),hemi=new T.HemisphereLight('#eeeeee','#557788',1.4),sun=new T.DirectionalLight('#fffabc',2.1);
    sun.position.set(-2,9,5);scene.add(hemi,sun);
    const original={sky:hemi.color.clone(),ground:hemi.groundColor.clone(),hi:hemi.intensity,sun:sun.color.clone(),si:sun.intensity,position:sun.position.clone()};
    const study=createCanopyLightingStudy(scene,hemi,sun);
    for(const variant of ['garden','shelter','sunroom'] as const) {
        study.set(variant);study.set();
        expect(hemi.color).toEqual(original.sky);expect(hemi.groundColor).toEqual(original.ground);expect(hemi.intensity).toBe(original.hi);
        expect(sun.color).toEqual(original.sun);expect(sun.intensity).toBe(original.si);expect(sun.position).toEqual(original.position);
    }
    study.dispose();expect(scene.children).toEqual([hemi,sun]);sun.dispose();
});
it('reuses one fill light without adding shadow render targets and releases only that light',()=>{
    const scene=new T.Scene(),hemi=new T.HemisphereLight(),sun=new T.DirectionalLight(),originalDisposed=vi.spyOn(sun,'dispose');scene.add(hemi,sun);
    const study=createCanopyLightingStudy(scene,hemi,sun),fill=scene.children.find(c=>c!==hemi&&c!==sun) as T.DirectionalLight,fillDisposed=vi.spyOn(fill,'dispose');
    for(let i=0;i<10;i++)study.set(i%2?'shelter':'sunroom');
    expect(scene.children).toHaveLength(3);expect(fill.castShadow).toBe(false);expect(fill.shadow.map).toBeNull();
    study.dispose();expect(fillDisposed).toHaveBeenCalledOnce();expect(originalDisposed).not.toHaveBeenCalled();sun.dispose();
});

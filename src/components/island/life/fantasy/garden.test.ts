import { expect, it } from 'vitest';
import * as T from 'three';
import { newLife, type LifeState } from '../../../../domain/islandLife/model';
import { replayLife } from '../../../../domain/islandLife/simulation';
import { sceneDigest } from '../../../../domain/islandLife/discoveryJournal';
import { buildLifeScene } from '../scene';
import { canReuseLifeScene } from '../sceneReuse';
import { prepareGardenWater } from './worldWater';

function garden(): LifeState {
    return { ...replayLife(newLife('garden-owner',1000)), worldStyle:'fantasy-garden-v1', gardenTime:'night', waterMagicVersion:1,
        items:[{id:'water',kind:'water-bowl',cell:{x:3,z:3},style:'original',growth:0},
            {id:'lamp',kind:'lantern',cell:{x:4,z:3},style:'original',growth:0}] };
}

it('captures the actual owner, water input and viewing time without modifying the wallet or simulation',async()=>{
    const state=garden(), before=structuredClone(state), point:[number,number]=[.1,-.05];
    const event=await prepareGardenWater('garden-owner',state,'water',point);
    expect(event).toMatchObject({profileId:'garden-owner',source:'live',ruleId:'M4',focalResidentIds:[],
        snapshot:{scene:{worldStyle:'fantasy-garden-v1',gardenTime:'night',waterTouch:{itemId:'water',point:[.1,-.05]}}}});
    point[0]=.2;state.items[0].cell={x:0,z:4};
    expect(event!.snapshot.immutableHash).toBe(await sceneDigest(event!.snapshot.scene));
    expect(event!.snapshot.scene.items[0].cell).toEqual(before.items[0].cell);
    expect(state.drops).toBe(before.drops);expect(state.light).toBe(before.light);expect(state.waterTouch).toBeUndefined();
});

it('has no magical event without the real lamp relation, and rejects off-surface input',async()=>{
    const state=garden();
    expect(await prepareGardenWater('garden-owner',{...state,items:state.items.slice(0,1)},'water',[0,0])).toBeUndefined();
    expect(await prepareGardenWater('garden-owner',state,'missing',[0,0])).toBeUndefined();
    expect(await prepareGardenWater('garden-owner',{...state,waterMagicVersion:undefined},'water',[0,0])).toBeUndefined();
    await expect(prepareGardenWater('garden-owner',state,'water',[2,0])).rejects.toThrow();
});

it('keeps gaze joints, cell picking and the same simulation when changing the time of day',()=>{
    const state=garden(), before=structuredClone(state), scene=buildLifeScene(state);
    try {
        scene.animate(state.now,true);
        const head=scene.root.getObjectByName('life-hero-head')!;
        expect(head.children.length).toBeGreaterThan(0);
        expect(new T.Box3().setFromObject(head).getSize(new T.Vector3()).y).toBeGreaterThan(.2);
        expect(scene.clickables).toHaveLength(30);
        // Invisible grid overlays still raycast; the world is not painted with a grid.
        expect(scene.clickables.every(cell=>!cell.visible)).toBe(true);
        const point=scene.point({x:0,z:4});scene.root.updateMatrixWorld(true);
        const ray=new T.Raycaster(point.clone().add(new T.Vector3(0,5,0)),new T.Vector3(0,-1,0));
        expect(ray.intersectObjects(scene.clickables)[0].object.userData.cell).toEqual({x:0,z:4});
        scene.setGardenTime('day');expect(scene.snapshot().gardenTime).toBe('day');
        expect(state).toEqual(before);
        expect(canReuseLifeScene({state,changeKey:'same'}, {state:{...state,gardenTime:'day'},changeKey:'same'})).toBe(true);
        expect(canReuseLifeScene({state,changeKey:'same'}, {state:{...state,worldStyle:'moon-garden-v1'},changeKey:'same'})).toBe(false);
    } finally {scene.dispose();}
});

it('preserves the original Pokomoko geometry, fabric panels, scarf and scale across garden styles',()=>{
    const state=garden();
    const original=buildLifeScene({...state,worldStyle:'moon-garden-v1'}), fantasy=buildLifeScene(state);
    const appearance=(scene:ReturnType<typeof buildLifeScene>)=>{
        const hero=scene.root.getObjectByName(`life-resident-${state.residents[0].id}`)!;
        const meshes:unknown[]=[];
        hero.traverse(object=>{
            if(!(object instanceof T.Mesh))return;
            meshes.push({geometry:object.geometry.type,positions:Array.from(object.geometry.getAttribute('position').array),
                position:object.position.toArray(),scale:object.scale.toArray(),panel:object.userData.fabricPanel,
                paints:(Array.isArray(object.material)?object.material:[object.material]).map(material=>({
                    type:material.type,color:(material as T.MeshStandardMaterial).color?.getHex(),
                }))});
        });
        return {scale:hero.scale.toArray(),meshes};
    };
    try {
        const expected=appearance(original);
        expect(expected.meshes.length).toBeGreaterThan(10);
        expect(appearance(fantasy)).toEqual(expected);
    } finally {original.dispose();fantasy.dispose();}
});

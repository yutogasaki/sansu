import type { Cell, GrowingState, Command } from '../../../src/domain/growingIsland/types';
export const MATURE_CANDIDATE = 'mature-composition-v1';
export type MatureLayout = 'A' | 'B';
export function matureTrialEnabled() {
    const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
    if (!q.has('matureTrial')) return false;
    if (q.get('matureTrial') !== 'paired' || q.get('trialScene') !== 'shore' || q.get('placeSetTrial') !== 'two' || q.has('trialSave'))
        throw Error('成熟した場所の比較はメモリ専用です。保存指定を外してください。');
    return true;
}
export const matureCells: Record<MatureLayout, Record<string, Cell>> = {
    A: { t1:{x:-2,z:2},t2:{x:-1,z:2},t3:{x:-2,z:3},t4:{x:-1,z:3},
        w1:{x:3,z:4},c1:{x:4,z:4},w2:{x:5,z:4},c2:{x:6,z:4},w3:{x:7,z:4},
        f1:{x:4,z:5},f2:{x:5,z:5},f3:{x:4,z:6},f4:{x:5,z:6},b1:{x:0,z:4},b2:{x:7,z:5}},
    B: { t1:{x:-2,z:2},t2:{x:-1,z:2},t3:{x:0,z:2},t4:{x:1,z:2},
        w1:{x:3,z:3},c1:{x:4,z:3},w2:{x:5,z:3},c2:{x:5,z:4},w3:{x:5,z:5},
        f1:{x:1,z:5},f2:{x:2,z:5},f3:{x:1,z:6},f4:{x:2,z:6},b1:{x:-1,z:4},b2:{x:6,z:5}},
};
/** Explicit mature diagnostic input, not earned growth or a user's save. */
export function matureCompositionFixture(state: GrowingState): GrowingState {
    if (!matureTrialEnabled()) return state;
    state.tutorial = 'done';
    state.terrain = { version: 1, heights: {}, undo: [], redo: [] };
    state.nature.hours = 1000;
    state.nature.realAt = Date.now();
    state.plots = [{ ...state.plots[0], cell:{x:0,z:1}, stage:2, style:'tree' },
        { ...state.plots[0], id:'mature-home', cell:{x:2,z:3}, stage:2, style:'plain', starter:undefined }];
    state.landmarks = Object.entries(matureCells.A).map(([id,cell]) => ({ id, cell, kind: id[0] === 't' ? 'sapling' : id[0] === 'w' ? 'water-bowl' : id[0] === 'c' ? 'water-channel' : id[0] === 'f' ? 'flower' : 'bench',
        growth: id[0] === 't' ? 18 : id[0] === 'f' ? 6 : 0, ...(id[0] === 't' ? {maturedAt:0} : {}) }));
    state.arrivals=[]; state.unopened=[];
    return state;
}

/** Move only changed owners. Break occupied cycles with one temporary storage;
 * all resulting operations still pass the ordinary domain guards. */
type RearrangementCommand = Extract<Command, {type:'move'|'store'|'unstore'}>;
export function matureRearrangement(state: GrowingState, layout: MatureLayout): RearrangementCommand[] {
    const targets=matureCells[layout], cells=new Map(state.landmarks.map(item=>[item.id,item.cell]));
    const pending=new Set(Object.keys(targets).filter(id=>JSON.stringify(cells.get(id))!==JSON.stringify(targets[id])));
    const commands:RearrangementCommand[]=[];
    const key=(cell:Cell|undefined)=>cell&&`${cell.x},${cell.z}`;
    while(pending.size){
        const occupied=new Set([...cells.values()].filter(Boolean).map(key));
        const ready=[...pending].find(id=>!occupied.has(key(targets[id])));
        if(ready){commands.push({type:cells.get(ready)?'move':'unstore',id:ready,cell:targets[ready]});cells.set(ready,targets[ready]);pending.delete(ready);}
        else {const id=[...pending].find(id=>cells.get(id));if(!id)throw Error('配置先が重複しています。');commands.push({type:'store',id});cells.set(id,undefined);}
    }
    return commands;
}

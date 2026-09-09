import { describe, it, expect } from 'vitest';
import { allowsDecimalEntry, appendNumberField } from './numberEntry';
describe('number entry capabilities', () => {
    it('keeps decimal keys for whole decimal exercise families, never the current answer', () => {
        for (const categoryId of ['dec_add','dec_sub','dec_mul_int','dec_div_int','dec_mul_dec','dec_div_dec','scale_10x']) expect(allowsDecimalEntry({subject:'math',inputType:'number',categoryId})).toBe(true);
        for (const categoryId of ['add_2d1d_nc','frac_add_same','sub_tiny']) expect(allowsDecimalEntry({subject:'math',inputType:'number',categoryId})).toBe(false);
        expect(allowsDecimalEntry({subject:'math',inputType:'multi-number',categoryId:'frac_add_same'})).toBe(false);
    });
    it('waits for ambiguous single digits then advances at the field maximum', () => {
        expect(appendNumberField(['',''],0,'1',[2,2])).toEqual({values:['1',''],active:0});
        expect(appendNumberField(['1',''],0,'2',[2,2])).toEqual({values:['12',''],active:1});
        expect(appendNumberField(['12','3'],1,'4',[2,2])).toEqual({values:['12','34'],active:1});
    });
    it('does not jump into a filled neighbour while correcting, or append dots/overflow', () => {
        expect(appendNumberField(['1','7'],0,'2',[2,2])).toEqual({values:['12','7'],active:0});
        expect(appendNumberField(['12','7'],0,'3',[2,2])).toEqual({values:['12','7'],active:0});
        expect(appendNumberField(['1',''],0,'.',[2,2])).toEqual({values:['1',''],active:0});
    });
});

import { MATH_GENERATORS } from './index';
it('keeps every generated decimal answer enterable across the catalog', () => {
    let seed = 9241;
    const random = () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed / 4294967296; };
    for (const [skill, generate] of Object.entries(MATH_GENERATORS)) for (let i=0;i<50;i++) {
        const problem=generate({random});
        if (problem.inputType==='number' && typeof problem.correctAnswer==='string' && problem.correctAnswer.includes('.')) expect(allowsDecimalEntry({...problem,subject:'math'}),skill).toBe(true);
    }
});

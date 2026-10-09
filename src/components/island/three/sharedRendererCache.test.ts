import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { wonder } from '../growing/wonderPaint';
import { retainSharedRendererCache } from './sharedRendererCache';

describe('shared renderer cache lifetime', () => {
    it('keeps the default program key shared with an unobserved material throughout registration', () => {
        const material = new T.MeshStandardMaterial(), peer = new T.MeshStandardMaterial();
        const originalHook = material.onBeforeCompile, originalKeyMethod = material.customProgramCacheKey;
        const expected = peer.customProgramCacheKey();
        const releaseFirst = retainSharedRendererCache(material), releaseSecond = retainSharedRendererCache(material);
        try {
            expect(material.onBeforeCompile).not.toBe(originalHook);
            expect(material.customProgramCacheKey).toBe(originalKeyMethod);
            expect(material.customProgramCacheKey()).toBe(expected);
            releaseFirst();
            expect(material.onBeforeCompile).not.toBe(originalHook);
            expect(material.customProgramCacheKey()).toBe(expected);
            releaseSecond();
            expect(material.onBeforeCompile).toBe(originalHook);
            expect(material.customProgramCacheKey).toBe(originalKeyMethod);
            expect(material.customProgramCacheKey()).toBe(expected);
        } finally { releaseFirst(); releaseSecond(); material.dispose(); peer.dispose(); }
    });

    it('preserves distinct original shader hooks and their program keys', () => {
        const first = new T.MeshStandardMaterial(), second = new T.MeshStandardMaterial();
        const firstHook: T.Material['onBeforeCompile'] = shader => { shader.fragmentShader += '\n// first shader'; };
        const secondHook: T.Material['onBeforeCompile'] = shader => { shader.fragmentShader += '\n// second shader'; };
        first.onBeforeCompile = firstHook; second.onBeforeCompile = secondHook;
        const firstKey = first.customProgramCacheKey(), secondKey = second.customProgramCacheKey();
        expect(firstKey).not.toBe(secondKey);
        const releaseFirst = retainSharedRendererCache(first), releaseSecond = retainSharedRendererCache(second);
        try {
            expect(first.customProgramCacheKey()).not.toBe(second.customProgramCacheKey());
            expect(first.customProgramCacheKey()).toBe(firstKey);
            expect(second.customProgramCacheKey()).toBe(secondKey);
            const shader = () => ({ uniforms: {}, fragmentShader: '' }) as Parameters<T.Material['onBeforeCompile']>[0];
            const firstShader = shader(), secondShader = shader();
            first.onBeforeCompile(firstShader, {} as T.WebGLRenderer);
            second.onBeforeCompile(secondShader, {} as T.WebGLRenderer);
            expect(firstShader.fragmentShader).toBe('\n// first shader');
            expect(secondShader.fragmentShader).toBe('\n// second shader');
            releaseFirst(); releaseSecond();
            expect(first.onBeforeCompile).toBe(firstHook);
            expect(second.onBeforeCompile).toBe(secondHook);
            expect(first.customProgramCacheKey()).toBe(firstKey);
            expect(second.customProgramCacheKey()).toBe(secondKey);
        } finally { releaseFirst(); releaseSecond(); first.dispose(); second.dispose(); }
    });

    it('keeps a custom program key method live and unchanged while observing and after release', () => {
        const material = new T.MeshStandardMaterial(), originalHook = material.onBeforeCompile;
        const customKey = function (this: T.Material) { return `${this.userData.variant}:${this.onBeforeCompile.toString()}`; };
        material.customProgramCacheKey = customKey; material.userData.variant = 'first';
        const firstKey = material.customProgramCacheKey();
        const release = retainSharedRendererCache(material);
        try {
            expect(material.customProgramCacheKey).toBe(customKey);
            expect(material.customProgramCacheKey()).toBe(firstKey);
            material.userData.variant = 'second';
            const secondKey = `second:${originalHook.toString()}`;
            expect(material.customProgramCacheKey()).not.toBe(firstKey);
            expect(material.customProgramCacheKey()).toBe(secondKey);
            release();
            expect(material.onBeforeCompile).toBe(originalHook);
            expect(material.customProgramCacheKey).toBe(customKey);
            expect(material.customProgramCacheKey()).toBe(secondKey);
        } finally { release(); material.dispose(); }
    });

    it('releases renderer listeners only after the last renderer and keeps cached art reusable', () => {
        const material = wonder('dots-red') as T.MeshStandardMaterial;
        const texture = material.map ?? new T.Texture();
        material.map = texture;
        const spriteGeometry = new T.Sprite().geometry;
        const lut = new T.Texture(); lut.name = 'DFG_LUT';
        const shaderMaterialA = new T.MeshStandardMaterial(), shaderMaterialB = new T.MeshStandardMaterial();
        const originalHook = vi.fn(); shaderMaterialA.onBeforeCompile = originalHook;
        const onMaterial = vi.fn(), onTexture = vi.fn(), onSprite = vi.fn(), onLut = vi.fn();
        material.addEventListener('dispose', onMaterial);
        texture.addEventListener('dispose', onTexture);
        spriteGeometry.addEventListener('dispose', onSprite);
        lut.addEventListener('dispose', onLut);
        const releaseFirst = retainSharedRendererCache(shaderMaterialA), releaseSecond = retainSharedRendererCache(shaderMaterialB);
        // Simulate Three.js compiling the same shared LUT into two independent materials.
        const uniformA = { value: lut }, uniformB = { value: lut };
        shaderMaterialA.onBeforeCompile({ uniforms: { dfgLUT: uniformA } } as Parameters<typeof shaderMaterialA.onBeforeCompile>[0], {} as T.WebGLRenderer);
        shaderMaterialB.onBeforeCompile({ uniforms: { dfgLUT: uniformB } } as Parameters<typeof shaderMaterialB.onBeforeCompile>[0], {} as T.WebGLRenderer);
        expect(originalHook).toHaveBeenCalledTimes(1);
        releaseFirst();
        expect([onMaterial, onTexture, onSprite, onLut].map(fn => fn.mock.calls.length)).toEqual([0, 0, 0, 0]);
        releaseSecond();
        expect([onMaterial, onTexture, onSprite, onLut].map(fn => fn.mock.calls.length)).toEqual([1, 1, 1, 1]);
        releaseSecond();
        expect(onLut).toHaveBeenCalledTimes(1);
        expect(wonder('dots-red')).toBe(material);
        expect((wonder('dots-red') as T.MeshStandardMaterial).map).toBe(texture);
        material.removeEventListener('dispose', onMaterial);
        texture.removeEventListener('dispose', onTexture);
        spriteGeometry.removeEventListener('dispose', onSprite);
        lut.removeEventListener('dispose', onLut);
        shaderMaterialA.dispose(); shaderMaterialB.dispose();
    });

    it('restores one original hook after concurrent registrations of the same material', () => {
        const material = new T.MeshStandardMaterial(), originalHook = vi.fn();
        material.onBeforeCompile = originalHook;
        const lut = new T.Texture(); lut.name = 'DFG_LUT';
        const onLut = vi.fn(); lut.addEventListener('dispose', onLut);
        const releaseFirst = retainSharedRendererCache(material), releaseSecond = retainSharedRendererCache(material);
        const registeredHook = material.onBeforeCompile;
        const firstUniform: { value: unknown } = { value: null }, secondUniform = { value: null };
        registeredHook({ uniforms: { dfgLUT: firstUniform } } as Parameters<typeof material.onBeforeCompile>[0], {} as T.WebGLRenderer);
        firstUniform.value = lut; // Three assigns the texture after compilation, during rendering.
        registeredHook({ uniforms: { dfgLUT: secondUniform } } as Parameters<typeof material.onBeforeCompile>[0], {} as T.WebGLRenderer);
        expect(originalHook).toHaveBeenCalledTimes(2);

        releaseFirst(); releaseFirst();
        expect(onLut).not.toHaveBeenCalled();
        expect(material.onBeforeCompile).toBe(registeredHook);
        releaseSecond();
        expect(onLut).toHaveBeenCalledTimes(1);
        expect(material.onBeforeCompile).toBe(originalHook);
        material.dispose();
    });

    it('captures a room-only draw while its uncompiled shell and rebuilt room share the renderer', () => {
        const shellMaterial = new T.MeshStandardMaterial(), roomMaterial = new T.MeshStandardMaterial();
        const nextRoomMaterial = new T.MeshStandardMaterial(), lut = new T.Texture(); lut.name = 'DFG_LUT';
        const onLut = vi.fn(); lut.addEventListener('dispose', onLut);
        const releaseShell = retainSharedRendererCache(shellMaterial), releaseRoom = retainSharedRendererCache(roomMaterial);
        roomMaterial.onBeforeCompile({ uniforms: { dfgLUT: { value: lut } } } as Parameters<typeof roomMaterial.onBeforeCompile>[0], {} as T.WebGLRenderer);
        const releaseNextRoom = retainSharedRendererCache(nextRoomMaterial);
        releaseRoom();
        expect(onLut).not.toHaveBeenCalled();
        releaseShell();
        expect(onLut).not.toHaveBeenCalled();
        releaseNextRoom(); releaseNextRoom();
        expect(onLut).toHaveBeenCalledTimes(1);
        shellMaterial.dispose(); roomMaterial.dispose(); nextRoomMaterial.dispose();
    });
});

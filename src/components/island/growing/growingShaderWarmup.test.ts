import { afterEach, describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { cloneGrowingPreviewMaterial, makeGrowingInteractionWarmBank, warmGrowingShaders } from './growingShaderWarmup';
import { guardNativeTransmission } from './native/nativeTransmission';

type Program = NonNullable<T.WebGLRenderer['info']['programs']>[number];
function program(name: string) {
    return { name, id: 1, program: { name }, getUniforms: vi.fn(() => ({})), getAttributes: vi.fn() } as unknown as Program;
}
function rendererMock(programs: Program[] = [program('base')], parallel = true) {
    let target: T.WebGLRenderTarget | null = null, cube = 3, mip = 2;
    const ready = new Map<unknown, boolean>(), linked = new Map<unknown, boolean>();
    const gl = {
        LINK_STATUS: 35714,
        getExtension: vi.fn((name: string) => name === 'KHR_parallel_shader_compile' && parallel ? { COMPLETION_STATUS_KHR: 37297 } : null),
        isProgram: vi.fn(() => true), isContextLost: vi.fn(() => false),
        getProgramParameter: vi.fn((handle: unknown, parameter: number) => parameter === 37297 ? ready.get(handle) !== false : linked.get(handle) !== false),
    };
    const renderer = {
        info: { programs }, debug: { checkShaderErrors: true, onShaderError: vi.fn() },
        shadowMap: { enabled: true, type: T.PCFShadowMap as T.ShadowMapType },
        toneMapping: T.ACESFilmicToneMapping, outputColorSpace: T.SRGBColorSpace,
        getContext: () => gl, getRenderTarget: () => target, getActiveCubeFace: () => cube, getActiveMipmapLevel: () => mip,
        setRenderTarget: vi.fn((next: T.WebGLRenderTarget | null, face = 0, level = 0) => { target = next; cube = face; mip = level; }),
        compile: vi.fn(), render: vi.fn(),
    };
    return { renderer: renderer as unknown as T.WebGLRenderer, raw: renderer, gl, ready, linked };
}
const inputs = () => ({ scene: new T.Scene(), camera: new T.OrthographicCamera(), interaction: new T.Group() });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('growing interaction shader preparation', () => {
    it('preserves authored transmission hooks and keys on an independent preview material', () => {
        const source = new T.MeshPhysicalMaterial({ transmission: .72 }); guardNativeTransmission(source);
        const preview = cloneGrowingPreviewMaterial(source); preview.transparent = true;
        expect(preview).not.toBe(source); expect(preview.onBeforeCompile).toBe(source.onBeforeCompile);
        expect(preview.customProgramCacheKey()).toBe('native05-finite-transmission-v1');
        const shader = { fragmentShader: '#include <transmission_fragment>' } as Parameters<T.Material['onBeforeCompile']>[0];
        preview.onBeforeCompile(shader, {} as T.WebGLRenderer); expect(shader.fragmentShader).toContain('isnan(totalDiffuse)');
        expect(source.transparent).toBe(false);
        const captured = source;
        source.customProgramCacheKey = function () { return `${captured.transmission}:${this.transparent}`; };
        const second = cloneGrowingPreviewMaterial(source); second.transparent = true;
        expect(second.customProgramCacheKey()).toBe('0.72:true');
        source.dispose(); preview.dispose(); second.dispose();
    });

    it('retains opaque and transparent programs without drawing or disposing borrowed geometry', () => {
        const owners = new T.Group(), geometry = new T.BoxGeometry(), source = new T.MeshStandardMaterial();
        const mesh = new T.Mesh(geometry, source); mesh.visible = false; owners.add(mesh);
        const geometryDispose = vi.spyOn(geometry, 'dispose'), sourceDispose = vi.spyOn(source, 'dispose');
        const bank = makeGrowingInteractionWarmBank(owners), variants = bank.root.children.filter(item => item instanceof T.Mesh && item.geometry === geometry) as T.Mesh[];
        expect(variants).toHaveLength(2); expect(bank.root.parent).toBe(null); expect(owners.children).toEqual([mesh]);
        expect(variants.map(item => (item.material as T.Material).transparent)).toEqual([false, true]);
        const disposals = variants.map(item => vi.spyOn(item.material as T.Material, 'dispose'));
        bank.releaseMeshes(); expect(bank.root.children).toHaveLength(0); disposals.forEach(dispose => expect(dispose).not.toHaveBeenCalled());
        bank.dispose(); bank.dispose(); disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
        expect(geometryDispose).not.toHaveBeenCalled(); expect(sourceDispose).not.toHaveBeenCalled();
        geometry.dispose(); source.dispose();
    });

    it('waits all side programs before first-use diagnostics and waits newly rendered programs', async () => {
        vi.useFakeTimers();
        const first = program('front'), second = program('back'), lazy = program('lazy-shadow');
        const mock = rendererMock([first, second]); mock.ready.set(second.program, false);
        const { scene, camera, interaction } = inputs();
        mock.raw.render.mockImplementationOnce(() => mock.raw.info.programs.push(lazy));
        const warming = warmGrowingShaders(mock.renderer, camera, scene, interaction);
        expect(first.getUniforms).not.toHaveBeenCalled(); expect(second.getUniforms).not.toHaveBeenCalled();
        mock.ready.set(second.program, true); await vi.advanceTimersByTimeAsync(10); await warming;
        expect(first.getUniforms).toHaveBeenCalled(); expect(second.getUniforms).toHaveBeenCalled(); expect(lazy.getUniforms).toHaveBeenCalled();
        expect(mock.raw.render).toHaveBeenCalledTimes(2); expect(mock.raw.debug.checkShaderErrors).toBe(true);
    });

    it('warms interaction keys against the shadow mode Three uses after its first render', async () => {
        const mock = rendererMock(), { scene, camera, interaction } = inputs();
        mock.raw.shadowMap.type = T.PCFSoftShadowMap;
        mock.raw.compile.mockImplementation(() => expect(mock.raw.shadowMap.type).toBe(T.PCFShadowMap));
        // Reproduce the installed renderer's first-render migration. The bank
        // must already have compiled with this same mode, before this is called.
        mock.raw.render.mockImplementation(() => { if (mock.raw.shadowMap.type === T.PCFSoftShadowMap) mock.raw.shadowMap.type = T.PCFShadowMap; });
        await warmGrowingShaders(mock.renderer, camera, scene, interaction);
        expect(mock.raw.compile).toHaveBeenCalledTimes(2); expect(mock.raw.shadowMap.type).toBe(T.PCFShadowMap);
    });

    it('warms exact linear/back-side transmission conditions and restores renderer state before yielding', async () => {
        vi.useFakeTimers();
        const mock = rendererMock(), previous = new T.WebGLRenderTarget(2, 2);
        mock.renderer.setRenderTarget(previous, 3, 2);
        mock.ready.set(mock.raw.info.programs[0].program, false);
        const { scene, camera, interaction } = inputs();
        const solid = new T.MeshBasicMaterial(), transparent = new T.MeshBasicMaterial({ transparent: true });
        const shell = new T.MeshPhysicalMaterial({ transmission: .7, side: T.DoubleSide });
        scene.add(new T.Mesh(new T.BoxGeometry(), solid), new T.Mesh(new T.BoxGeometry(), transparent), new T.Mesh(new T.BoxGeometry(), shell));
        const passes: { target: T.WebGLRenderTarget | null; types: { material: T.Material; side: T.Side }[] }[] = [];
        mock.raw.compile.mockImplementation(root => {
            expect(mock.raw.toneMapping).toBe(T.ACESFilmicToneMapping); expect(mock.raw.outputColorSpace).toBe(T.SRGBColorSpace);
            const types: { material: T.Material; side: T.Side }[] = [];
            root.traverse((object: T.Object3D) => { if (object instanceof T.Mesh) types.push({ material: object.material as T.Material, side: (object.material as T.Material).side }); });
            passes.push({ target: mock.renderer.getRenderTarget(), types });
        });
        const warming = warmGrowingShaders(mock.renderer, camera, scene, interaction);
        expect(mock.renderer.getRenderTarget()).toBe(previous); expect(mock.renderer.getActiveCubeFace()).toBe(3); expect(mock.renderer.getActiveMipmapLevel()).toBe(2);
        expect(shell.side).toBe(T.DoubleSide); expect(passes).toHaveLength(4);
        expect(passes[2].target).toBeInstanceOf(T.WebGLRenderTarget); expect(passes[2].types.map(item => item.material)).toEqual([solid]);
        expect(passes[3].types).toEqual([{ material: shell, side: T.BackSide }]);
        mock.ready.set(mock.raw.info.programs[0].program, true); await vi.advanceTimersByTimeAsync(10); await warming;
        previous.dispose(); scene.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose(); }); solid.dispose(); transparent.dispose(); shell.dispose();
    });

    it('restores material sides and target and disposes its target when compilation throws', async () => {
        const mock = rendererMock(), { scene, camera, interaction } = inputs();
        const material = new T.MeshStandardMaterial({ side: T.DoubleSide, transparent: true });
        scene.add(new T.Mesh(new T.BoxGeometry(), material));
        const dispose = vi.spyOn(T.WebGLRenderTarget.prototype, 'dispose');
        mock.raw.compile.mockImplementation(() => { material.side = T.BackSide; throw Error('authored hook failed'); });
        await expect(warmGrowingShaders(mock.renderer, camera, scene, interaction)).rejects.toThrow('authored hook failed');
        expect(material.side).toBe(T.DoubleSide); expect(mock.renderer.getRenderTarget()).toBe(null); expect(dispose).toHaveBeenCalledTimes(1);
        expect(mock.raw.render).not.toHaveBeenCalled(); material.dispose(); (scene.children[0] as T.Mesh).geometry.dispose();
    });

    it('keeps error reporting enabled and rejects a failed link without a parallel extension', async () => {
        const bad = program('failed-native-shell'), mock = rendererMock([bad], false), { scene, camera, interaction } = inputs();
        mock.linked.set(bad.program, false); const callback = mock.raw.debug.onShaderError;
        await expect(warmGrowingShaders(mock.renderer, camera, scene, interaction)).rejects.toThrow('failed-native-shell');
        expect(bad.getUniforms).toHaveBeenCalledTimes(1); expect(mock.raw.debug.checkShaderErrors).toBe(true); expect(mock.raw.debug.onShaderError).toBe(callback);
        expect(mock.raw.render).not.toHaveBeenCalled();
    });

    it('rejects a lost/destroyed program and aborts pending preparation while releasing its target', async () => {
        vi.useFakeTimers();
        const mock = rendererMock(), { scene, camera, interaction } = inputs(), controller = new AbortController();
        mock.ready.set(mock.raw.info.programs[0].program, false);
        const dispose = vi.spyOn(T.WebGLRenderTarget.prototype, 'dispose');
        const warming = warmGrowingShaders(mock.renderer, camera, scene, interaction, controller.signal);
        const rejected = expect(warming).rejects.toThrow('aborted'); controller.abort(); await vi.advanceTimersByTimeAsync(10); await rejected;
        expect(dispose).toHaveBeenCalledTimes(1); expect(mock.raw.render).not.toHaveBeenCalled();
        mock.gl.isProgram.mockReturnValue(false);
        await expect(warmGrowingShaders(mock.renderer, camera, scene, interaction)).rejects.toThrow('lifetime differs');
    });

    it('does not treat disabled diagnostics as a successful warmup', async () => {
        const mock = rendererMock(), { scene, camera, interaction } = inputs(); mock.raw.debug.checkShaderErrors = false;
        await expect(warmGrowingShaders(mock.renderer, camera, scene, interaction)).rejects.toThrow('requires shader error checks');
        expect(mock.raw.debug.checkShaderErrors).toBe(false); expect(mock.raw.render).not.toHaveBeenCalled();
    });

    it('propagates context loss while pending instead of declaring readiness', async () => {
        vi.useFakeTimers();
        const mock = rendererMock(), { scene, camera, interaction } = inputs();
        mock.ready.set(mock.raw.info.programs[0].program, false);
        mock.gl.isContextLost.mockReturnValueOnce(false).mockReturnValue(true);
        const warming = warmGrowingShaders(mock.renderer, camera, scene, interaction);
        const rejected = expect(warming).rejects.toThrow('context lost'); await vi.advanceTimersByTimeAsync(10); await rejected;
        expect(mock.raw.render).not.toHaveBeenCalled();
    });

    it('requires explicit review when the installed Three revision changes', async () => {
        expect(T.REVISION).toBe('185');
        vi.resetModules();
        vi.doMock('three', async () => ({ ...await vi.importActual<typeof T>('three'), REVISION: '186' }));
        try {
            const changed = await import('./growingShaderWarmup');
            const mock = rendererMock(), { scene, camera, interaction } = inputs();
            await expect(changed.warmGrowingShaders(mock.renderer, camera, scene, interaction)).rejects.toThrow('reviewed Three revision 185');
            expect(mock.raw.render).not.toHaveBeenCalled();
        } finally { vi.doUnmock('three'); vi.resetModules(); }
    });
});

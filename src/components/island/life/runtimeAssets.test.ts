import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as T from 'three';
const fake = vi.hoisted(() => ({ load: vi.fn(), dispose: vi.fn() }));
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class { setKTX2Loader() { return this; } loadAsync(url: string) { return fake.load(url); } } }));
vi.mock('three/addons/loaders/KTX2Loader.js', () => ({ KTX2Loader: class { setTranscoderPath() { return this; } detectSupport() { return this; } dispose() { fake.dispose(); } } }));
import { LifeRuntimeAssets } from './runtimeAssets';
function model() { const scene = new T.Group(); scene.add(new T.Mesh(new T.BoxGeometry().translate(0, .5, 0), new T.MeshStandardMaterial())); return { scene }; }
function scene() { const root = new T.Group(), target = new T.Group(); target.userData.runtimeAssetKind = 'bench'; target.add(model().scene); root.add(target); return {root, target}; }
const settle = async () => { await vi.waitFor(() => expect(fake.load).toHaveBeenCalledTimes(2)); await new Promise(r => setTimeout(r, 0)); };
beforeEach(() => { fake.load.mockReset().mockImplementation(async () => model()); fake.dispose.mockReset(); });
describe('Life runtime asset ownership', () => {
    it('keeps every mailbox material shared with the matching far primitive', async () => {
        const loaded: T.Group[] = [];
        fake.load.mockImplementation(async () => {
            const group = new T.Group();
            for (const [name, color] of [['roof', '#aa3322'], ['door', '#eeddaa']]) {
                const m = new T.MeshStandardMaterial({ color }); m.name = name;
                group.add(new T.Mesh(new T.BoxGeometry(), m));
            }
            loaded.push(group); return { scene: group };
        });
        const a = scene(); a.target.userData.runtimeAssetKind = 'mailbox';
        const pool = new LifeRuntimeAssets({} as T.WebGLRenderer, () => {});
        pool.bind(a.root); await settle();
        for (let i = 0; i < 2; i++) expect((loaded[1].children[i] as T.Mesh).material).toBe((loaded[0].children[i] as T.Mesh).material);
        expect((loaded[1].children[0] as T.Mesh).material).not.toBe((loaded[1].children[1] as T.Mesh).material);
        pool.dispose();
    });
    it('fits the hut and connecting forecourt inside the saved footprint and releases the owned porch', async () => {
        const a = scene(); a.target.userData.runtimeAssetKind = 'garden-hut';
        const pool = new LifeRuntimeAssets({} as T.WebGLRenderer, () => {});
        pool.bind(a.root); await settle();
        const visual = a.target.children[1], porch = visual.getObjectByName('runtime-hut-forecourt') as T.Mesh;
        const footprint = new T.Box3().setFromObject(visual);
        expect(footprint.min.x).toBeGreaterThanOrEqual(-.5);
        expect(footprint.max.x).toBeLessThanOrEqual(1.5);
        expect(footprint.min.z).toBeGreaterThanOrEqual(-.5);
        expect(footprint.max.z).toBeLessThanOrEqual(1.50001);
        expect(footprint.min.y).toBeCloseTo(0);
        const landing = new T.Box3().setFromObject(porch);
        expect(landing.containsPoint(new T.Vector3(0, .06, 1.43))).toBe(true);
        expect(landing.containsPoint(new T.Vector3(.5, .06, 1.05))).toBe(true);
        const geometryDisposed = vi.spyOn(porch.geometry, 'dispose');
        const materialDisposed = vi.spyOn(porch.material as T.Material, 'dispose');
        pool.dispose();
        expect(geometryDisposed).toHaveBeenCalledOnce(); expect(materialDisposed).toHaveBeenCalledOnce();
        expect(a.target.children).toHaveLength(1); expect(a.target.children[0].visible).toBe(true);
    });
    it('shares the asset across rebuilds and restores fallbacks before scene disposal', async () => {
        const pool = new LifeRuntimeAssets({} as T.WebGLRenderer, () => {}), a = scene();
        pool.bind(a.root); await settle(); expect(pool.describe().instances).toBe(1);
        expect(a.target.children[0].visible).toBe(false);
        pool.detach(); expect(a.target.children.length).toBe(1); expect(a.target.children[0].visible).toBe(true);
        pool.bind(scene().root); expect(fake.load).toHaveBeenCalledTimes(2);
        pool.dispose(); expect(fake.dispose).toHaveBeenCalledOnce();
    });
    it('keeps the visible seat at the resident anchor and switches both ways at a small screen size', async () => {
        const a=scene(); a.target.userData.runtimeAssetSeatY=.34;
        const pool=new LifeRuntimeAssets({} as T.WebGLRenderer,()=>{});pool.bind(a.root);await settle();
        const visual=a.target.children[1], near=visual.children[0];
        a.root.updateMatrixWorld(true);
        expect(near.localToWorld(new T.Vector3(0,.43,0)).y).toBeCloseTo(.34);
        const camera=new T.OrthographicCamera(-50,50,50,-50);
        pool.update(camera,800);expect(pool.describe().far).toBe(1);
        camera.zoom=10;pool.update(camera,800);expect(pool.describe().far).toBe(0);
        pool.dispose();
    });
    it('retains the fallback on failure without retrying on every rebuild', async () => {
        fake.load.mockRejectedValue(new Error('network')); const a=scene(), pool=new LifeRuntimeAssets({} as T.WebGLRenderer,()=>{});
        pool.bind(a.root); await settle(); expect(pool.describe().failed).toEqual(['bench']);
        expect(a.target.children[0].visible).toBe(true); pool.bind(a.root); expect(fake.load).toHaveBeenCalledTimes(2); pool.dispose();
    });
    it('releases a late load after unmount instead of attaching to a retired world', async () => {
        const callbacks: ((v: ReturnType<typeof model>)=>void)[]=[];
        fake.load.mockImplementation(()=>new Promise(resolve=>callbacks.push(resolve)));
        const a=scene(),pool=new LifeRuntimeAssets({} as T.WebGLRenderer,()=>{});pool.bind(a.root);pool.dispose();
        const loaded=[model(),model()], disposed=loaded.map(m=>vi.spyOn((m.scene.children[0] as T.Mesh).geometry,'dispose'));
        callbacks.forEach((done,i)=>done(loaded[i]));await settle();
        expect(a.target.children.length).toBe(1);disposed.forEach(spy=>expect(spy).toHaveBeenCalledOnce());expect(fake.dispose).toHaveBeenCalledOnce();
    });
});

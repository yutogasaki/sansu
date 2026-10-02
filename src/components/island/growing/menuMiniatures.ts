import * as T from 'three';
import type { Villager } from '../../../domain/growingIsland/types';
import type { IslandMaterials } from '../three/primitives';
import { makeVillagerActor } from './actors';
import { buildPlot } from './plotGeometry';

export interface MenuPictures { friends?: string; seeds?: string }

export function visibleBounds(pixels: Uint8ClampedArray, width: number, height: number) {
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (pixels[(y * width + x) * 4 + 3] > 8) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return right < left ? undefined : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Catalogue miniatures use the world's actual models, never invented residents or grown seeds. */
export function menuMiniature(m: IslandMaterials, villagers?: readonly Villager[]) {
    const root = new T.Group();
    const base = new T.Mesh(new T.CylinderGeometry(.65, .7, .12, 36), m.surface(villagers ? '#b7ce9f' : '#d6bd91', .9));
    base.position.y = -.06; base.receiveShadow = true; root.add(base);
    if (villagers) villagers.slice(0, 3).forEach((villager, index, people) => {
        const actor = makeVillagerActor(m, villager);
        actor.root.position.x = (index - (people.length - 1) / 2) * .44;
        actor.root.position.z = index % 2 ? -.08 : .06;
        actor.root.rotation.y = index % 2 ? -.15 : .2;
        root.add(actor.root);
    });
    else root.add(buildPlot(m, 'home', 0, 'plain', 0));
    return root;
}

function disposeModel(root: T.Object3D) {
    root.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose(); });
}

/** Two cached PNGs on the same GPU; no canvas resizing, camera movement, or extra WebGL context. */
export function menuPictureMaker(renderer: T.WebGLRenderer, m: IslandMaterials) {
    let lastKey: string | undefined, pictures: MenuPictures = {};
    const picture = (root: T.Group) => {
        const width = 288, height = 176;
        const scene = new T.Scene(); scene.add(root, new T.HemisphereLight('#ffffff', '#bbab8e', 2.4));
        const light = new T.DirectionalLight('#fff8e9', 2); light.position.set(-2, 4, 4); scene.add(light);
        const lens = new T.OrthographicCamera(-1.35, 1.35, .95, -.70, .1, 20);
        lens.position.set(1.4, 2.2, 4); lens.lookAt(0, .36, 0);
        const target = new T.WebGLRenderTarget(width, height); target.texture.colorSpace = T.SRGBColorSpace;
        const previous = renderer.getRenderTarget(), color = renderer.getClearColor(new T.Color()), alpha = renderer.getClearAlpha();
        try {
            renderer.setRenderTarget(target); renderer.setClearColor(0, 0); renderer.render(scene, lens);
            const pixels = new Uint8Array(width * height * 4); renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
            const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
            const context = canvas.getContext('2d'); if (!context) return undefined;
            const image = context.createImageData(width, height);
            for (let y = 0; y < height; y++) image.data.set(pixels.subarray((height - y - 1) * width * 4, (height - y) * width * 4), y * width * 4);
            const bounds = visibleBounds(image.data, width, height); if (!bounds) return undefined;
            canvas.width = bounds.width + 8; canvas.height = bounds.height + 8;
            context.putImageData(image, 4 - bounds.left, 4 - bounds.top); return canvas.toDataURL('image/png');
        } catch { return undefined; }
        finally { renderer.setRenderTarget(previous); renderer.setClearColor(color, alpha); target.dispose(); disposeModel(root); }
    };
    return (villagers: readonly Villager[]): MenuPictures => {
        const people = villagers.slice(0, 3);
        const key = JSON.stringify(people.map(({ id, species, variant, outfit }) => ({ id, species, variant, outfit })));
        if (key === lastKey) return pictures;
        pictures = { seeds: pictures.seeds ?? picture(menuMiniature(m)), friends: people.length ? picture(menuMiniature(m, people)) : undefined };
        lastKey = pictures.seeds && (!people.length || pictures.friends) ? key : undefined; return pictures;
    };
}

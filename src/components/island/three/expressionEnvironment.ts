import * as THREE from 'three';
import { ISLAND_DAY_PERIODS, ISLAND_SEASONS, type IslandDayPeriod, type IslandExpressionSelection, type IslandSeason } from '../../../domain/island/expression';

export interface IslandExpressionEnvironmentTargets {
    /** The resolved theme background, before this effect is applied. */
    background: THREE.Color;
    ground: readonly THREE.Object3D[];
    vegetation: readonly THREE.Object3D[];
}
type Environment = Readonly<IslandExpressionSelection['environment']>;
type SurfaceKind = 'ground' | 'vegetation';
type PaintedMaterial = THREE.Material & { color: THREE.Color; emissive?: THREE.Color };
type MaterialAssignment = THREE.Material | THREE.Material[];
interface Surface { mesh: THREE.Mesh; material: MaterialAssignment; kind: SurfaceKind }
interface Binding extends Surface { applied: MaterialAssignment }

const PERIODS = {
    morning: { sky: '#edb5c3', skyMix: .22, sun: '#ffe1aa', sunPower: .9, hemisphere: '#f4e4f2', ground: '#b9aa89', fillPower: 1, position: [-6, 7, 5] },
    day: { sky: '#70cbed', skyMix: .20, sun: '#fff6e6', sunPower: 1.06, hemisphere: '#f1faff', ground: '#b7b184', fillPower: 1.05, position: [-3, 10, 7] },
    evening: { sky: '#c97baf', skyMix: .32, sun: '#ffc58b', sunPower: .76, hemisphere: '#cfdbff', ground: '#9d819a', fillPower: .94, position: [-6, 5, 4] },
} as const;
const SEASONS = {
    spring: { color: '#b9dd88', ground: .08, vegetation: .18 },
    summer: { color: '#39896c', ground: .09, vegetation: .20 },
    autumn: { color: '#e2a458', ground: .12, vegetation: .28 },
    winter: { color: '#cfdef0', ground: .15, vegetation: .24 },
} as const;

function paintable(material: THREE.Material): material is PaintedMaterial {
    const painted = material as PaintedMaterial;
    // Tree life owns the pulsing emissive material. Keep that exact live reference.
    return painted.color instanceof THREE.Color && (!painted.emissive || (painted.emissive.r === 0 && painted.emissive.g === 0 && painted.emissive.b === 0));
}
function inTreeStructure(object: THREE.Object3D) {
    for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (parent.name === 'tree-structure') return true;
    return false;
}
const materials = (value: MaterialAssignment) => Array.isArray(value) ? value : [value];

/** A reversible finish on the existing world: no new geometry, lights, textures,
 * colliders or clocks. The source theme remains the owner of every borrowed resource.
 * Before world regeneration/disposal, restore placement occlusion, then this effect. */
export class IslandExpressionEnvironment {
    private readonly bindings = new Map<THREE.Mesh, Binding>();
    private readonly clones = new Map<string, PaintedMaterial>();
    private readonly base;
    private readonly sky = new THREE.Color();
    private background: THREE.Color | THREE.Texture | null;
    private period: IslandDayPeriod | null = null;
    private season: IslandSeason | null = null;
    private surfaceKey = '';
    private disposed = false;

    constructor(private readonly scene: THREE.Scene, private readonly sun: THREE.DirectionalLight, private readonly hemisphere: THREE.HemisphereLight) {
        this.background = scene.background;
        this.base = { sun: sun.color.clone(), sunIntensity: sun.intensity, sunPosition: sun.position.clone(),
            hemisphere: hemisphere.color.clone(), ground: hemisphere.groundColor.clone(), hemisphereIntensity: hemisphere.intensity };
    }

    private surfaces(targets: IslandExpressionEnvironmentTargets) {
        const found = new Map<THREE.Mesh, Surface>();
        for (const kind of ['ground', 'vegetation'] as const) for (const root of targets[kind]) root.traverse(object => {
            if (!(object instanceof THREE.Mesh) || found.has(object) || (kind === 'vegetation' && inTreeStructure(object))) return;
            const prior = this.bindings.get(object);
            const material = prior && object.material === prior.applied ? prior.material : object.material;
            if (materials(material).some(paintable)) found.set(object, { mesh: object, material, kind });
        });
        return [...found.values()];
    }

    private restoreMaterials() {
        for (const binding of this.bindings.values()) {
            // Do not overwrite a new world owner's replacement if it already rebuilt a mesh.
            if (binding.mesh.material === binding.applied) binding.mesh.material = binding.material;
        }
        this.bindings.clear();
        this.clones.forEach(material => material.dispose()); this.clones.clear(); this.surfaceKey = '';
    }

    private restoreLight() {
        this.scene.background = this.background;
        this.sun.color.copy(this.base.sun); this.sun.intensity = this.base.sunIntensity; this.sun.position.copy(this.base.sunPosition);
        this.hemisphere.color.copy(this.base.hemisphere); this.hemisphere.groundColor.copy(this.base.ground); this.hemisphere.intensity = this.base.hemisphereIntensity;
    }

    update(environment: Environment | undefined, targets: IslandExpressionEnvironmentTargets): boolean {
        if (this.disposed) return false;
        const period = environment?.period ?? null, season = environment?.season ?? null;
        if ((period !== null && !ISLAND_DAY_PERIODS.includes(period)) || (season !== null && !ISLAND_SEASONS.includes(season))) {
            throw new RangeError('Unknown island environment');
        }
        const surfaces = season === null ? [] : this.surfaces(targets);
        const key = surfaces.map(surface => `${surface.kind}:${surface.mesh.uuid}:${materials(surface.material).map(material => material.uuid).join(',')}`).join(';');
        const backgroundChanged = !(this.background instanceof THREE.Color) || !this.background.equals(targets.background);
        const changed = period !== this.period || season !== this.season || key !== this.surfaceKey || backgroundChanged;
        this.background = targets.background;
        if (season !== this.season || key !== this.surfaceKey) {
            this.restoreMaterials();
            if (season !== null) {
                const finish = SEASONS[season], tint = new THREE.Color(finish.color);
                for (const surface of surfaces) {
                    const decorate = (source: THREE.Material) => {
                        if (!paintable(source)) return source;
                        const id = `${surface.kind}:${source.uuid}`;
                        let clone = this.clones.get(id);
                        if (!clone) {
                            clone = source.clone() as PaintedMaterial;
                            clone.name = `expression-${season}-${source.name || source.uuid}`;
                            clone.color.lerp(tint, finish[surface.kind]);
                            // Preserve patterned/custom surfaces; their textures stay borrowed.
                            clone.onBeforeCompile = source.onBeforeCompile;
                            clone.customProgramCacheKey = source.customProgramCacheKey;
                            clone.userData.islandOwned = false;
                            this.clones.set(id, clone);
                        }
                        return clone;
                    };
                    const applied = Array.isArray(surface.material) ? surface.material.map(decorate) : decorate(surface.material);
                    surface.mesh.material = applied; this.bindings.set(surface.mesh, { ...surface, applied });
                }
            }
            this.surfaceKey = key;
        }
        this.restoreLight();
        if (period !== null) {
            const light = PERIODS[period];
            this.sky.copy(targets.background).lerp(new THREE.Color(light.sky), light.skyMix); this.scene.background = this.sky;
            this.sun.color.set(light.sun); this.sun.intensity = this.base.sunIntensity * light.sunPower;
            this.sun.position.set(light.position[0], light.position[1], light.position[2]);
            this.hemisphere.color.set(light.hemisphere); this.hemisphere.groundColor.set(light.ground); this.hemisphere.intensity = this.base.hemisphereIntensity * light.fillPower;
        }
        this.period = period; this.season = season;
        return changed;
    }

    restore() {
        this.restoreMaterials(); this.restoreLight(); this.period = null; this.season = null;
    }

    /** Values are read from the actual applied scene, not a second preview model. */
    describe() {
        return { period: this.period, season: this.season, disposed: this.disposed,
            background: this.scene.background instanceof THREE.Color ? this.scene.background.getHexString() : null,
            sun: { color: this.sun.color.getHexString(), intensity: this.sun.intensity, position: this.sun.position.toArray() },
            hemisphere: { color: this.hemisphere.color.getHexString(), ground: this.hemisphere.groundColor.getHexString(), intensity: this.hemisphere.intensity },
            surfaceCount: this.bindings.size, materialCount: this.clones.size,
            surfaces: [...this.bindings.values()].map(binding => ({ id: binding.mesh.uuid, kind: binding.kind,
                colors: materials(binding.mesh.material).map(material => paintable(material) ? material.color.getHexString() : null) })) };
    }

    dispose() { if (!this.disposed) { this.restore(); this.disposed = true; } }
}

import * as THREE from 'three';
import type { IslandCosmetics } from '../../../domain/island/customization';
import { ISLAND_APPEARANCE_SLOT_IDS, resolveIslandAppearance, sameIslandAppearance,
    type IslandAppearanceSlotId, type IslandResolvedAppearance } from '../../../domain/island/appearance';
import { IslandMaterials, disposeGeometry } from './primitives';
import { getTreeLightAnchor, makeExpansion, makeLighthouse, makeOcean, makeScenery, makeStarTree, replaceTreeAppearance } from './scenery';
import { addAccentMotifs, addThemeEnvironment } from './themeMotifs';
import { applySceneryGrowth } from './growthVisuals';
import type { IslandStageItem, IslandStageState } from './types';
import { getIslandExpansionLevel } from '../../../domain/island/expansion';
import { IslandPartMaterials } from './appearanceParts';
import { addAppearanceBridge, addAppearanceSky, addAppearanceWater } from './appearanceMotifs';
import { describeAppearanceSlot } from './appearanceDiagnostics';

export const ISLAND_CUSTOMIZATION_CANDIDATE = 'island-cosmetics-parts-v2';
export const ISLAND_LEGACY_APPEARANCE_CANDIDATE = 'island-cosmetics-v1';
export const DEFAULT_ISLAND_COSMETICS: IslandCosmetics = { themeId: 'moon-garden', accentId: null };

export function sameIslandCosmetics(a: IslandCosmetics = DEFAULT_ISLAND_COSMETICS, b: IslandCosmetics = DEFAULT_ISLAND_COSMETICS) {
    return a.accentId === b.accentId && sameIslandAppearance(resolveIslandAppearance(a), resolveIslandAppearance(b));
}

interface SlotLayer { materials: IslandPartMaterials; groups: THREE.Group[]; growth: THREE.Group }
const hasMeshes = (group: THREE.Group) => { let found = false; group.traverse(child => { found ||= child instanceof THREE.Mesh; }); return found; };

/** Each equipped surface owns its GPU resources. The world's physical containers,
 * rooted trees, furniture and actors outlive any individual style change. */
export class IslandCosmeticScenery {
    readonly group = new THREE.Group();
    readonly scenery = new THREE.Group();
    readonly tree: THREE.Group;
    readonly expansion = new THREE.Group();
    readonly westExpansion = new THREE.Group();
    readonly lighthouse = new THREE.Group();
    readonly growth = new THREE.Group();
    readonly environment = new THREE.Group();
    readonly sky = new THREE.Group();
    readonly accents = new THREE.Group();
    readonly westTree: THREE.Group;
    private readonly fixedMaterials = new IslandMaterials('moon-garden');
    private readonly layers = new Map<IslandAppearanceSlotId, SlotLayer>();
    private lastState?: IslandStageState;
    private disposed = false;
    private diagnostic?: ReturnType<IslandCosmeticScenery['makeDiagnostic']>;
    private furnitureKey = '';
    private furniture = new Map<IslandAppearanceSlotId, THREE.Group[]>();
    cosmetics: IslandCosmetics;
    appearance: IslandResolvedAppearance;

    constructor(cosmetics: IslandCosmetics = DEFAULT_ISLAND_COSMETICS) {
        this.cosmetics = { ...cosmetics, ...(cosmetics.appearance ? { appearance: resolveIslandAppearance(cosmetics) } : {}) };
        this.appearance = resolveIslandAppearance(cosmetics);
        this.group.name = 'island-appearance';
        this.scenery.name = 'island-scenery'; this.westExpansion.name = 'western-grove';
        this.sky.name = 'appearance-sky'; this.environment.name = 'theme-environment';
        for (const slot of ISLAND_APPEARANCE_SLOT_IDS) this.layers.set(slot, this.buildLayer(slot));
        const treeMaterials = this.layers.get('tree')!.materials;
        this.tree = makeStarTree(treeMaterials); this.westTree = makeStarTree(treeMaterials);
        this.westTree.name = 'western-grove-tree'; this.westTree.position.set(-6.7, 0, -1.2); this.westTree.scale.setScalar(.65);
        this.westExpansion.add(this.westTree);
        addAccentMotifs(this.accents, this.fixedMaterials, cosmetics.accentId);
        this.group.add(this.scenery, this.tree, this.expansion, this.westExpansion, this.lighthouse,
            this.growth, this.environment, this.sky, this.accents);
        this.expansion.visible = this.westExpansion.visible = this.lighthouse.visible = false;
    }

    get materials() { return this.layers.get('sky')!.materials; }
    get background() { return new THREE.Color(this.materials.color('#76cdd3')); }
    partMaterials(slot: IslandAppearanceSlotId) { return this.layers.get(slot)!.materials; }
    /** Test/diagnostic access reflects actual objects, not just the equipped IDs. */
    partObjects(slot: IslandAppearanceSlotId) {
        return [...this.layers.get(slot)!.groups, ...(slot === 'tree' ? [this.tree, this.westTree] : []), ...(this.furniture.get(slot) ?? [])];
    }
    /** Borrow actual placed groups for diagnostics only; their lifetime remains
     * with the runtime item map. In particular the fountain's solid base is excluded. */
    setFurnitureObjects(values: Iterable<{ group: THREE.Group; item: IslandStageItem }>) {
        const items = [...values];
        const key = JSON.stringify(items.map(({ group, item }) => [group.uuid, item, group.userData.growthVisualKey,
            group.children.map(child => child.uuid)]));
        if (key === this.furnitureKey) return;
        this.furnitureKey = key; this.furniture = new Map(); this.diagnostic = undefined;
        for (const { group, item } of items) {
            const slot = item.kind === 'flower' ? 'flower' : item.kind === 'mushroom' ? 'mushroom' : item.kind === 'fountain' ? 'water' : undefined;
            if (!slot) continue;
            const targets = item.kind === 'fountain' ? group.children.filter(child => ['fountain-surface', 'fountain-water', 'fountain-ripple', 'growth-details'].includes(child.name)) as THREE.Group[] : [group];
            this.furniture.set(slot, [...(this.furniture.get(slot) ?? []), ...targets]);
        }
    }
    describeAppearance() { return this.diagnostic ??= this.makeDiagnostic(); }
    private makeDiagnostic() {
        const tree = (group: THREE.Group) => ({ rootUuid: group.uuid, crownUuid: group.getObjectByName('tree-canopy')!.uuid,
            lightAnchor: getTreeLightAnchor(group).toArray() });
        const versions = [...new Set(ISLAND_APPEARANCE_SLOT_IDS.map(slot => this.layers.get(slot)!.materials.style.version))];
        return { rendererCandidate: ISLAND_CUSTOMIZATION_CANDIDATE, legacyCompatibilityCandidate: ISLAND_LEGACY_APPEARANCE_CANDIDATE,
            appearanceKind: versions.length === 1 ? versions[0] : 'mixed',
            slots: ISLAND_APPEARANCE_SLOT_IDS.map(slot => describeAppearanceSlot(slot, this.appearance.slots[slot],
            this.partObjects(slot), slot === 'sky' ? this.background : undefined)), tree: tree(this.tree), westTree: tree(this.westTree) };
    }

    private buildLayer(slot: IslandAppearanceSlotId): SlotLayer {
        const materials = new IslandPartMaterials(this.appearance.slots[slot]);
        const groups: THREE.Group[] = [], growth = new THREE.Group();
        const attach = (parent: THREE.Group, child: THREE.Group) => {
            child.userData.appearanceSlot = slot; child.userData.appearanceStyle = materials.styleId;
            groups.push(child); if (hasMeshes(child)) parent.add(child);
        };
        if (!['sky', 'mushroom'].includes(slot)) attach(this.scenery, makeScenery(materials, slot));
        if (['ground', 'shore', 'water', 'bridge', 'tree', 'flower'].includes(slot)) {
        const east = makeExpansion(materials, slot);
        if (slot === 'bridge') addAppearanceBridge(east, materials);
        attach(this.expansion, east);
        const west = makeExpansion(materials, slot, 'west'); west.rotation.y = Math.PI;
        if (slot === 'bridge') addAppearanceBridge(west, materials);
        attach(this.westExpansion, west);
        }
        if (['houseBody', 'houseRoof', 'houseWindows'].includes(slot)) attach(this.lighthouse, makeLighthouse(materials, slot));
        if (slot === 'sky') { const sky = new THREE.Group(); addAppearanceSky(sky, materials); attach(this.sky, sky); }
        if (slot === 'water') {
            const ocean = makeOcean(materials); addAppearanceWater(ocean, materials); attach(this.group, ocean);
        }
        if (slot === 'water' && ['starry', 'candy'].includes(materials.style.family)
            || slot === 'shore' && materials.style.family === 'crystal') {
            const environment = new THREE.Group(); addThemeEnvironment(environment, materials); attach(this.environment, environment);
        }
        groups.push(growth); growth.userData.appearanceSlot = slot; this.growth.add(growth);
        return { materials, groups, growth };
    }

    updateAppearance(cosmetics: IslandCosmetics = DEFAULT_ISLAND_COSMETICS) {
        if (this.disposed) return false;
        const next = resolveIslandAppearance(cosmetics), previous = this.appearance;
        this.appearance = next;
        let changed = false;
        for (const slot of ISLAND_APPEARANCE_SLOT_IDS) {
            if (next.slots[slot] === previous.slots[slot]) continue;
            const old = this.layers.get(slot)!;
            // Dispose a combined root once: growth clones can share geometry.
            const retired = new THREE.Group(); old.groups.forEach(group => retired.add(group)); disposeGeometry(retired);
            const layer = this.buildLayer(slot); this.layers.set(slot, layer);
            if (slot === 'tree') { replaceTreeAppearance(this.tree, layer.materials); replaceTreeAppearance(this.westTree, layer.materials); }
            old.materials.dispose(); changed = true; this.diagnostic = undefined;
        }
        if (cosmetics.accentId !== this.cosmetics.accentId) {
            disposeGeometry(this.accents); this.accents.clear();
            addAccentMotifs(this.accents, this.fixedMaterials, cosmetics.accentId); changed = true;
        }
        this.cosmetics = { ...cosmetics, ...(cosmetics.appearance ? { appearance: next } : {}) };
        if (changed && this.lastState) this.updateGrowth(this.lastState);
        return changed;
    }

    updateGrowth(state: IslandStageState) {
        this.lastState = state;
        const level = getIslandExpansionLevel(state);
        const previousVisibility = `${this.expansion.visible}:${this.westExpansion.visible}:${this.lighthouse.visible}`;
        this.expansion.visible = level >= 1; this.westExpansion.visible = level >= 2;
        this.lighthouse.visible = level >= 1 && state.completedSets >= 6;
        let changed = false;
        for (const slot of ['tree', 'houseBody', 'houseRoof', 'houseWindows', 'flower'] as const) {
            const layer = this.layers.get(slot)!;
            changed = applySceneryGrowth(layer.growth, state, layer.materials,
                slot === 'tree' ? { main: this.tree, west: this.westTree } : undefined, slot) || changed;
        }
        if (changed || previousVisibility !== `${this.expansion.visible}:${this.westExpansion.visible}:${this.lighthouse.visible}`) this.diagnostic = undefined;
        return changed;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.group.removeFromParent(); disposeGeometry(this.group);
        for (const layer of this.layers.values()) {
            // Empty filtered groups are detached and own no geometry.
            layer.materials.dispose();
        }
        this.fixedMaterials.dispose();
    }
}

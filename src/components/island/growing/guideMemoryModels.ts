import * as T from 'three';
import type { GuidanceEvidence, ItemKind } from '../../../domain/growingIsland/types';
import { keepsakeKind } from '../../../domain/growingIsland/gifts';
import { landBounds } from '../../../domain/growingIsland/space';
import { buildLifeItem } from '../life/itemGeometry';
import type { IslandMaterials } from '../three/primitives';
import { makeVillagerActor } from './actors';
import { buildPlot, buildLighthouse } from './plotGeometry';
import { buildBandstand, buildFlag, buildKeepsake } from './keepsakeGeometry';
import { buildBakery, buildFountain, buildPostbox, buildSlide, buildTrampoline } from './ownLandmarks';
import { buildColorFlower } from './flowerGeometry';

/** Read only the recorded object. Never substitute the current island or an invented resident. */
export function guideMemoryModel(m: IslandMaterials, evidence: GuidanceEvidence): T.Group | undefined {
    const { target, land, flagColor } = evidence.snapshot;
    let model: T.Group;
    if (target && 'species' in target) model = makeVillagerActor(m, target).root;
    else if (target && 'stage' in target) model = buildPlot(m, target.kind, target.stage, target.style ?? 'plain', target.growth, target.roof);
    else if (target && 'unitId' in target) model = buildKeepsake(m, keepsakeKind(target.unitId));
    else if (target && 'kind' in target) {
        const own = { lighthouse: buildLighthouse, bandstand: buildBandstand, slide: buildSlide, trampoline: buildTrampoline,
            fountain: buildFountain, bakery: buildBakery, postbox: buildPostbox };
        if (target.kind in own) model = own[target.kind as keyof typeof own](m);
        else if (target.kind === 'flower' && target.color) model = buildColorFlower(m, target.color, target.growth);
        else model = buildLifeItem({ id: target.id, kind: target.kind as ItemKind, growth: target.growth,
            style: target.legacy?.style ?? 'original', rotation: target.rotation,
            foodStage: target.legacy?.foodStage, foodStock: target.legacy?.foodStock }, m).root;
        model.rotation.y = (target.rotation ?? 0) * Math.PI / 2;
    } else if (land) {
        // The record knows the land extent, not every former tree or building.
        const bounds = landBounds({ land }), width = bounds.maxX - bounds.minX + 1, depth = bounds.depth;
        model = new T.Group();
        const sand = new T.Mesh(new T.BoxGeometry(width, .5, depth), m.surface('#d8bb83', .9));
        const grass = new T.Mesh(new T.BoxGeometry(width - .25, .15, depth - .25), m.surface('#78a86a', .9));
        grass.position.y = .32; model.add(sand, grass);
    } else if (evidence.targetId === 'flag' || evidence.source === 'flag') model = buildFlag(m, flagColor);
    else return undefined;
    model.userData.memorySnapshot = structuredClone(evidence.snapshot);
    return model;
}

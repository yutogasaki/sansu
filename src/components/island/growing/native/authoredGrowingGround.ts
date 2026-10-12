import * as T from 'three';
import type { SceneLayout } from '../sceneLayout';
import type { GardenTime } from '../../three/garden/presentation';
import { buildAuthoredPoolRipples, colorAuthoredWater } from './authoredWaterAppearance';
import { buildAuthoredWaterBridgeArt, type AuthoredWaterBridgeSkin } from './authoredWaterBridgeArt';
import type { WorldPoint } from '../../../../domain/growingIsland/worldTypes';

export interface AuthoredCoastSkin {
    version: 1;
    worldId: string;
    source: { artifact: string; sha256: string };
    parts: readonly {
        name: string;
        positions: readonly number[];
        normals: readonly number[];
        indices: readonly number[];
        material: { name: string; color: readonly number[]; roughness: number; metalness: number };
    }[];
}

/** These are the evaluated water and bank triangles, not a second decorative
 * pond. Their bottoms live in the same dry mesh used by groundAt(). */
export function buildAuthoredGrowingWater(layout: SceneLayout) {
    const root = new T.Group(); root.name = 'authored-shared-water';
    const geometries: T.BufferGeometry[] = [], materials: T.Material[] = [], rippleDisposers: (() => void)[] = [];
    const geometryAt = (points: readonly { x: number; y: number; z: number }[], indices: readonly number[]) => {
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(points.flatMap(point => [point.x - layout.center, point.y, point.z - 2]), 3));
        geometry.setIndex([...indices]); geometry.computeVertexNormals(); geometries.push(geometry); return geometry;
    };
    for (const surface of layout.world.floors.filter(floor => floor.kind === 'water')) {
        const pool = layout.authoredWaterPlan?.pools.find(pool => pool.waterFloorId === surface.id);
        const geometry = geometryAt(surface.vertices.map(vertex => vertex.point), surface.indices);
        const graduated = colorAuthoredWater(geometry, surface, pool);
        const material = new T.MeshPhysicalMaterial({ color: graduated ? '#ffffff' : surface.color, vertexColors: graduated, roughness: .16, metalness: .04,
            transparent: true, opacity: .9, clearcoat: .88, clearcoatRoughness: .14, side: T.DoubleSide });
        const mesh = new T.Mesh(geometry, material);
        mesh.name = 'authored-water-floor'; mesh.userData.worldFloor = surface.id;
        mesh.receiveShadow = true;
        if (pool) mesh.userData.objectId = pool.ownerId;
        else if (layout.authoredWaterPlan) {
            const plan = layout.authoredWaterPlan;
            const bowlIds = new Set(plan.pools.map(pool => pool.ownerId));
            const candidates = plan.streams.filter(stream => stream.waterFloorIds.includes(surface.id))
                .flatMap(stream => stream.ownerIds.map((id, i) => ({ id, point: i === 0 ? stream.from : stream.to })));
            const channels = candidates.filter(candidate => !bowlIds.has(candidate.id));
            const center = surface.vertices.reduce((sum, vertex) => ({ x: sum.x + vertex.point.x / surface.vertices.length,
                z: sum.z + vertex.point.z / surface.vertices.length }), { x: 0, z: 0 });
            const owner = (channels.length ? channels : candidates).sort((a, b) =>
                Math.hypot(a.point.x - center.x, a.point.z - center.z) - Math.hypot(b.point.x - center.x, b.point.z - center.z)
                || a.id.localeCompare(b.id))[0];
            if (owner) mesh.userData.objectId = owner.id;
        }
        root.add(mesh); materials.push(material);
        if (pool) {
            const ripples = buildAuthoredPoolRipples(layout, pool, surface);
            root.add(ripples.strokes); rippleDisposers.push(ripples.dispose);
        }
    }
    for (const surface of layout.world.surfaces) {
        const material = new T.MeshStandardMaterial({ color: surface.material.color, roughness: surface.material.roughness,
            metalness: surface.material.metalness, opacity: surface.material.opacity ?? 1,
            transparent: (surface.material.opacity ?? 1) < 1, side: T.DoubleSide });
        const mesh = new T.Mesh(geometryAt(surface.vertices, surface.indices), material);
        mesh.name = `authored-${surface.kind}`; mesh.userData.worldSurface = surface.id;
        mesh.receiveShadow = surface.kind === 'bank'; mesh.castShadow = surface.kind === 'bank';
        // The bank's minerals are part of the owned water shape, and remain
        // outside the dry pointer support just like its other vertical faces.
        mesh.raycast = () => {}; root.add(mesh); materials.push(material);
    }
    root.userData.worldRevision = layout.world.definition.revision;
    return { root, dispose() { rippleDisposers.forEach(dispose => dispose()); geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); } };
}

/** The actual dry triangles are both the visible floor and the pointer target.
 * Authored stone sides are skin only: they grant no planting or walking right. */
export function buildAuthoredGrowingGround(layout: SceneLayout, skin?: AuthoredCoastSkin, bridgeSkin?: AuthoredWaterBridgeSkin) {
    if (!layout.authored) throw Error('Authored ground requires an authored world');
    if (skin && (skin.worldId !== layout.world.id || skin.source.sha256 !== layout.world.definition.source?.sha256)) throw Error('Authored coast and floor sources differ');
    const root = new T.Group(); root.name = 'authored-shared-terrain';
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    const sourceNormals: (WorldPoint | undefined)[] = [], floorMaterials: T.MeshStandardMaterial[] = [];
    const materialIndices = new Map<string, number>(), groups: { start: number; count: number; materialIndex: number }[] = [];
    for (const surface of layout.world.floors.filter(floor => floor.kind === 'ground' || floor.kind === 'deck')) {
        const offset = positions.length / 3, color = new T.Color(surface.color);
        const appearance = surface.material ?? { roughness: .95, metalness: 0, doubleSided: false };
        const key = JSON.stringify([appearance.roughness, appearance.metalness, appearance.doubleSided]);
        let materialIndex = materialIndices.get(key);
        if (materialIndex === undefined) {
            materialIndex = floorMaterials.length; materialIndices.set(key, materialIndex);
            floorMaterials.push(new T.MeshStandardMaterial({ vertexColors: true, roughness: appearance.roughness,
                metalness: appearance.metalness, side: appearance.doubleSided ? T.DoubleSide : T.FrontSide }));
        }
        groups.push({ start: indices.length, count: surface.indices.length, materialIndex });
        for (const { point, normal } of surface.vertices) {
            positions.push(point.x - layout.center, point.y, point.z - 2);
            colors.push(color.r, color.g, color.b);
            sourceNormals.push(normal);
        }
        for (const index of surface.indices) indices.push(index + offset);
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const normals = geometry.getAttribute('normal');
    sourceNormals.forEach((normal, i) => { if (normal) normals.setXYZ(i, normal.x, normal.y, normal.z); });
    for (const group of groups) geometry.addGroup(group.start, group.count, group.materialIndex);
    const floor = new T.Mesh(geometry, floorMaterials.length === 1 ? floorMaterials[0] : floorMaterials);
    floor.name = 'authored-evaluated-floor'; floor.receiveShadow = true;
    floor.userData.terrainSurface = true; floor.userData.worldDefinition = layout.world.id; root.add(floor);
    const geometries = [geometry], materials: T.Material[] = [...floorMaterials];
    for (const part of skin?.parts ?? []) {
        const coastGeometry = new T.BufferGeometry();
        const points = part.positions.map((value, index) => value - (index % 3 === 0 ? layout.center : index % 3 === 2 ? 2 : 0));
        coastGeometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
        coastGeometry.setAttribute('normal', new T.Float32BufferAttribute(part.normals, 3)); coastGeometry.setIndex([...part.indices]);
        const coastMaterial = new T.MeshStandardMaterial({ color: new T.Color().fromArray([...part.material.color]), roughness: part.material.roughness,
            metalness: part.material.metalness, side: T.DoubleSide }); coastMaterial.name = part.material.name;
        const mesh = new T.Mesh(coastGeometry, coastMaterial); mesh.name = part.name; mesh.receiveShadow = true;
        mesh.userData.authoredCoastSkin = true; root.add(mesh); geometries.push(coastGeometry); materials.push(coastMaterial);
    }
    const water = buildAuthoredGrowingWater(layout); if (water.root.children.length) root.add(water.root);
    const bridges = buildAuthoredWaterBridgeArt(layout, bridgeSkin); if (bridges.root.children.length) root.add(bridges.root);
    root.userData.worldDefinition = layout.world.id; root.userData.worldRevision = layout.world.definition.revision; root.userData.sourceSha256 = skin?.source.sha256;
    return { root, floor, dispose() { bridges.dispose(); water.dispose(); geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); } };
}

/** Water uses world units and leaves the authored inlet open. No ellipse or
 * rectangle under this sea is treated as an island edge. */
export function buildAuthoredGrowingSea(layout: SceneLayout) {
    const root = new T.Group(); root.name = 'authored-sea';
    const geometry = new T.PlaneGeometry(Math.max(160, layout.width * 12), Math.max(160, layout.depth * 12));
    const material = new T.ShaderMaterial({ uniforms: { at: { value: 0 }, deep: { value: new T.Color('#388daf') },
        shallow: { value: new T.Color('#79d4d0') }, magic: { value: .22 } },
    vertexShader: 'varying vec2 p; void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 p; uniform float at; uniform vec3 deep; uniform vec3 shallow; uniform float magic;
        void main(){float waves=sin(p.x*2.7+p.y*1.4+at*.3)+sin(p.y*3.5-p.x*.7-at*.21);
        vec3 color=mix(deep,shallow,.10+waves*.025);
        float glint=pow(max(0.,sin(p.x*4.1+sin(p.y*3.)+at*.24)*sin(p.y*4.8-at*.14)),18.);
        color+=vec3(.32,.34,.20)*glint*.21*magic;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }` });
    const sea = new T.Mesh(geometry, material); sea.name = 'life-sea'; sea.rotation.x = -Math.PI / 2; sea.position.y = -.4; root.add(sea);
    return { root, setTime(time: GardenTime) {
        material.uniforms.deep.value.set(time === 'night' ? '#527ba7' : time === 'dusk' ? '#658cb7' : '#388daf');
        material.uniforms.shallow.value.set(time === 'night' ? '#86b9d3' : '#79d4d0');
    }, animate(at: number, reduced: boolean) { material.uniforms.at.value = reduced ? 0 : at / 1000; },
    dispose() { geometry.dispose(); material.dispose(); } };
}

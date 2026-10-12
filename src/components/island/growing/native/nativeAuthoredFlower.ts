import * as T from 'three';
import profile from '../../../../../docs/design/2026-10-11-authored-flower-garden/native-flower-support-profile.json';
import { BLOOM_HOURS } from '../../../../domain/growingIsland/environment';

export interface NativeAuthoredFlowerSkin {
    version: 1;
    source: { artifact: string; sha256: string; id: string };
    scale: number;
    pivot: readonly number[];
    stockHeight: number;
    parts: readonly {
        name: string; role: string; positions: readonly number[]; normals: readonly number[]; indices: readonly number[];
        material: { name: string; color: string; roughness: number; metalness: number; doubleSided: boolean };
        bounds: { min: readonly number[]; max: readonly number[] };
        joints?: readonly (readonly number[])[]; attach?: readonly number[];
    }[];
}
export interface AuthoredFlowerOwner {
    id: string; point: T.Vector3; growth: number; color?: string;
}
export interface AuthoredFlowerSupportInput {
    owners: readonly AuthoredFlowerOwner[];
    crownBase: T.Vector3;
    crownScale: number;
    connected: boolean;
    /** Only current, explicitly joined mature owners may share a lateral bough. */
    links?: readonly (readonly [string, string])[];
    /** Current seat use targets from this same place, in the shared world space. */
    seats?: readonly { id: string; point: T.Vector3 }[];
}

type Part = NativeAuthoredFlowerSkin['parts'][number];
type Batch = { positions: number[]; indices: number[]; material: T.Material; names: Set<string>; roles: Set<string> };
const vec = (values: readonly number[]) => new T.Vector3(values[0], values[1], values[2]);
const finite = (values: readonly number[]) => values.every(Number.isFinite);

/** Adapt only missing native support pieces to real owned anchors. This factory
 * owns the material palette; each build's geometry belongs to its object layer.
 * Nothing here supplies a floor, route, grant or simulated use. */
export function makeNativeAuthoredFlower(skin: NativeAuthoredFlowerSkin) {
    if (skin.version !== 1 || skin.source.id !== profile.source.id || skin.source.sha256 !== profile.source.sha256
        || skin.scale !== profile.scale || skin.stockHeight !== profile.stockHeight || skin.parts.length !== profile.counts.parts)
        throw Error('Native flower support source differs');
    const materials = new Map<string, T.MeshStandardMaterial>();
    const parts = new Map<string, Part[]>();
    for (const part of skin.parts) {
        const source = profile.parts.find(source => source.name === part.name);
        if (!source || source.role !== part.role || part.positions.length !== source.vertices * 3
            || part.normals.length !== part.positions.length || part.indices.length !== source.triangles * 3
            || !finite(part.positions) || !finite(part.normals)
            || part.indices.some(index => !Number.isInteger(index) || index < 0 || index >= source.vertices))
            throw Error(`Native flower support part differs: ${part.name}`);
        if (!materials.has(part.material.name)) {
            const { color, roughness, metalness, doubleSided } = part.material;
            if (!/^#[\da-f]{6}$/i.test(color) || !finite([roughness, metalness])
                || roughness < 0 || roughness > 1 || metalness < 0 || metalness > 1)
                throw Error('Native flower support material differs');
            const material = new T.MeshStandardMaterial({ color, roughness, metalness, side: doubleSided ? T.DoubleSide : T.FrontSide });
            material.name = part.material.name; materials.set(part.material.name, material);
        }
        const group = parts.get(part.role) ?? []; group.push(part); parts.set(part.role, group);
    }
    let disposed = false;
    function add(batch: Map<string, Batch>, part: Part, transform: (source: T.Vector3) => T.Vector3) {
        const entry = batch.get(part.material.name) ?? { positions: [], indices: [], material: materials.get(part.material.name)!, names: new Set<string>(), roles: new Set<string>() };
        const offset = entry.positions.length / 3;
        for (let i = 0; i < part.positions.length; i += 3) {
            const point = transform(new T.Vector3(part.positions[i], part.positions[i + 1], part.positions[i + 2]));
            if (!finite(point.toArray())) throw Error('Native flower adaptation is non-finite');
            entry.positions.push(point.x, point.y, point.z);
        }
        entry.indices.push(...part.indices.map(index => index + offset));
        entry.names.add(part.name); entry.roles.add(part.role); batch.set(part.material.name, entry);
    }
    function finish(batch: Map<string, Batch>, parent: T.Group, name: string) {
        for (const entry of batch.values()) {
            const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(entry.positions, 3));
            geometry.setIndex(entry.indices); geometry.computeVertexNormals();
            const mesh = new T.Mesh(geometry, entry.material); mesh.name = name;
            mesh.castShadow = mesh.receiveShadow = true;
            mesh.userData.nativeSharedMaterial = true; mesh.userData.nativeSharedGeometry = false;
            mesh.userData.sourceNative05Names = [...entry.names]; mesh.userData.nativeRoles = [...entry.roles];
            mesh.userData.sourceSha256 = skin.source.sha256; mesh.userData.visualOnly = true;
            mesh.userData.ownerId = parent.userData.ownerId; mesh.userData.ownerIds = parent.userData.ownerIds;
            if (parent.userData.seatId) mesh.userData.seatId = parent.userData.seatId;
            mesh.userData.objectId = parent.userData.ownerId ?? parent.userData.ownerIds?.[0]; parent.add(mesh);
        }
    }
    /** Preserve the native curve's cross-section and sideways bend while moving
     * its real joints. The crown joint is above its lower tip by the source offset. */
    function reaching(part: Part, from: T.Vector3, to: T.Vector3) {
        const start = vec(part.joints![0]), end = vec(part.joints![part.joints!.length - 1]);
        const sourceDirection = end.clone().sub(start); sourceDirection.y = 0;
        const targetDirection = to.clone().sub(from); targetDirection.y = 0;
        const yaw = Math.atan2(sourceDirection.z, sourceDirection.x) - Math.atan2(targetDirection.z, targetDirection.x);
        const rotation = new T.Matrix4().makeRotationY(yaw);
        return (point: T.Vector3) => {
            const u = (point.y - start.y) / (end.y - start.y);
            const residual = point.clone().sub(start.clone().lerp(end, u)).applyMatrix4(rotation);
            // Horizontal residuals retain the native curved branch, rather than
            // multiplying its crown span to fit a long line of owner cells.
            residual.x *= .65; residual.z *= .65;
            return from.clone().lerp(to, u).add(residual);
        };
    }
    function lateral(part: Part, from: T.Vector3, to: T.Vector3) {
        const start = vec(part.joints![0]), end = vec(part.joints![part.joints!.length - 1]), direction = end.clone().sub(start); direction.y = 0;
        const denominator = direction.lengthSq();
        const target = to.clone().sub(from); target.y = 0;
        const yaw = Math.atan2(direction.z, direction.x) - Math.atan2(target.z, target.x), rotation = new T.Matrix4().makeRotationY(yaw);
        return (point: T.Vector3) => {
            const relative = point.clone().sub(start), u = (relative.x * direction.x + relative.z * direction.z) / denominator;
            const residual = point.clone().sub(start.clone().lerp(end, u)).applyMatrix4(rotation);
            residual.x *= .65; residual.z *= .65; residual.y *= .48;
            return from.clone().lerp(to, u).add(residual);
        };
    }
    return {
        build(input: AuthoredFlowerSupportInput) {
            if (disposed) throw Error('Native flower support is disposed');
            if (!finite(input.crownBase.toArray()) || !Number.isFinite(input.crownScale) || input.crownScale <= 0
                || new Set(input.owners.map(owner => owner.id)).size !== input.owners.length
                || input.owners.some(owner => !owner.id || !finite(owner.point.toArray()) || !Number.isFinite(owner.growth))
                || new Set(input.seats?.map(seat => seat.id)).size !== (input.seats?.length ?? 0)
                || input.seats?.some(seat => !seat.id || !finite(seat.point.toArray())))
                throw Error('Native flower support owners differ');
            const root = new T.Group(); root.name = 'authored-flower-support'; root.userData.nativePart = 'flower-support';
            root.userData.sourceSha256 = skin.source.sha256; root.userData.ownerIds = input.owners.map(owner => owner.id); root.userData.visualOnly = true;
            const mature = input.owners.filter(owner => owner.growth >= BLOOM_HOURS);
            const joint = input.crownBase.clone().add(vec(profile.crown.stemOffset).multiplyScalar(input.crownScale / skin.scale));
            const stocks = new Map<string, { owner: AuthoredFlowerOwner; height: number; group: T.Group }>();
            const leaf = parts.get('leaf')![0];
            for (const [index, owner] of mature.entries()) {
                const stock = new T.Group(); stock.name = 'authored-flower-owned-stock';
                stock.userData = { ownerId: owner.id, ownerIds: [owner.id], growth: owner.growth, color: owner.color,
                    groundPoint: owner.point.toArray(), sourceScale: skin.scale, visualOnly: true };
                root.add(stock);
                const height = Math.max(.65, Math.min(skin.stockHeight, joint.y - owner.point.y - .08));
                stock.userData.stockHeight = height; stocks.set(owner.id, { owner, height, group: stock });
                const batch = new Map<string, Batch>();
                for (const role of ['trunk', 'root', 'ridge']) for (const part of parts.get(role)!) {
                    add(batch, part, point => new T.Vector3(point.x * .78, point.y * height / skin.stockHeight, point.z * .78).add(owner.point));
                }
                // Broad leaves emerge from the real stock. Their lower spread
                // stays inside its .58 owner envelope; upper leaves clear people.
                const attach = owner.point.clone().add(new T.Vector3(0, height * .57, 0));
                for (let i = 0; i < 3; i++) {
                    const rotate = new T.Matrix4().makeRotationY(i * Math.PI * 2 / 3 + index * .7);
                    add(batch, leaf, point => point.sub(vec(leaf.attach!)).multiplyScalar(.66).applyMatrix4(rotate).add(attach));
                }
                const tips = new T.Group(); tips.name = 'authored-flower-branch-foliage';
                tips.userData = { ownerId: owner.id, ownerIds: [owner.id], sourceScale: skin.scale, branchLeafJoints: [], visualOnly: true };
                stock.add(tips);
                const tipBatch = new Map<string, Batch>();
                for (const part of parts.get('grown-branch')!) {
                    const adapt = (point: T.Vector3) => new T.Vector3(point.x * .65, point.y * height / skin.stockHeight, point.z * .65).add(owner.point);
                    add(batch, part, adapt);
                    const tip = adapt(vec(part.joints![part.joints!.length - 1]));
                    const direction = tip.clone().sub(adapt(vec(part.joints![0])));
                    const yaw = Math.atan2(-direction.x, -direction.z), rotate = new T.Matrix4().makeRotationY(yaw);
                    // Full source leaves join the three actual branch tips. The
                    // native blades form a high mass instead of bare cut ends;
                    // their attachment and proportions do not follow the crown.
                    add(tipBatch, leaf, point => point.sub(vec(leaf.attach!)).applyMatrix4(rotate).add(tip));
                    tips.userData.branchLeafJoints.push({ sourceBranch: part.name, point: tip.toArray(), yaw });
                }
                finish(batch, stock, 'authored-flower-stock');
                finish(tipBatch, tips, 'authored-flower-tip-foliage');
                const trunk = parts.get('trunk')![0], topJoint = vec(trunk.joints![trunk.joints!.length - 1]);
                const top = new T.Vector3(topJoint.x * .78, topJoint.y * height / skin.stockHeight, topJoint.z * .78).add(owner.point);
                const topLeaves = new T.Group(); topLeaves.name = 'authored-flower-stock-top-foliage';
                topLeaves.userData = { ownerId: owner.id, ownerIds: [owner.id], sourceScale: skin.scale,
                    sourceTrunk: trunk.name, joint: top.toArray(), visualOnly: true };
                stock.add(topLeaves);
                const topBatch = new Map<string, Batch>();
                // A leaf pair emerges from the trunk's actual last joint and
                // overlaps the lateral tip leaves, covering the exposed cap.
                for (const branch of [parts.get('grown-branch')![0], parts.get('grown-branch')![2]]) {
                    const tip = vec(branch.joints![branch.joints!.length - 1]).multiply(new T.Vector3(.65, height / skin.stockHeight, .65)).add(owner.point);
                    const direction = tip.sub(top), rotation = new T.Matrix4().makeRotationY(Math.atan2(-direction.x, -direction.z));
                    add(topBatch, leaf, point => point.sub(vec(leaf.attach!)).applyMatrix4(rotation).add(top));
                }
                finish(topBatch, topLeaves, 'authored-flower-top-foliage');
            }
            if (input.connected && mature.length >= 4) {
                const shared = new T.Group(); shared.name = 'authored-flower-shared-support';
                shared.userData = { ownerIds: mature.map(owner => owner.id), visualOnly: true, crownJoint: joint.toArray() }; root.add(shared);
                const batch = new Map<string, Batch>(), stem = parts.get('canopy-stem')![0], bough = parts.get('joined-bough')![0];
                for (const { owner, height, group } of stocks.values()) {
                    const from = owner.point.clone().add(new T.Vector3(0, height * .75, 0));
                    const adaptStem = reaching(stem, from, joint); add(batch, stem, adaptStem);
                    const direction = joint.clone().sub(from); direction.y = 0;
                    const leafAt = adaptStem(vec(stem.joints![1]));
                    const rotate = new T.Matrix4().makeRotationY(Math.atan2(-direction.x, -direction.z));
                    add(batch, leaf, point => point.sub(vec(leaf.attach!)).multiplyScalar(.83).applyMatrix4(rotate).add(leafAt));

                    const seat = input.seats?.reduce<NonNullable<AuthoredFlowerSupportInput['seats']>[number] | undefined>((nearest, candidate) => {
                        const distance = Math.hypot(candidate.point.x - owner.point.x, candidate.point.z - owner.point.z);
                        const best = nearest ? Math.hypot(nearest.point.x - owner.point.x, nearest.point.z - owner.point.z) : Infinity;
                        return distance < best || (distance === best && candidate.id < nearest!.id) ? candidate : nearest;
                    }, undefined);
                    if (!seat) continue;
                    const sourceStart = vec(stem.joints![0]), sourceEnd = vec(stem.joints![stem.joints!.length - 1]);
                    const sourceDirection = sourceEnd.clone().sub(sourceStart); sourceDirection.y = 0;
                    const towardSeat = seat.point.clone().sub(owner.point); towardSeat.y = 0;
                    const reach = sourceDirection.length(), distance = towardSeat.length();
                    if (distance <= .001 || distance > reach) continue;
                    const yaw = Math.atan2(sourceDirection.z, sourceDirection.x) - Math.atan2(towardSeat.z, towardSeat.x);
                    const rotation = new T.Matrix4().makeRotationY(yaw);
                    // Only yaw and translation: this native curve can reach a
                    // nearby seat, but it cannot stretch to a distant use. Its
                    // root joins the real stock, whose own roots meet the floor.
                    const rigid = (point: T.Vector3) => point.sub(sourceStart).applyMatrix4(rotation).add(from);
                    // Source yaw leaves every height intact. If this seat's
                    // floor rises into the low end of that rigid bough, omit it;
                    // do not lift it off its stock or bend it around an actor.
                    const low = rigid(vec(stem.bounds.min)).y;
                    if (low <= seat.point.y + .45 * 1.166671391 + .14) continue;
                    const edge = new T.Group(); edge.name = 'authored-flower-seat-bough';
                    edge.userData = { ownerId: owner.id, ownerIds: [owner.id], seatId: seat.id, seatPoint: seat.point.toArray(),
                        groundPoint: owner.point.toArray(), sourceScale: skin.scale, sourcePlanarReach: reach,
                        sourceStart: sourceStart.toArray(), sourceEnd: sourceEnd.toArray(), yaw,
                        joints: stem.joints!.map(joint => rigid(vec(joint)).toArray()), visualOnly: true };
                    // Staying beneath this stock also puts the real triangles
                    // into the same obstruction index and owner selection path.
                    group.add(edge);
                    const edgeBatch = new Map<string, Batch>(); add(edgeBatch, stem, rigid);
                    for (const [jointIndex, angle] of [[1, -.22], [1, .22], [2, Math.PI]]) {
                        const at = rigid(vec(stem.joints![jointIndex]));
                        // Middle leaves overlap over the seat, while the end
                        // blade returns toward it instead of pointing past it.
                        const leafYaw = Math.atan2(-towardSeat.x, -towardSeat.z) + angle;
                        const leafRotation = new T.Matrix4().makeRotationY(leafYaw);
                        add(edgeBatch, leaf, point => point.sub(vec(leaf.attach!)).applyMatrix4(leafRotation).add(at));
                    }
                    finish(edgeBatch, edge, 'authored-flower-seat-foliage');
                }
                for (const [a, b] of input.links ?? []) {
                    const left = stocks.get(a), right = stocks.get(b); if (!left || !right) continue;
                    const from = left.owner.point.clone(), to = right.owner.point.clone();
                    from.y += left.height * .82;
                    to.y += right.height * .82;
                    add(batch, bough, lateral(bough, from, to));
                }
                finish(batch, shared, 'authored-flower-high-support');
            }
            return root;
        },
        dispose() { if (disposed) return; disposed = true; materials.forEach(material => material.dispose()); materials.clear(); },
    };
}
export type NativeAuthoredFlower = ReturnType<typeof makeNativeAuthoredFlower>;

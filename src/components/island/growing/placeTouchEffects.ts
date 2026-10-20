import * as T from 'three';
import type { PlacePlay } from '../../../domain/growingIsland/placePlay';
import type { SceneLayout } from './sceneLayout';

/** One replaceable response, 900 ms total. No saved object or collision floor moves. */
export class PlaceTouchEffects {
    readonly root = new T.Group();
    private at = 0;
    private leaves: { object: T.Object3D; rotation: T.Euler; delay: number }[] = [];
    private kind: PlacePlay['kind'] = 'water';
    private markers: { mesh: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>; delay: number; sounded?: boolean }[] = [];
    constructor(scene: T.Scene, private readonly tone?: (kind: PlacePlay['kind'], index: number) => void) { this.root.name = 'place-touch-reply'; scene.add(this.root); }
    start(play: PlacePlay, layout: SceneLayout, now: number, visible: (point: T.Vector3) => boolean, reduced: boolean, owners?: T.Object3D) {
        this.clear(); this.at = now; this.kind = play.kind;
        const color = play.kind === 'water' ? 0x63b5ef : play.kind === 'petals' ? 0xeb8daf : 0xf5d67d;
        for (const reply of play.replies) {
            const point = layout.point(reply.cell, play.kind === 'leaves' ? 1.65 : .07);
            if (!visible(point) || this.markers.length >= 48) continue;
            const mesh = new T.Mesh(new T.RingGeometry(.12, .15, 24), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }));
            mesh.position.copy(point); mesh.rotation.x = -Math.PI / 2;
            this.root.add(mesh); this.markers.push({ mesh, delay: reduced ? 0 : reply.delay });
        }
        if (play.kind === 'leaves' && !reduced && owners) owners.traverse(object => {
            if (!(object instanceof T.Mesh) || this.leaves.length >= 96) return;
            for (let parent: T.Object3D | null = object; parent; parent = parent.parent) {
                if (!parent.visible) return;
                const ownerId = parent.userData.ownerId ?? parent.userData.objectId;
                if (ownerId && !play.replies.some(reply => reply.id === ownerId)) return;
            }
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            if (!/leaf|leaves|foliage/i.test(object.name + materials.map(material => material.name).join(' ')) || /wood|trunk|floor/i.test(object.name)) return;
            const center = new T.Box3().setFromObject(object).getCenter(new T.Vector3());
            if (!visible(center)) return;
            const closest = play.replies.map(reply => ({ reply, distance: layout.point(reply.cell).distanceTo(new T.Vector3(center.x, layout.point(reply.cell).y, center.z)) }))
                .sort((a, b) => a.distance - b.distance)[0];
            if (closest && closest.distance <= 1.3) this.leaves.push({ object, rotation: object.rotation.clone(), delay: closest.reply.delay });
        });
        return this.markers.length;
    }
    tick(now: number, reduced: boolean) {
        if (now - this.at >= 900) { this.clear(); return; }
        for (const [index, marker] of this.markers.entries()) {
            const { mesh, delay } = marker;
            const t = (now - this.at - delay) / 400;
            mesh.visible = t >= 0 && t <= 1;
            if (mesh.visible && !marker.sounded) { marker.sounded = true; this.tone?.(this.kind, index); }
            mesh.material.opacity = mesh.visible ? .85 * Math.sin(Math.PI * t) : 0;
            mesh.scale.setScalar(reduced ? 1.5 : 1 + 3 * Math.max(0, t));
        }
        for (const { object, rotation, delay } of this.leaves) {
            const t = (now - this.at - delay) / 400;
            object.rotation.copy(rotation);
            if (t >= 0 && t <= 1 && !reduced) object.rotation.z += Math.sin(t * Math.PI * 2) * .045;
        }
    }
    clear() { for (const { object, rotation } of this.leaves) object.rotation.copy(rotation); this.leaves = []; for (const { mesh } of this.markers) { mesh.geometry.dispose(); mesh.material.dispose(); } this.root.clear(); this.markers = []; }
    dispose() { this.clear(); this.root.removeFromParent(); }
}

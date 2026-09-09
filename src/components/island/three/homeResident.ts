import * as THREE from 'three';
import { IslandMaterials } from './primitives';
import { makeResidentRig, residentFootY, sampleResidentStride } from './residentRig';
import { HOME_WALK_START, planHomeWalk, type HomePoint } from './homeWalk';

/** Indoor presentation of the familiar otter. It owns no learning or saved island state. */
export class HomeResident {
    readonly group = new THREE.Group();
    private materials?: IslandMaterials;
    private rig?: ReturnType<typeof makeResidentRig>;
    private path: HomePoint[] = [];
    private lastTime = 0;
    private distance = 0;
    private total = 0;
    get moving() { return this.path.length > 0; }
    show(room: THREE.Group) {
        if (this.rig) return;
        this.materials = new IslandMaterials(); this.rig = makeResidentRig('otter', this.materials);
        this.rig.pose.scale.setScalar(1); this.rig.pose.position.set(HOME_WALK_START.x, .035, HOME_WALK_START.z);
        this.group.position.copy(room.position); this.group.quaternion.copy(room.quaternion); this.group.scale.copy(room.scale);
        this.group.add(this.rig.pose); this.group.visible = true;
    }
    walkTo(point: HomePoint, now: number, reduced: boolean) {
        if (!this.rig) return false;
        const start = { x: this.rig.pose.position.x, z: this.rig.pose.position.z }, path = planHomeWalk(start, point);
        if (!path || Math.hypot(point.x - start.x, point.z - start.z) < .05) return false;
        this.path = path.slice(1); this.lastTime = now; this.distance = 0;
        this.total = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.z - path[i].z), 0);
        if (reduced) { this.rig.pose.position.set(point.x, .035, point.z); this.path = []; this.poseFeet(); }
        return true;
    }
    private poseFeet() {
        if (!this.rig) return;
        const stride = sampleResidentStride(this.moving ? this.distance : 0, this.total);
        this.rig.body.position.y = stride.bob;
        this.rig.feet.forEach((foot, i) => { foot.position.y = residentFootY('otter') + stride.feet[i].lift; foot.position.z = stride.feet[i].z; });
        this.rig.shoulders.forEach((arm, i) => { arm.rotation.x = stride.feet[i].arm; });
    }
    update(now: number) {
        if (!this.rig || !this.moving) return false;
        let remaining = Math.min(.05, Math.max(0, (now - this.lastTime) / 1000)) * 1.2; this.lastTime = now;
        while (remaining > 0 && this.path.length) {
            const next = this.path[0], p = this.rig.pose.position, dx = next.x - p.x, dz = next.z - p.z, d = Math.hypot(dx, dz);
            const step = Math.min(d, remaining);
            if (d > 1e-6) { p.x += dx / d * step; p.z += dz / d * step; this.rig.pose.rotation.y = Math.atan2(dx, dz); }
            this.distance += step; remaining -= step;
            if (d <= step + 1e-6) this.path.shift();
        }
        this.poseFeet(); return this.moving;
    }
    describe() { return { visible: this.group.visible && Boolean(this.rig), moving: this.moving, position: this.rig?.pose.position.toArray(), destination: this.path[this.path.length - 1] }; }
    hide() {
        this.path = []; this.group.visible = false;
        const geometry = new Set<THREE.BufferGeometry>();
        this.group.traverse(o => { if (o instanceof THREE.Mesh) geometry.add(o.geometry); });
        geometry.forEach(g => g.dispose()); this.group.clear(); this.materials?.dispose(); this.materials = undefined; this.rig = undefined;
    }
}

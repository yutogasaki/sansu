import * as THREE from 'three';
import { cylinder, ellipsoid, mesh, IslandMaterials, disposeGeometry } from './primitives';
import type { SharedDisplayTargetVisual } from './sharedDisplayScene';

/** Finite work props and a real spotlight. The ray must hit the selected actual
 * surface before a projected colour or shadow result can become visible. */
export class SharedJobVisuals {
    readonly group = new THREE.Group();
    readonly petals: THREE.Mesh[];
    readonly lamp = new THREE.Group();
    readonly snack: THREE.Mesh;
    readonly spotlight = new THREE.SpotLight('#ffe5a6', 7, 5, .48, .5, 1.2);
    private readonly m = new IslandMaterials();
    private readonly beam: THREE.Mesh;
    private readonly colour: THREE.Mesh;
    private readonly receiver: THREE.Object3D = new THREE.Object3D();
    lastProbe?: { point?: number[]; materialColor?: string; transmitting?: boolean; reason: string };
    lightContact?: { source: THREE.Vector3; surface: THREE.Vector3; receiver: THREE.Vector3; uuid: string; materialColor?: string; effect: 'shadow' | 'transmit' };
    constructor() {
        this.group.name = 'shared-job-props'; this.group.visible = false;
        this.petals = [0, 1, 2].map(i => { const petal = ellipsoid(this.group, this.m.get(i === 1 ? '#d16d9c' : '#e89cbb'), [0, 0, 0], [.09, .022, .055], 16); petal.name = `shared-job-petal-${i + 1}`; return petal; });
        this.lamp.name = 'shared-job-lamp'; this.group.add(this.lamp);
        cylinder(this.lamp, this.m.get('#9a7c66'), [0, .04, 0], .035, .16, .035, 12);
        ellipsoid(this.lamp, this.m.get('#eac374'), [0, .18, 0], [.11, .10, .075], 18);
        ellipsoid(this.lamp, this.m.get('#fff0b9', true), [0, .18, .055], [.075, .06, .035], 18);
        const beamMaterial = new THREE.MeshBasicMaterial({ color: '#ffe2a1', transparent: true, opacity: .22, depthWrite: false });
        this.beam = mesh(this.group, new THREE.CylinderGeometry(.035, .10, 1, 16, 1, true), beamMaterial);
        this.beam.castShadow = false; this.beam.receiveShadow = false;
        const colourMaterial = new THREE.MeshBasicMaterial({ color: '#5ccfb3', transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide });
        this.colour = mesh(this.group, new THREE.CircleGeometry(.16, 24), colourMaterial); this.colour.rotation.x = -Math.PI / 2;
        this.colour.castShadow = false; this.colour.receiveShadow = false;
        this.snack = ellipsoid(this.group, this.m.get('#e6ad70'), [0, 0, 0], [.075, .035, .06], 16); this.snack.name = 'shared-job-snack';
        this.spotlight.castShadow = true; this.spotlight.shadow.mapSize.set(512, 512);
        this.spotlight.shadow.bias = -.001; this.spotlight.shadow.normalBias = .01;
        this.spotlight.target = this.receiver; this.group.add(this.spotlight, this.receiver); this.reset();
    }
    reset() {
        this.group.visible = false; this.petals.forEach(petal => { petal.visible = false; });
        this.lamp.visible = this.snack.visible = this.beam.visible = this.colour.visible = this.spotlight.visible = false;
        this.lightContact = undefined;
    }
    emitter() { this.lamp.updateWorldMatrix(true, true); return this.lamp.localToWorld(new THREE.Vector3(0, .18, .065)); }
    illuminate(target: SharedDisplayTargetVisual, surface: THREE.Vector3, tableY: number, tableCenter: THREE.Vector3, tableRadius: number, effect: 'shadow' | 'transmit') {
        this.lastProbe = { reason: 'no-hit' };
        this.lightContact = undefined; this.beam.visible = this.colour.visible = this.spotlight.visible = false;
        const source = this.emitter(), direction = surface.clone().sub(source).normalize();
        target.group.updateWorldMatrix(true, true);
        const objects: THREE.Mesh[] = [];
        target.group.traverseVisible(object => { if (object instanceof THREE.Mesh) objects.push(object); });
        const hit = new THREE.Raycaster(source, direction, .001, source.distanceTo(surface) + .2).intersectObjects(objects, false)[0];
        if (!hit || direction.y >= -.01) return false;
        const mesh = hit.object as THREE.Mesh;
        const material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
        const materialColor = material && 'color' in material && material.color instanceof THREE.Color ? material.color.getHexString() : undefined;
        this.lastProbe = { point: hit.point.toArray(), materialColor, transmitting: material?.userData.sharedTransmits === true, reason: 'material' };
        // Transmission is available only at the actual glass face, not an
        // intervening tray, sand patch or wooden wheel blade along the same ray.
        if (effect === 'transmit' && material?.userData.sharedTransmits !== true) return false;
        const receiver = new THREE.Ray(hit.point.clone().addScaledVector(direction, .004), direction)
            .intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -tableY), new THREE.Vector3());
        this.lastProbe.reason = 'receiver';
        if (!receiver || Math.hypot(receiver.x - tableCenter.x, receiver.z - tableCenter.z) > tableRadius - .03) return false;
        const from = this.group.worldToLocal(source.clone()), to = this.group.worldToLocal(hit.point.clone()), delta = to.clone().sub(from);
        this.beam.position.copy(from).add(to).multiplyScalar(.5); this.beam.scale.set(1, delta.length(), 1);
        this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); this.beam.visible = true;
        this.spotlight.position.copy(from); this.receiver.position.copy(this.group.worldToLocal(receiver.clone())); this.spotlight.visible = true;
        if (effect === 'transmit') { this.colour.position.copy(this.group.worldToLocal(receiver.clone().add(new THREE.Vector3(0, .008, 0)))); this.colour.visible = true; }
        this.lastProbe.reason = 'valid';
        this.lightContact = { source, surface: hit.point.clone(), receiver, uuid: hit.object.uuid, materialColor, effect }; return true;
    }
    dispose() {
        this.reset(); this.spotlight.shadow.map?.dispose(); this.spotlight.dispose();
        disposeGeometry(this.group); (this.beam.material as THREE.Material).dispose(); (this.colour.material as THREE.Material).dispose();
        this.m.dispose(); this.group.removeFromParent(); this.group.clear();
    }
}

import * as THREE from 'three';
import { type ToyFrame, smooth } from './choreography';
import { ToyPrimitives, type ToyMaterials } from './materials';

/** ROOT_PATH is separate from the local articulated toy. A future GLB can replace this factory. */
export function createDoll(p: ToyPrimitives, m: ToyMaterials) {
    const root = new THREE.Group(); root.name = 'doll-path'; root.scale.setScalar(1.045);
    const facing = new THREE.Group(); facing.rotation.y = 1.0; root.add(facing);
    const hips = new THREE.Group(); hips.position.y = .365; facing.add(hips);
    const body = new THREE.Group(); hips.add(body);
    p.ellipsoid(body, m.violet, [0, .15, 0], [.227, .245, .17]);
    p.ellipsoid(body, m.cream, [0, .12, .145], [.14, .145, .041]);
    const head = new THREE.Group(); head.position.set(0, .53, 0); body.add(head);
    const bean = p.keep(new THREE.SphereGeometry(1, 32, 24));
    const pos = bean.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        pos.setXYZ(i, x * (1 - .11 * y) + .07 * y * y, y, z * (1 - .08 * y));
    }
    bean.computeVertexNormals();
    p.mesh(head, bean, m.violet, [0, 0, 0], [.315, .31, .255]);
    p.ellipsoid(head, m.violet, [-.14, .272, .04], [.078, .084, .072]);
    p.ellipsoid(head, m.cream, [.015, -.034, .182], [.26, .235, .106]);
    for (const x of [-.077, .106]) {
        p.ellipsoid(head, m.ink, [x, -.025, .282], [.031, .045, .014]);
        p.ellipsoid(head, m.cream, [x - .006, -.013, .295], [.007, .01, .004]);
    }
    p.ellipsoid(head, m.cream, [.015, -.08, .294], [.029, .023, .024]);
    p.tube(head, m.ink, Array.from({ length: 9 }, (_, i) => {
        const a = i / 8 * Math.PI; return new THREE.Vector3(.016 - Math.cos(a) * .047, -.127 - Math.sin(a) * .021, .28);
    }), .008);
    const arms = [-1, 1].map(side => {
        const arm = new THREE.Group(); arm.position.set(side * .215, .275, 0); body.add(arm);
        p.ellipsoid(arm, m.violet, [side * .018, -.082, 0], [.07, .11, .075]);
        const elbow = new THREE.Group(); elbow.position.set(side * .025, -.15, 0); arm.add(elbow);
        p.ellipsoid(elbow, m.violet, [0, -.037, 0], [.061, .072, .064]);
        p.ellipsoid(elbow, m.cream, [0, -.099, .014], [.071, .074, .07]);
        return { arm, elbow, side };
    });
    const legs = [-1, 1].map(side => {
        const thigh = new THREE.Group(); thigh.position.x = side * .106; hips.add(thigh);
        p.ellipsoid(thigh, m.violet, [0, -.085, 0], [.074, .105, .076]);
        const knee = new THREE.Group(); knee.position.y = -.17; thigh.add(knee);
        p.ellipsoid(knee, m.violet, [0, -.068, 0], [.065, .09, .068]);
        const foot = new THREE.Group(); foot.position.y = -.17; knee.add(foot);
        p.ellipsoid(foot, m.cream, [0, -.006, .039], [.093, .072, .145]);
        p.ellipsoid(foot, m.sole, [0, -.051, .039], [.094, .023, .143]);
        return { thigh, knee, foot, side };
    });
    function pose(frame: ToyFrame) {
        root.position.set(frame.point.x, frame.point.y, frame.point.z);
        const { pose, poseAmount: amount, phase } = frame;
        const seated = pose === 'sit' ? amount : 0;
        const crouch = ['crouch', 'push', 'land', 'recover'].includes(pose) ? amount : 0;
        const airborne = pose === 'soar' ? 1 : 0;
        const gait = ['walk', 'climb'].includes(pose) ? Math.sin(phase * Math.PI * (pose === 'climb' ? 8 : 6)) * amount : 0;
        // The pelvis lowers to the seat; the route itself always samples the actual slide surface.
        const hipHeight = .365 - crouch * .145 - seated * .258;
        hips.position.y = hipHeight;
        body.rotation.x = .1 * crouch - .15 * seated;
        body.rotation.z = gait * .055;
        head.rotation.set(-.08 * airborne + .11 * crouch, -.27 + gait * .035, -.035 - airborne * .09);
        legs.forEach(({ thigh, knee, foot, side }) => {
            const stride = gait * side;
            if (seated > .02 || airborne) {
                thigh.rotation.x = -.95 * seated - .42 * airborne + side * .2 * airborne;
                knee.rotation.x = .18 * seated + .55 * airborne;
                foot.rotation.x = -thigh.rotation.x - knee.rotation.x;
            } else {
                // Two-bone IK keeps both round soles on the membrane during compression.
                const y = hipHeight - .074 - Math.max(0, stride) * .065;
                const z = stride * .11 + .048 * crouch;
                const d = Math.min(.339, Math.hypot(y, z));
                const bend = Math.acos(d / .34);
                const direction = -Math.atan2(z, y);
                thigh.rotation.x = direction - bend;
                knee.rotation.x = bend * 2;
                foot.rotation.x = -thigh.rotation.x - knee.rotation.x;
            }
            thigh.rotation.z = -side * airborne * .17;
        });
        arms.forEach(({ arm, elbow, side }) => {
            arm.rotation.set(-.2 + gait * side * .65 - seated * .45 - crouch * .5, 0, side * (.12 + airborne * 1.12));
            elbow.rotation.x = -.18 - airborne * .4 - seated * .35;
            if (pose === 'climb') arm.rotation.x = -.8 + gait * side * .65;
            if (pose === 'wave' && side === -1) { arm.rotation.z = -2.25; elbow.rotation.x = -.3 + Math.sin(phase * Math.PI * 4) * .25 * smooth(amount); }
        });
    }
    return { root, pose };
}

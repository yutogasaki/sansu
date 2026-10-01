import * as T from 'three';

interface Pop { object: T.Object3D; start: number }
interface Piece { mesh: T.Mesh; velocity: T.Vector3; start: number }
const COLORS = ['#f6c6d4', '#fff1b0', '#b9d9ef', '#cfe8b8'];

/** The "ポン！" of an opened bud: the new thing bounces up and petals scatter (§11.1). */
export class WorldEffects {
    private pops: Pop[] = [];
    private pieces: Piece[] = [];
    constructor(private readonly parent: T.Object3D) {}

    pop(object: T.Object3D, at: number, reduced: boolean) {
        this.pops.push({ object, start: at });
        if (!reduced) this.confetti(object.position, at);
    }

    /** Petals scattering from a point: an opened bud, or the festival's lanterns. */
    confetti(from: T.Vector3, at: number) {
        for (let i = 0; i < 14; i++) {
            const mesh = new T.Mesh(new T.PlaneGeometry(.07, .07), new T.MeshBasicMaterial({ color: COLORS[i % 4], side: T.DoubleSide, transparent: true }));
            mesh.position.copy(from).add(new T.Vector3(0, .5, 0));
            const a = i / 14 * Math.PI * 2;
            this.pieces.push({ mesh, start: at, velocity: new T.Vector3(Math.cos(a) * .0012, .0028 + (i % 3) * .0004, Math.sin(a) * .0012) });
            this.parent.add(mesh);
        }
    }

    /** A ふしぎの品 opens with a ring of polka dots spiralling out (Pokomoko's lineage). */
    burst(from: T.Vector3, at: number) {
        const colors = ['#e23b3b', '#ffd23f', '#3fb8e8', '#6ccf6b', '#f25c8a', '#9b6ae0'];
        for (let i = 0; i < 28; i++) {
            const mesh = new T.Mesh(new T.CircleGeometry(.05 + (i % 3) * .02, 12), new T.MeshBasicMaterial({ color: colors[i % colors.length], side: T.DoubleSide, transparent: true }));
            mesh.position.copy(from).add(new T.Vector3(0, .6, 0));
            const a = i / 28 * Math.PI * 4, speed = .0015 + (i % 4) * .0004;
            this.pieces.push({ mesh, start: at, velocity: new T.Vector3(Math.cos(a) * speed, .0032 + (i % 5) * .0003, Math.sin(a) * speed) });
            this.parent.add(mesh);
        }
    }

    tick(at: number, delta: number) {
        this.pops = this.pops.filter(({ object, start }) => {
            const t = Math.min(1, (at - start) / 650);
            // Ease out with a small overshoot, like something springing up from a bud.
            const scale = t < 1 ? .2 + .8 * (1 - Math.pow(1 - t, 3)) + Math.sin(t * Math.PI) * .18 : 1;
            object.scale.setScalar(scale);
            return t < 1;
        });
        this.pieces = this.pieces.filter(piece => {
            const age = at - piece.start;
            piece.velocity.y -= .0000055 * delta;
            piece.mesh.position.addScaledVector(piece.velocity, delta);
            piece.mesh.rotation.x += delta * .01; piece.mesh.rotation.y += delta * .007;
            (piece.mesh.material as T.MeshBasicMaterial).opacity = Math.max(0, 1 - age / 1200);
            if (age < 1200) return true;
            piece.mesh.removeFromParent(); piece.mesh.geometry.dispose(); (piece.mesh.material as T.Material).dispose();
            return false;
        });
    }

    dispose() {
        this.pieces.forEach(p => { p.mesh.removeFromParent(); p.mesh.geometry.dispose(); (p.mesh.material as T.Material).dispose(); });
        this.pieces = []; this.pops = [];
    }
}

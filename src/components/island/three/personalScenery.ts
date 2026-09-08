import * as THREE from 'three';
import { ISLAND_EMBLEMS, normalizeIslandExperienceName, type IslandEmblem, type IslandExperienceState } from '../../../domain/island/experience';
import type { IslandExpressionFlagTrimId } from '../../../domain/island/expression';
import { roundedBoxGeometry } from './geometry';
import { cylinder, ellipsoid, mesh, star } from './primitives';

export const ISLAND_PERSONAL_SCENERY_CANDIDATE = 'island-personal-scenery-v1';
const HOUSE = [-2.6, 0, -1.65] as const;
const LABEL_WIDTH = 1024, LABEL_HEIGHT = 384;

export interface IslandFlagView {
    root: THREE.Group;
    flag: THREE.Group;
    trim: THREE.Group;
    nameplate: THREE.Object3D;
    pole: THREE.Object3D;
}

/** A small nameplate on the existing house and one roof flag. Every solid part
 * remains inside the house's already-reserved footprint; none becomes a new navigation obstacle. */
export class IslandPersonalScenery {
    readonly group = new THREE.Group();
    private readonly emblems = new Map<IslandEmblem, THREE.Group>();
    private readonly materials = new Set<THREE.Material>();
    private canvas?: HTMLCanvasElement;
    private context?: CanvasRenderingContext2D;
    private label?: THREE.CanvasTexture;
    private name = '';
    private emblem?: IslandEmblem;
    private flagTrim: IslandExpressionFlagTrimId | null = null;
    private trim?: THREE.Group;
    private built = false;
    private disposed = false;

    constructor(private readonly makeCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')) {
        this.group.name = ISLAND_PERSONAL_SCENERY_CANDIDATE;
        this.group.position.set(...HOUSE);
        this.group.visible = false;
    }

    private material(color: string) {
        const material = new THREE.MeshStandardMaterial({ color, roughness: .9, metalness: 0 });
        this.materials.add(material);
        return material;
    }

    private build() {
        if (this.built) return;
        this.built = true;
        const wood = this.material('#d6a35b'), ink = this.material('#242750'), cream = this.material('#fff1ca');
        const gold = this.material('#ffc84a'), teal = this.material('#198c99');
        // Below the observatory's overhanging rim and in front of the candy house's wall trim.
        const plate = mesh(this.group, roundedBoxGeometry([1.42, .46, .06], .055), wood, [0, 1.05, .85]);
        plate.name = 'island-nameplate-frame';
        this.canvas = this.makeCanvas();
        this.canvas.width = LABEL_WIDTH; this.canvas.height = LABEL_HEIGHT;
        this.context = this.canvas.getContext('2d') ?? undefined;
        if (this.context) {
            this.label = new THREE.CanvasTexture(this.canvas);
            this.label.colorSpace = THREE.SRGBColorSpace;
            this.label.minFilter = THREE.LinearMipmapLinearFilter;
            this.label.magFilter = THREE.LinearFilter;
            this.label.generateMipmaps = true;
            const material = new THREE.MeshBasicMaterial({ map: this.label }); this.materials.add(material);
            mesh(this.group, new THREE.PlaneGeometry(1.31, .375), material, [0, 1.05, .883]).name = 'island-nameplate-text';
        }
        for (const x of [-.665, .665]) ellipsoid(this.group, ink, [x, 1.05, .883], [.021, .021, .013], 8);
        // Roof-mounted at the left slope. This clears ordinary, observatory and crystal roofs.
        cylinder(this.group, wood, [-.85, 2.365, .20], .021, 1.31, .018, 10).name = 'island-flag-pole';
        ellipsoid(this.group, gold, [-.85, 3.04, .20], [.039, .039, .039], 10);
        const flag = new THREE.Group(); flag.name = 'island-personal-flag'; flag.position.set(-.555, 2.77, .20); this.group.add(flag);
        const cloth = new THREE.PlaneGeometry(.56, .42, 10, 2), points = cloth.getAttribute('position');
        for (let i = 0; i < points.count; i++) points.setZ(i, .035 * Math.sin((points.getX(i) / .56 + .5) * Math.PI));
        cloth.computeVertexNormals();
        const flagMaterial = this.material('#315cc0'); flagMaterial.side = THREE.DoubleSide;
        mesh(flag, cloth, flagMaterial).name = 'island-flag-cloth';
        const top = new THREE.Group(); top.position.z = .043; flag.add(top);
        for (const id of ISLAND_EMBLEMS) {
            const emblem = new THREE.Group(); emblem.name = `island-emblem-${id}`; emblem.visible = false;
            top.add(emblem); this.emblems.set(id, emblem);
            if (id === 'star') star(emblem, gold, [0, 0, 0], .135);
            else if (id === 'leaf') {
                const leaf = new THREE.Shape(); leaf.moveTo(-.09, -.125);
                leaf.quadraticCurveTo(-.18, .095, .10, .145); leaf.quadraticCurveTo(.18, -.075, -.09, -.125);
                mesh(emblem, new THREE.ExtrudeGeometry(leaf, { depth: .015, bevelEnabled: false }), cream);
                const vein = cylinder(emblem, teal, [.002, .007, .025], .009, .23, .009, 6); vein.rotation.z = -.6;
            } else if (id === 'flower') {
                for (let i = 0; i < 5; i++) {
                    const angle = Math.PI / 2 + i * Math.PI * 2 / 5;
                    ellipsoid(emblem, cream, [Math.cos(angle) * .085, Math.sin(angle) * .085, .01], [.068, .066, .019], 10);
                }
                ellipsoid(emblem, gold, [0, 0, .034], [.056, .056, .022], 10);
            } else {
                for (const y of [-.06, .055]) {
                    const path = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => {
                        const x = -.17 + i * .0425; return new THREE.Vector3(x, y + Math.sin(i / 8 * Math.PI * 2) * .033, .018);
                    }));
                    mesh(emblem, new THREE.TubeGeometry(path, 24, .019, 6, false), cream);
                }
            }
        }
        // The same leaf bird hangs near the upper fly edge, above the mature
        // dormer and observatory dome, clear of every central emblem in photos.
        const trim = new THREE.Group(); trim.name = 'island-flag-leaf-bird-trim';
        trim.position.set(.275, .2, .06); trim.visible = false; flag.add(trim); this.trim = trim;
        const bird = new THREE.Shape(); bird.moveTo(-.035, -.08);
        bird.quadraticCurveTo(.018, .075, .12, .035); bird.quadraticCurveTo(.105, -.1, -.035, -.08);
        mesh(trim, new THREE.ExtrudeGeometry(bird, { depth: .024, bevelEnabled: false }), this.material('#b7d96d')).name = 'flag-trim-leaf-body';
        ellipsoid(trim, cream, [.125, .035, .014], [.048, .047, .027], 10).name = 'flag-trim-bird-head';
        const beak = new THREE.Shape(); beak.moveTo(.161, .045); beak.lineTo(.216, .024); beak.lineTo(.162, .005); beak.closePath();
        mesh(trim, new THREE.ExtrudeGeometry(beak, { depth: .023, bevelEnabled: false }), gold).name = 'flag-trim-bird-beak';
        ellipsoid(trim, ink, [.137, .047, .042], [.008, .008, .006], 8);
        const vein = cylinder(trim, teal, [.044, -.028, .033], .005, .108, .005, 6); vein.rotation.z = -.8;
        const thread = cylinder(trim, gold, [0, 0, 0], .006, .095, .006, 6); thread.name = 'flag-trim-thread';
        // Only the attachment transforms change: one end touches the actual
        // cloth edge; the other enters the original extruded leaf body.
        const threadDirection = new THREE.Vector3(.02, -.056, .074).normalize();
        thread.position.set(.005, .005, -.06).addScaledVector(threadDirection, .095 / 2);
        thread.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), threadDirection);
        this.group.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = false; });
    }

    private writeName(name: string) {
        if (!this.context || !this.label) return;
        const context = this.context, letters = [...name], lines = letters.length > 8 ? [letters.slice(0, 8).join(''), letters.slice(8).join('')] : [name];
        context.fillStyle = '#fff1ca'; context.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);
        context.fillStyle = '#242750'; context.textAlign = 'center'; context.textBaseline = 'middle';
        const setFont = (size: number) => { context.font = `700 ${size}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif`; };
        let size = lines.length === 1 ? 144 : 124; setFont(size);
        const measured = Math.max(...lines.map(line => context.measureText(line).width));
        if (measured > LABEL_WIDTH - 96) { size = Math.floor(size * (LABEL_WIDTH - 96) / measured); setFont(size); }
        lines.forEach((line, index) => context.fillText(line, LABEL_WIDTH / 2, lines.length === 1 ? 192 : 110 + index * 164, LABEL_WIDTH - 96));
        this.group.userData.nameLines = lines;
        this.label.needsUpdate = true;
    }

    /** Pass the raw optional saved state: old history without identity stays visually unchanged. No work occurs per frame. */
    update(experience?: IslandExperienceState, flagTrim: IslandExpressionFlagTrimId | null = null, inspectingFlag = false) {
        if (this.disposed) return false;
        if (flagTrim !== null && flagTrim !== 'leaf-bird-flag-trim') return false;
        const visible = Boolean(inspectingFlag || flagTrim || (experience && (experience.islandName !== 'わたしの しま' || experience.emblem !== 'leaf')));
        if (!visible) {
            const changed = this.group.visible; this.group.visible = false; this.flagTrim = null;
            if (this.trim) this.trim.visible = false;
            this.group.userData.flagTrim = null;
            return changed;
        }
        const name = normalizeIslandExperienceName(experience?.islandName ?? 'わたしの しま'), emblem = experience?.emblem ?? 'leaf';
        if (!ISLAND_EMBLEMS.includes(emblem)) return false;
        this.build();
        const changed = !this.group.visible || name !== this.name || emblem !== this.emblem || flagTrim !== this.flagTrim;
        this.group.visible = true;
        if (name !== this.name) { this.writeName(name); this.name = name; this.group.userData.islandName = name; }
        if (emblem !== this.emblem) {
            this.emblems.forEach((group, id) => { group.visible = id === emblem; });
            this.emblem = emblem; this.group.userData.emblem = emblem;
        }
        this.trim!.visible = flagTrim !== null; this.flagTrim = flagTrim; this.group.userData.flagTrim = flagTrim;
        return changed;
    }

    /** Borrow the actual identity objects; this getter neither builds nor changes visibility. */
    get flagView(): IslandFlagView | undefined {
        if (!this.built || this.disposed) return undefined;
        return { root: this.group, flag: this.group.getObjectByName('island-personal-flag') as THREE.Group,
            trim: this.trim!, nameplate: this.group.getObjectByName('island-nameplate-frame')!,
            pole: this.group.getObjectByName('island-flag-pole')! };
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.group.removeFromParent();
        const geometries = new Set<THREE.BufferGeometry>();
        this.group.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
        geometries.forEach(geometry => geometry.dispose());
        this.materials.forEach(material => material.dispose()); this.label?.dispose();
        this.group.clear(); this.emblems.clear(); this.materials.clear();
        this.canvas = undefined; this.context = undefined; this.label = undefined; this.trim = undefined;
    }
}

import * as T from 'three';
import { buildHomeJourney } from '../homeJourney/scene';
import { disposeGeometry } from '../three/primitives';
import type { Style } from '../../../domain/islandLife/model';
import { makeLearningExpression } from './expression';

// Same saved scarf colors as life/itemGeometry; keep the small actor chunk free
// of the complete island furniture builder.
export const learningScarfColor = (style: Style) => style === 'sunshine' ? '#f5bf60' : style === 'starlight' ? '#a998d8' : '#eb8f9e';

/** Reparent the original meshes without altering their shape, cloth or face. */
export function makeLearningActorRig() {
    const model = buildHomeJourney(undefined, { residentsOnly: true });
    const scarf = new T.Mesh(new T.TorusGeometry(.18, .047, 8, 32), model.m.surface(learningScarfColor('original'), .85));
    scarf.name = 'learning-hero-scarf';
    scarf.rotation.x = Math.PI / 2; scarf.position.y = .59; model.heroBody.add(scarf);
    const head = new T.Group();
    head.name = 'learning-hero-head'; head.position.y = .68;
    const headParts = model.heroBody.children.filter(part => part.position.y >= .7);
    model.heroBody.add(head);
    for (const part of headParts) { part.position.y -= head.position.y; head.add(part); }
    const expression = makeLearningExpression(head);

    const arms = [-1, 1].map(side => {
        const mesh = model.heroBody.children.find(part => Math.abs(part.position.x - side * .27) < .001 && part.position.y === .46);
        if (!mesh) throw new Error('Original Pokomoko shoulder is missing.');
        const pivot = new T.Group();
        pivot.position.set(side * .25, .58, .025);
        model.heroBody.add(pivot); model.hero.updateMatrixWorld(true); pivot.attach(mesh);
        const hand = new T.Object3D();
        // Contact is the outward/front surface of this original paw, not an
        // independent point stretched away from the arm.
        hand.position.set(side * .026, -.24, .07);
        pivot.add(hand);
        return { pivot, hand };
    });
    const scene = new T.Scene();
    scene.add(model.hero);
    scene.add(new T.HemisphereLight('#fff7e8', '#788ca2', 2.4));
    const key = new T.DirectionalLight('#fff7e8', 3.1);
    key.position.set(-3, 6, 5); scene.add(key);
    const camera = new T.OrthographicCamera(-.78, .78, .82, -.82, .1, 20);
    camera.position.set(0, .88, 4); camera.lookAt(0, .67, 0); camera.updateMatrixWorld(true);
    return {
        ...model, head, arms, scarf, expression, scene, camera,
        dispose: () => {
            // hero was moved out of world so both roots own geometry to free.
            disposeGeometry(model.hero); model.dispose();
        },
    };
}

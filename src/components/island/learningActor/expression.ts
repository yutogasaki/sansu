import * as T from 'three';

/** Happy eyes and a broader smile are temporary facial acting. The original
 * eyes, highlights, muzzle and mouth remain unchanged and return exactly. */
export function makeLearningExpression(head: T.Group) {
    const eyes = head.children.filter(part => part instanceof T.Mesh && Math.abs(part.position.x) > .05
        && Math.abs(part.position.x) < .14 && part.position.y > .21 && part.position.y < .24 && part.position.z > .24) as T.Mesh[];
    const mouth = head.children.find(part => part instanceof T.Mesh && part.geometry.type === 'TorusGeometry') as T.Mesh | undefined;
    if (eyes.length !== 4 || !mouth) throw new Error('Original Pokomoko face changed; review expression anchors.');
    const eye = eyes.find(part => part.position.y < .23)!;
    const happy = new T.Group(); happy.name = 'learning-happy-face'; happy.visible = false; head.add(happy);
    for (const side of [-1, 1]) {
        const arc = new T.CatmullRomCurve3([
            new T.Vector3(side * .12 - .043, .216, .276),
            new T.Vector3(side * .12, .242, .280),
            new T.Vector3(side * .12 + .043, .216, .276),
        ]);
        const lid = new T.Mesh(new T.TubeGeometry(arc, 12, .011, 8, false), eye.material);
        lid.name = `learning-happy-eye-${side}`; happy.add(lid);
    }
    const smile = new T.Shape();
    smile.moveTo(-.075, .075);
    smile.quadraticCurveTo(0, .059, .075, .075);
    smile.quadraticCurveTo(0, -.005, -.075, .075);
    const grin = new T.Mesh(new T.ShapeGeometry(smile, 16), mouth.material);
    grin.position.z = .329; grin.name = 'learning-happy-smile'; happy.add(grin);
    return {
        happy,
        neutral: [...eyes, mouth],
        set(value: boolean) {
            happy.visible = value;
            for (const part of eyes) part.visible = !value;
            mouth.visible = !value;
        },
    };
}

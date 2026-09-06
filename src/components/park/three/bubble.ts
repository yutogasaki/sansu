import * as THREE from 'three';
import { TOY, type ToyFrame } from './choreography';
import { ToyPrimitives } from './materials';

export function createBubble(p: ToyPrimitives) {
    const root = new THREE.Group(); root.name = 'soap-film';
    // Fresnel-only color: center alpha < .012, no transmission render target or milky glass.
    const film = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.FrontSide,
        uniforms: {},
        vertexShader: `varying vec3 vNormal; varying vec3 vPosition;
            void main(){ vec4 v = modelViewMatrix * vec4(position,1.); vNormal=normalize(normalMatrix*normal); vPosition=v.xyz; gl_Position=projectionMatrix*v; }`,
        fragmentShader: `varying vec3 vNormal; varying vec3 vPosition;
            void main(){ float rim=pow(1.-abs(dot(normalize(vNormal),normalize(-vPosition))),3.);
                vec3 color=mix(vec3(.64,.79,.85),vec3(.88,.70,.81),smoothstep(-.4,.6,vNormal.x));
                gl_FragColor=vec4(color,.009+rim*.38);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`,
    });
    const sphere = p.mesh(root, p.keep(new THREE.SphereGeometry(TOY.bubbleRadius, 40, 28)), film, [0, 0, 0]); sphere.castShadow = sphere.receiveShadow = false; sphere.renderOrder = 4;
    const glint = new THREE.MeshBasicMaterial({ color: '#fffefa', transparent: true, opacity: .7, depthWrite: false });
    const reflection = new THREE.Group(); root.add(reflection);
    for (const [start, end, radius, width] of [[1.8, 2.5, .681, .015], [-.75, -.4, .698, .009]]) {
        const points = Array.from({ length: 15 }, (_, i) => {
            const a = start + (end - start) * i / 14;
            return new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, .22);
        });
        const line = p.tube(reflection, glint, points, width); line.castShadow = line.receiveShadow = false; line.renderOrder = 5;
    }
    const popRoot = new THREE.Group(); popRoot.name = 'soap-pop';
    const popMaterial = new THREE.MeshBasicMaterial({ color: '#91bec6', transparent: true, opacity: .7, depthWrite: false });
    const drops = Array.from({ length: 8 }, () => { const d = p.ellipsoid(popRoot, popMaterial, [0, 0, 0], [.023, .05, .023]); d.castShadow = false; return d; });
    return { root, popRoot, materials: [film, glint, popMaterial], update(frame: ToyFrame, camera: THREE.Camera) {
        root.position.set(frame.point.x, frame.point.y + TOY.bubbleCenter, frame.point.z);
        root.visible = frame.bubble;
        reflection.quaternion.copy(camera.quaternion);
        popRoot.position.copy(root.position); popRoot.quaternion.copy(camera.quaternion);
        popRoot.visible = frame.pop > 0 && frame.pop < 1;
        popMaterial.opacity = (1 - frame.pop) * .75;
        drops.forEach((drop, i) => {
            const a = i / drops.length * Math.PI * 2, radius = .72 + frame.pop * .24;
            drop.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0); drop.rotation.z = a - Math.PI / 2;
        });
    } };
}

import * as T from 'three';
export const WATER_MAGIC_MS = 5000, WATER_RIPPLE_MS = 1200, WATER_RETRY_MS = 250;
import { WATER_RADIUS, validWaterPoint } from '../../../domain/islandLife/waterMagic';
export { WATER_RADIUS, validWaterPoint } from '../../../domain/islandLife/waterMagic';
/** One clipped surface, not a reflected sky or a second scene. The bowl's rim
 * continues to occlude it. Point coordinates are local x/z at the real water. */
export function buildWaterMagic() {
    const material = new T.ShaderMaterial({ transparent: true, depthWrite: false,
        uniforms: { elapsed: { value: 0 }, magical: { value: false }, reduced: { value: false }, touchPoint: { value: new T.Vector2() } },
        vertexShader: 'varying vec2 waterPoint; void main(){waterPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: `varying vec2 waterPoint; uniform float elapsed; uniform bool magical; uniform bool reduced; uniform vec2 touchPoint;
        void main(){
            vec2 p=vec2(waterPoint.x,-waterPoint.y);
            float duration=magical?5.0:1.2;
            float fade=1.0-smoothstep(duration-.6,duration,elapsed);
            float radius=reduced?.18:mod(elapsed*.23,.62);
            float ripple=(1.0-smoothstep(.005,.014,abs(length(p-touchPoint)-radius)))*fade;
            vec3 color=vec3(.035,.10,.23); float stars=0.0;
            for(int i=0;i<8;i++){
                float n=float(i),a=n*2.39996,r=.07+.21*fract(n*.618);
                vec2 q=p-vec2(cos(a),sin(a))*r;
                float cross=max(1.0-smoothstep(.002,.006,abs(q.x)),1.0-smoothstep(.002,.006,abs(q.y)));
                stars=max(stars,cross*(1.0-smoothstep(.008,.026,length(q))));
            }
            if(magical){color=mix(color,vec3(.98,.85,.44),stars);color=mix(color,vec3(.64,.93,.97),ripple*.8);gl_FragColor=vec4(color,fade);}
            else gl_FragColor=vec4(.82,1.0,.97,ripple*.9);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
        }` });
    const root = new T.Mesh(new T.CircleGeometry(WATER_RADIUS, 64), material);
    root.name = 'life-water-touch-surface'; root.rotation.x = -Math.PI / 2; root.position.y = .232; root.visible = false;
    return { root, sample(ms: number, magic: boolean, point: [number, number], reduced: boolean) {
        root.visible = validWaterPoint(point) && ms >= 0 && ms < (magic ? WATER_MAGIC_MS : WATER_RIPPLE_MS);
        material.uniforms.elapsed.value = Math.max(0, ms / 1000); material.uniforms.magical.value = magic;
        material.uniforms.reduced.value = reduced; material.uniforms.touchPoint.value.set(...point);
    }, dispose() { root.geometry.dispose(); material.dispose(); } };
}

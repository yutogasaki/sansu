import { placeHand, HERO_SEATED_CONTACT } from './contacts';
import { deliverySample } from './delivery';
import { residentSeatContactY } from '../three/residentRig';
import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { HOME_JOURNEY_CANDIDATE, homeJourneyView, type HomeJourneyState } from '../../../domain/island/homeJourney';
import { buildHomeJourney } from './scene';
import { growthDeliverySeconds, growthRevealScale, homeJourneyGrowthTarget } from './growthReveal';
import { createHomeJourneyInterior, type HomeJourneyRoomState } from './interior';
import type { IslandHomeHit } from '../three/learningKeepsakeScenery';

export default function HomeJourneyPreview({ state, growthAt, onGrowthShown, room, onHomeEnter, onHomeAction, photoRequestId, onPhoto, photographing = false }: {
    state?: HomeJourneyState; growthAt?: number; onGrowthShown?: () => void;
    room?: HomeJourneyRoomState; onHomeEnter?: () => void; onHomeAction?: (hit: IslandHomeHit) => void;
    photoRequestId?: string; onPhoto?: (requestId: string, frame?: string) => void;
    photographing?: boolean;
}) {
    const host = useRef<HTMLDivElement>(null), [failed, setFailed] = useState(false);
    const view = homeJourneyView(state);
    const answers = state?.answers;
    const [wide, setWide] = useState(false);
    const frameCamera = useRef<((wide: boolean) => void) | null>(null);
    const roomRef = useRef(room), actionRef = useRef(onHomeAction);
    const photoRef = useRef({ id: photoRequestId, consume: onPhoto });
    useEffect(() => { roomRef.current = room; actionRef.current = onHomeAction; photoRef.current = { id: photoRequestId, consume: onPhoto }; }, [room, onHomeAction, photoRequestId, onPhoto]);
    const growthAtRef = useRef(growthAt), onGrowthShownRef = useRef(onGrowthShown);
    useEffect(() => { growthAtRef.current=growthAt; onGrowthShownRef.current=onGrowthShown; }, [growthAt,onGrowthShown]);
    useEffect(() => {
        const node = host.current;
        if (!node) return;
        let renderer: T.WebGLRenderer;
        try { renderer = new T.WebGLRenderer({ antialias: true, alpha: false }); }
        catch { setFailed(true); return; }
        const content = buildHomeJourney(answers === undefined ? undefined : { version: 1, answers }), scene = new T.Scene(); scene.background = new T.Color('#72c9de');
        const house = content.world.getObjectByName('home')!;
        const interior = createHomeJourneyInterior(house);
        node.dataset.worldId = content.world.uuid;
        node.dataset.houseId = house.uuid;
        const revealAt = growthAtRef.current;
        const targetName = homeJourneyGrowthTarget(revealAt);
        const revealTarget = targetName ? content.world.getObjectByName(targetName) : undefined;
        const revealBaseScale = revealTarget?.scale.clone();
        scene.add(content.world, new T.HemisphereLight('#fff9e9', '#779480', 2));
        const sun = new T.DirectionalLight('#fff6de', 3); sun.position.set(-3, 8, 6); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024);
        sun.shadow.camera.left=-6; sun.shadow.camera.right=6; sun.shadow.camera.top=6; sun.shadow.camera.bottom=-6; sun.shadow.normalBias=.035; scene.add(sun);
        renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
        const camera = new T.OrthographicCamera(); camera.position.set(7, 10, 15); camera.lookAt(0, .5, 0);
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = T.SRGBColorSpace;
        node.appendChild(renderer.domElement);
        renderer.domElement.setAttribute('aria-label', 'ぽこもこの家と庭。学習でひさし、テラス、店が育つ開発用の模型');
        renderer.domElement.setAttribute('role', 'img');
        let wholeIsland = false;
        const resize = () => {
            const width = node.clientWidth, height = node.clientHeight, aspect = width / Math.max(1, height);
            if (wholeIsland) {
                camera.position.set(7,10,15); camera.lookAt(0,.5,0);
                const halfWidth=Math.max(4.85,5.7*aspect);
                camera.left=-halfWidth; camera.right=halfWidth; camera.top=halfWidth/aspect; camera.bottom=-camera.top;
            } else {
                camera.position.set(3.6,5.4,11); camera.lookAt(.25,.8,.25);
                const halfWidth=Math.max(3.05,3.2*aspect);
                camera.left=-halfWidth; camera.right=halfWidth; camera.top=halfWidth/aspect; camera.bottom=-camera.top;
            }
            node.dataset.cameraView=wholeIsland?'island':'home';
            if (roomRef.current) node.dataset.cameraView = 'room';
            interior.update(roomRef.current, aspect);
            camera.updateProjectionMatrix(); renderer.setSize(width, height);
        };
        frameCamera.current = (value) => { wholeIsland=value; resize(); };
        const observer = new ResizeObserver(resize); observer.observe(node); resize();
        const media = matchMedia('(prefers-reduced-motion: reduce)');
        let elapsed = 0, last = performance.now(), frame = 0, disposed = false, growthReported = false;
        let capturedPhoto: string | undefined;
        const tap = (event: PointerEvent) => {
            if (!roomRef.current || !actionRef.current) return;
            const rect = renderer.domElement.getBoundingClientRect();
            const ray = new T.Raycaster();
            ray.setFromCamera(new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), interior.camera);
            const hit = interior.room.selectHit(ray.ray);
            if (hit) actionRef.current(hit);
        };
        renderer.domElement.addEventListener('pointerup', tap);
        const animate = (now: number) => {
            if (disposed) return;
            const dt = Math.max(0, Math.min(50, now - last)); last = now;
            if (!document.hidden) {
                if (!roomRef.current) elapsed += dt;
                const { hero, heroBody, heroFeet, rabbit, otter, parcel, view: v } = content;
                hero.scale.setScalar(1);
                const t = media.matches ? 12 : (elapsed / 1000) % 35;
                hero.position.set(-.55, 0, 1.25); rabbit.pose.position.set(.5, 0, 1.6);
                rabbit.body.position.y = 0; heroBody.position.y = 0; hero.rotation.set(0, .42, 0);
                heroFeet.forEach(foot => { foot.rotation.x=0; foot.position.z=.09; });
                rabbit.shoulders.forEach(s => { s.rotation.z = 0; });
                parcel.visible = otter.pose.visible = v.shop === 2;
                if (v.home >= 3) {
                    hero.position.set(.15, .4 - HERO_SEATED_CONTACT, .12); rabbit.pose.position.set(1.05, .4 - .7 * residentSeatContactY('rabbit'), .12);
                    heroBody.position.y=-.07; rabbit.body.position.y=-.08;
                    heroFeet.forEach(foot => { foot.rotation.x=-.7; foot.position.z=.2; });
                    hero.rotation.y = .6; rabbit.pose.rotation.y = -.6;
                } else if (v.bench >= 2 && t > 8) {
                    hero.position.set(2.22, .51 - HERO_SEATED_CONTACT, 1.22); rabbit.pose.position.set(2.8, .51 - .7 * residentSeatContactY('rabbit'), 1.22);
                    heroBody.position.y=-.07; rabbit.body.position.y=-.08;
                    heroFeet.forEach(foot => { foot.rotation.x=-.7; foot.position.z=.2; });
                } else if (v.home >= 2 && t < 6) {
                    rabbit.shoulders[0].rotation.z = -.8 + (media.matches ? 0 : Math.sin(t * 3) * .15);
                }
                if (v.shop === 2) {
                    const seconds = growthDeliverySeconds(elapsed,revealAt);
                    const sample = deliverySample(seconds, media.matches);
                    if (sample.t >= 9 && sample.t < 16) {
                        hero.position.x = -.28;
                        rabbit.pose.position.x = .16;
                        hero.rotation.y = .82;
                        rabbit.pose.rotation.y = .45;
                    }
                    otter.pose.position.set(...sample.position);
                    otter.pose.rotation.y = sample.heading;
                    otter.shoulders.forEach(shoulder => { shoulder.scale.setScalar(1); shoulder.rotation.set(sample.t<12 ? -1.1 : 0,0,0); });
                    otter.feet.forEach((foot,i)=> { foot.rotation.x = !media.matches && sample.walking ? Math.sin(sample.t*8+i*Math.PI)*.22 : 0; });
                    content.world.updateMatrixWorld(true);
                    const left=otter.handContacts[0].getWorldPosition(new T.Vector3());
                    const right=otter.handContacts[1].getWorldPosition(new T.Vector3());
                    const held=left.add(right).multiplyScalar(.5);
                    const table=new T.Vector3(.6,.91,.3);
                    parcel.position.copy(sample.t<12 ? held.lerp(table,sample.placing) : table);
                    parcel.rotation.y = sample.t<12 ? sample.heading*(1-sample.placing) : 0;
                    if (sample.t < 12) {
                        const side = new T.Vector3(.15,0,0).applyAxisAngle(new T.Vector3(0,1,0),parcel.rotation.y);
                        placeHand(otter.shoulders[0],otter.handContacts[0],parcel.position.clone().sub(side));
                        placeHand(otter.shoulders[1],otter.handContacts[1],parcel.position.clone().add(side));
                    }
                    node.dataset.activity=sample.phase;
                    node.dataset.deliveryTime=sample.t.toFixed(2);
                    node.dataset.parcelPosition=parcel.position.toArray().join(',');
                } else node.dataset.activity = v.home >= 3 ? 'tea' : v.bench >= 2 ? 'rest' : v.home >= 2 ? 'greet' : 'garden';
                if (revealTarget && revealBaseScale) {
                    const revealSeconds=elapsed/1000, scale=growthRevealScale(revealSeconds,media.matches);
                    revealTarget.scale.copy(revealBaseScale).multiplyScalar(scale);
                    if (!media.matches && revealSeconds < 1.6) hero.position.y += Math.sin(Math.PI * Math.min(1,revealSeconds/1.6)) * .09;
                    node.dataset.growthAt=String(revealAt);
                    node.dataset.growthPhase=media.matches || revealSeconds >= 1.6 ? 'settled' : 'revealing';
                }
                if (roomRef.current) {
                    hero.scale.setScalar(.35);
                    hero.position.copy(interior.room.group.localToWorld(new T.Vector3(-2.13, .76, 2.1)));
                    hero.position.y -= HERO_SEATED_CONTACT * .35;
                    hero.rotation.set(0, .2, 0);
                    heroBody.position.y = -.07;
                    heroFeet.forEach(foot => { foot.rotation.x = -.7; foot.position.z = .2; });
                }
                renderer.render(scene, roomRef.current ? interior.camera : camera);
                node.dataset.rendered = 'true';
                // Consume only after a real exterior frame. The local animation
                // finishes independently; an early exit cannot re-arm it.
                if (revealTarget && !roomRef.current && !growthReported) {
                    growthReported = true; onGrowthShownRef.current?.();
                }
                const photo = photoRef.current;
                if (photo.id && photo.id !== capturedPhoto && photo.consume) {
                    capturedPhoto = photo.id;
                    let frame: string | undefined;
                    try { frame = renderer.domElement.toDataURL('image/png'); } catch { /* Existing photo UI handles capture failure. */ }
                    photo.consume(photo.id, frame);
                }
            }
            frame = requestAnimationFrame(animate);
        };
        const lost = (event: Event) => { event.preventDefault(); setFailed(true); };
        renderer.domElement.addEventListener('webglcontextlost', lost);
        frame = requestAnimationFrame(animate);
        return () => { disposed = true; frameCamera.current=null; cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener('pointerup', tap); renderer.domElement.removeEventListener('webglcontextlost', lost); interior.dispose(); renderer.dispose(); content.dispose(); renderer.domElement.remove(); };
    }, [answers]);
    useEffect(() => { frameCamera.current?.(wide || photographing); }, [wide, answers, room, photographing]);
    return <section data-home-journey={HOME_JOURNEY_CANDIDATE} data-home-answers={view.answers} style={{ background: '#f4f1e6', borderRadius: 20, overflow: 'hidden' }}>
        <p style={{ margin: '10px 16px', fontSize: 12 }}>開発用：家と庭・室内を接続。工作・きせかえ・過去の景色は従来の島です。</p>
        {!room && !photographing && <div role="group" aria-label="景色の切り替え" style={{display:'flex',gap:8,padding:'0 16px 8px',flexWrap:'wrap'}}>
            <button type="button" className="island-text-button" aria-pressed={!wide} onClick={()=>setWide(false)} style={{minHeight:44}}>家の近く</button>
            <button type="button" className="island-text-button" aria-pressed={wide} onClick={()=>setWide(true)} style={{minHeight:44}}>島全体</button>
            {onHomeEnter && <button type="button" className="island-text-button" onClick={onHomeEnter} style={{minHeight:44}}>いえに はいる</button>}
        </div>}
        <div ref={host} style={{ width: '100%', height: room ? 'min(38vh, 380px)' : 'min(55vh, 540px)' }} />
        {growthAt && <p role="status" className="sr-only">{view.latest?.title}</p>}
        {failed && <p role="status">景色を表示できません。学習は下のボタンから続けられます。</p>}
        {!room && <p style={{ padding: '0 16px 12px' }}>{view.latest?.title ?? 'ぽこもこの おうち'}<br />
            {view.next ? `つぎは「${view.next.title}」・あと ${view.next.at - view.answers}問分` : 'テラスと おみせが できたよ。学習は つづけられるよ。'}</p>}
    </section>;
}

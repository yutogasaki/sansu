import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import GrowingWorld, { type WorldCamera } from '../../components/island/growing/GrowingWorld';
import { applyIntent } from '../../domain/growingIsland/commands';
import { derivePlaces } from '../../domain/growingIsland/places';
import { placePlay } from '../../domain/growingIsland/placePlay';
import { noteFor, playNote, stopNotes } from '../../components/island/growing/notes';
import { experienceFixture, experienceLayouts } from './experienceFixture';
import type { Command, GrowingState } from '../../domain/growingIsland/types';
import './expansion.css';
import './experience.css';

export function Compare() {
    const [id, setId] = useState(experienceLayouts[0].id);
    const [islands, setIslands] = useState<Record<string, GrowingState>>(() => Object.fromEntries(experienceLayouts.map(layout => [layout.id, experienceFixture(layout.id)])));
    const islandsRef = useRef(islands);
    const [target, setTarget] = useState('T1'), [moving, setMoving] = useState(false), [turn, setTurn] = useState(0);
    const [line, setLine] = useState('木や水を選んで、ぽこもこと さわってみよう'), [stage, setStage] = useState('scene');
    const [sound, setSound] = useState(false), [time, setTime] = useState<'day' | 'dusk'>('day');
    const [concert, setConcert] = useState<{ cell: { x: number; z: number }; n: number }>();
    const camera = useRef<WorldCamera | undefined>(undefined);
    const state = islands[id], layout = experienceLayouts.find(item => item.id === id)!;
    const objects = [...state.landmarks, ...state.plots], selected = objects.find(owner => owner.id === target);
    const places = derivePlaces(state), families = [...new Set(places.filter(place => place.stage === 'grown' || place.stage === 'lived').map(place => place.family))];
    const act = (command: Command) => {
        try {
            const previous = islandsRef.current;
            const next = applyIntent(previous[id], { id: crypto.randomUUID(), command }, Date.now()).state;
            islandsRef.current = { ...previous, [id]: next }; setIslands(islandsRef.current);
            return true;
        } catch (error) { setLine(error instanceof Error ? error.message : '置ける場所をえらんでね'); return false; }
    };
    useEffect(() => {
        const stop = () => { if (document.visibilityState !== 'visible') { stopNotes(); setConcert(undefined); } };
        document.addEventListener('visibilitychange', stop);
        return () => { document.removeEventListener('visibilitychange', stop); stopNotes(); };
    }, [id]);
    const select = (next?: string) => { if (next) { setTarget(next); setMoving(false); } };
    return <div className="expansion-showcase experience-compare" data-experience-layout={id} data-build-revision={__BUILD_REVISION__}>
        <header><div><p>配置で変わる遊び · 実3D</p><h1>{layout.name}</h1><span>同じ38個・96マス・4人から、ちがう暮らしへ。</span></div><a href="/">島にもどる</a></header>
        <nav aria-label="同素材の3つの島">{experienceLayouts.map(item => <button key={item.id} aria-pressed={id === item.id} onClick={() => {
            if (id === item.id) return; stopNotes(); setId(item.id); setConcert(undefined); setMoving(false); setStage('scene');
        }}>{item.name}</button>)}</nav>
        <main><GrowingWorld key={id} state={state} time={time} playActive={!moving} turn={turn} cheer={0} festival={0} concert={concert} onCamera={value => { camera.current = value; }}
            onCell={cell => { if (moving && selected && act({ type: selected.cell ? 'move' : 'unstore', id: target, cell })) { setMoving(false); setConcert(undefined); stopNotes(); setLine('配置を変えたよ。もういちど さわってみよう'); } }}
            onSelect={select} onOpen={() => {}} onDisembark={() => {}} onStage={setStage} onFailure={setLine}
            onActorTap={(actorId, playing) => { if (playing && sound) { const species = actorId === 'pokomoko' ? 'pokomoko' : state.villagers.find(friend => friend.id === actorId)?.species; if (species) playNote(noteFor(species)); } }}
            onPlayStopped={stopNotes}
            onPlaceReplyStep={(kind, index) => { if (sound && kind === 'leaves') playNote(3 + index % 5); }}
            onPlaceReply={(kind, count) => setLine(kind === 'water' ? `${count}か所の水面に 波が返ったよ` : kind === 'leaves' ? `${count}本の木から 返事がきたよ` : '花から 返事がきたよ')}
            onSharedPlay={receipt => act({ type: 'shared-play', profileId: state.seed, expectedRevision: 0, ...receipt })} />
            {stage !== 'ready' && <p className="expansion-status" role="status">{stage === 'failed' ? '表示を読み直してください' : '島を描いています…'}</p>}
            <div className="expansion-controls"><button aria-label="左へ回す" onClick={() => setTurn(turn - 1)}>↶</button><button onClick={() => camera.current?.distance(false)}>全景</button><button aria-label="右へ回す" onClick={() => setTurn(turn + 1)}>↷</button>
                <button aria-pressed={time === 'dusk'} onClick={() => setTime(time === 'day' ? 'dusk' : 'day')}>夕の光</button>
                <button aria-pressed={sound} onClick={() => { if (sound) stopNotes(); setSound(!sound); }}>音 {sound ? 'あり' : 'なし'}</button></div>
        </main>
        <section className="experience-tools" aria-label="配置して遊ぶ"><label>選ぶ <select aria-label="置いたもの" value={target} onChange={event => select(event.target.value)}>{objects.map(owner => <option key={owner.id} value={owner.id}>{owner.id} · {owner.kind}{owner.cell ? '' : '（もちもの）'}</option>)}</select></label>
            <button disabled={!placePlay(state, target)} onClick={() => { setConcert(undefined); stopNotes(); setLine(camera.current?.interact(target) ? 'ぽこもこが 近くへいくよ' : 'とどく すきまを あけてみよう'); }}>さわってみる</button>
            <button disabled={!selected} aria-pressed={moving} onClick={() => { setConcert(undefined); stopNotes(); setMoving(!moving); setLine('島の空いた場所を さわってね'); }}>{selected?.cell ? 'うごかす' : '島へもどす'}</button>
            <button disabled={!selected?.cell} onClick={() => { if (act({ type: 'store', id: target })) { setConcert(undefined); stopNotes(); } }}>しまう</button>
            <button onClick={() => { const stand = state.landmarks.find(owner => owner.kind === 'bandstand' && owner.cell); if (stand?.cell) { setConcert({ cell: stand.cell, n: Date.now() }); setLine('近くへ来た ぽこもこと なかまを 順にさわってね'); } }}>おとで おはなし</button>
            <button onClick={() => { stopNotes(); setConcert(undefined); setMoving(false); islandsRef.current = { ...islandsRef.current, [id]: experienceFixture(id) }; setIslands(islandsRef.current); }}>この島を最初の配置へ</button>
            <p role="status">{line}</p><p>育った場所：{families.map(family => ({ grove: '森', spring: '水辺', flowers: '花庭', community: '集落' })[family]).join('・')} ／ 共同の思い出 {state.experience?.shared.length ?? 0}件</p>
        </section>
        <footer>開発用の比較。本人の保存へ書き込まず、移動・収納は本体の規則で動きます。取得・成熟・子どもの理解の検証は別です。</footer>
    </div>;
}
const root = createRoot(document.getElementById('app')!);
if (import.meta.env.DEV) root.render(<Compare />);
else root.render(<p>この比較は開発環境で開いてください。</p>);

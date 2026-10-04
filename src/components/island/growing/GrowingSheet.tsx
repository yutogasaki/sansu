import { useState } from 'react';
import { occupantsOf } from '../../../domain/growingIsland/community';
import { FLAG_PATTERNS, HATS, islandLevel, keepsakeKind, STYLE_LEVEL } from '../../../domain/growingIsland';
import type { GrowingState } from '../../../domain/growingIsland';
import { ACCENT_COLORS } from './actors';
import { FLAG_COLORS } from './keepsakeGeometry';
import { KEEPSAKE_NAME } from './growingCopy';
import { CHARACTER_NAME, HOME_STAGE, kindName, LANDMARK_LABEL, SEED_LABEL, villagerName } from './growingCopy';
import { ROOF_COLORS, WONDER_ROOFS } from './plotParts';

export type SheetAction = { type: 'move' } | { type: 'store' } | { type: 'pluck' } | { type: 'home' }
    | { type: 'paint'; color: number } | { type: 'name'; name: string } | { type: 'away'; away: boolean }
    | { type: 'flag'; color?: number; pattern?: number } | { type: 'dress'; color?: number; hat?: number };
const PATTERN_NAME = ['むじ', 'しま', 'みずたま', 'ほし', 'ハート'];
const HAT_NAME = ['いつもの', 'むぎわら', 'ベレー', 'はなかんむり', 'ニット', 'おうかん'];

const STYLE_NAME = { water: '水べの', tree: '木の', flower: '花の', light: 'あかりの', plain: 'まるい' } as const;
const TRAIT_NAME = { lively: 'げんき', mellow: 'のんびり', shy: 'はずかしがり', hungry: 'くいしんぼう' } as const;

/** What a tapped thing is, and the few things a child can do with it. */
export function GrowingSheet({ state, target, onAction, onClose }: {
    state: GrowingState; target: string; onAction: (action: SheetAction) => void; onClose: () => void;
}) {
    const [naming, setNaming] = useState(false), [name, setName] = useState('');
    const plot = state.plots.find(p => p.id === target), landmark = state.landmarks.find(l => l.id === target);
    const villager = state.villagers.find(v => `villager:${v.id}` === target);
    const keepsake = state.keepsakes.find(k => k.id === target), level = islandLevel(state);
    let title = '', detail = '';
    const actions: { label: string; action: SheetAction }[] = [];
    if (target === 'flag') { title = 'しまの はた'; detail = level >= STYLE_LEVEL.flagPattern ? 'いろと もようを えらべるよ' : 'いろを えらべるよ'; }
    else if (keepsake) {
        title = KEEPSAKE_NAME[keepsakeKind(keepsake.unitId)];
        detail = `${keepsake.unitId.startsWith('math') ? 'さんすう' : 'えいご'} Lv${keepsake.unitId.split(':')[1]}を みにつけた きねんだよ`;
        actions.push({ label: 'うごかす', action: { type: 'move' } }, { label: 'しまう', action: { type: 'store' } });
    } else if (target === 'house') { title = 'ぽこもこの いえ'; detail = 'なかに あそびかたの ほんが あるよ。まよったら ひらいてみよう'; actions.push({ label: 'いえに はいる', action: { type: 'home' } }); }
    else if (villager) {
        title = villagerName(villager);
        const home = state.plots.find(p => p.id === villager.home);
        detail = `${kindName(villager.species)}・${TRAIT_NAME[villager.trait]}${home ? `・${HOME_STAGE[home.stage]}に すんでいるよ` : '・ぽこもこの いえに いるよ'}`;
        actions.push({ label: villager.away ? 'しまに もどってきてもらう' : 'おでかけ してもらう', action: { type: 'away', away: !villager.away } });
    } else if (plot) {
        const people = occupantsOf(state, plot.id);
        title = plot.kind === 'home' ? `${plot.stage ? STYLE_NAME[plot.style ?? 'plain'] : ''}${HOME_STAGE[plot.stage]}` : SEED_LABEL[plot.kind].name;
        detail = plot.stage === 0 ? 'まなぶと しまの じかんが すすんで、そだつよ'
            : plot.kind === 'home' ? (people.length ? `${people.map(villagerName).join('、')}が すんでいるよ` : 'だれかが すみに くるかも')
                : plot.origin === 'spread' ? 'しぜんに ひろがった 花だよ' : 'しまが そだてたよ';
        actions.push({ label: 'うごかす', action: { type: 'move' } });
        if (!(plot.kind === 'home' && people.length)) actions.push({ label: plot.stage === 0 ? 'やめる（しずくが もどるよ）' : 'しまう', action: { type: 'store' } });
        if (plot.kind === 'wild' && plot.stage > 0) actions.push({ label: 'つむ', action: { type: 'pluck' } });
    } else if (landmark) {
        title = LANDMARK_LABEL[landmark.kind]?.name ?? '';
        detail = landmark.from ? `${landmark.from}が くれた おはなだよ` : CHARACTER_NAME[state.character];
        actions.push({ label: 'うごかす', action: { type: 'move' } }, { label: 'しまう', action: { type: 'store' } });
    } else return null;
    return <section className="growing-sheet" aria-label={title}>
        <header><div><strong>{title}</strong><p>{detail}</p></div><button className="growing-close" onClick={onClose} aria-label="とじる">×</button></header>
        {plot?.kind === 'home' && plot.stage > 0 && <div className="growing-swatches" aria-label="やねの いろ">
            {ROOF_COLORS.map((color, index) => <button key={color} style={{ background: color }} aria-label={`いろ ${index + 1}`}
                aria-pressed={(plot.roof ?? 0) === index} onClick={() => onAction({ type: 'paint', color: index })} />)}
            {WONDER_ROOFS.map((kind, i) => <button key={kind} className={`growing-wonder growing-wonder-${kind}`} aria-label={`ふしぎな やね ${i + 1}`}
                aria-pressed={plot.roof === ROOF_COLORS.length + i} onClick={() => onAction({ type: 'paint', color: ROOF_COLORS.length + i })} />)}
        </div>}
        {target === 'flag' && <>
            <div className="growing-swatches" aria-label="はたの いろ">{FLAG_COLORS.map((color, index) => <button key={color} style={{ background: color }} aria-label={`いろ ${index + 1}`}
                aria-pressed={(state.flagColor ?? 0) === index} onClick={() => onAction({ type: 'flag', color: index })} />)}</div>
            {level >= STYLE_LEVEL.flagPattern && <div className="growing-row" aria-label="はたの もよう">{Array.from({ length: FLAG_PATTERNS }, (_, i) =>
                <button key={i} aria-pressed={(state.flagPattern ?? 0) === i} onClick={() => onAction({ type: 'flag', pattern: i })}>{PATTERN_NAME[i]}</button>)}</div>}
        </>}
        {villager && level >= STYLE_LEVEL.clothes && <div className="growing-swatches" aria-label="ふくの いろ">{ACCENT_COLORS.map((color, index) =>
            <button key={color} style={{ background: color }} aria-label={`ふくの いろ ${index + 1}`}
                aria-pressed={(villager.outfit?.color ?? villager.variant.color) === index} onClick={() => onAction({ type: 'dress', color: index })} />)}</div>}
        {villager && level >= STYLE_LEVEL.hats && <div className="growing-row" aria-label="ぼうし">{Array.from({ length: HATS + 1 }, (_, i) =>
            <button key={i} aria-pressed={(villager.outfit?.hat ?? 0) === i} onClick={() => onAction({ type: 'dress', hat: i })}>{HAT_NAME[i]}</button>)}</div>}
        {villager && villager.species !== 'girl' && villager.species !== 'boy' && (naming
            ? <form className="growing-name" onSubmit={event => { event.preventDefault(); if (name.trim()) { onAction({ type: 'name', name }); setNaming(false); } }}>
                <input value={name} maxLength={12} onChange={event => setName(event.target.value)} aria-label="なまえ" autoFocus />
                <button type="submit">きめる</button>
            </form>
            : <button className="growing-action" onClick={() => { setName(villager.name ?? ''); setNaming(true); }}>なまえを つける</button>)}
        <div className="growing-actions">
            {actions.map(({ label, action }) => <button key={label} className="growing-action" onClick={() => onAction(action)}>{label}</button>)}
        </div>
    </section>;
}

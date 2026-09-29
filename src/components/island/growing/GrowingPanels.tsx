import { useEffect, useState } from 'react';
import { likesOf } from '../../../domain/growingIsland';
import { wishLine } from './growingCopy';
import type { GrowingState, Like } from '../../../domain/growingIsland';
import type { MomentRecord } from '../../../domain/growingIsland/repository';
import { HOME_STAGE, kindName, villagerName } from './growingCopy';

const LIKE_NAME: Record<Like, string> = { flower: 'おはな', water: 'みず', tree: 'き', light: 'あかり', food: 'ごはん', play: 'あそび', farm: 'はたけ', quiet: 'しずかな ところ' };
const TRAIT_NAME = { lively: 'げんき', mellow: 'のんびり', shy: 'はずかしがり', hungry: 'くいしんぼう' } as const;

/** なかま (§12.2): faces, names, homes and favourites. Tapping someone brings the camera to them. */
export function FriendsPanel({ state, faces, onFocus, onClose }: { state: GrowingState; faces: Record<string, string>; onFocus: (id: string) => void; onClose: () => void }) {
    const people = [...state.villagers].sort((a, b) => a.arrivedAt - b.arrivedAt);
    return <section className="growing-tray growing-friends" aria-label="なかま">
        <header><strong>なかま {people.length}にん</strong><button className="growing-close" onClick={onClose} aria-label="とじる">×</button></header>
        {!people.length && <p>まだ だれも すんでいないよ。ふねの こに おうちを たててあげよう</p>}
        <ul>{people.map(v => {
            const home = state.plots.find(p => p.id === v.home);
            return <li key={v.id}><button onClick={() => onFocus(v.id)}>
                {faces[v.id] ? <img src={faces[v.id]} alt="" /> : <span className="growing-face" aria-hidden="true">{villagerName(v).slice(0, 1)}</span>}
                <span><strong>{villagerName(v)}</strong><small>{kindName(v.species)}・{TRAIT_NAME[v.trait]}・{home ? HOME_STAGE[home.stage] : 'ぽこもこの いえ'}{v.away ? '・おでかけ中' : ''}</small>
                    <small>すき：{likesOf(v).map(l => LIKE_NAME[l]).join('・')}</small><em>「{wishLine(state, v)}」</em></span>
            </button></li>;
        })}</ul>
    </section>;
}

export type ShowChoice = 'show' | 'card' | 'story' | 'visit';

export function ShowPanel({ onPick, onClose }: { onPick: (choice: ShowChoice) => void; onClose: () => void }) {
    return <section className="growing-tray" aria-label="みせる">
        <header><strong>しまを みせる</strong><button className="growing-close" onClick={onClose} aria-label="とじる">×</button></header>
        <div className="growing-grid growing-grid-seeds">
            <button className="growing-card" onClick={() => onPick('show')}><span className="growing-card-icon" aria-hidden="true">🎠</span><strong>みせる モード</strong><small>しまを ぐるっと みせるよ</small></button>
            <button className="growing-card" onClick={() => onPick('card')}><span className="growing-card-icon" aria-hidden="true">🖼️</span><strong>しまカード</strong><small>がぞうに して のこせるよ</small></button>
            <button className="growing-card" onClick={() => onPick('story')}><span className="growing-card-icon" aria-hidden="true">📖</span><strong>しまの あゆみ</strong><small>さいしょの ひから いままで</small></button>
            <button className="growing-card" onClick={() => onPick('visit')}><span className="growing-card-icon" aria-hidden="true">⛵</span><strong>きょうだいの しまへ</strong><small>みにいって おはなを おけるよ</small></button>
        </div>
    </section>;
}

export function CardView({ url, busy, onSave, onClose }: { url?: string; busy: boolean; onSave: () => void; onClose: () => void }) {
    return <div className="growing-overlay" role="dialog" aria-label="しまカード">
        <div className="growing-overlay-body">
            {url ? <img className="growing-card-image" src={url} alt="しまカード" /> : <p>カードを つくっているよ…</p>}
            <div className="growing-row"><button className="growing-primary" disabled={!url || busy} onClick={onSave}>ほぞんする</button><button onClick={onClose}>とじる</button></div>
        </div>
    </div>;
}

/** しまの あゆみ: every saved picture from the first day to today, in about ten seconds. */
export function StoryView({ moments, onClose }: { moments: MomentRecord[]; onClose: () => void }) {
    const [index, setIndex] = useState(0);
    const [urls] = useState(() => moments.map(m => URL.createObjectURL(m.image)));
    useEffect(() => () => urls.forEach(url => URL.revokeObjectURL(url)), [urls]);
    useEffect(() => {
        if (!urls.length) return;
        const step = Math.max(160, Math.min(1200, 10000 / urls.length));
        const id = window.setInterval(() => setIndex(i => Math.min(urls.length - 1, i + 1)), step);
        return () => clearInterval(id);
    }, [urls]);
    const first = moments[0]?.at ?? 0, at = moments[index]?.at ?? 0;
    const day = Math.floor((at - first) / 86_400_000) + 1;
    return <div className="growing-overlay" role="dialog" aria-label="しまの あゆみ">
        <div className="growing-overlay-body">
            {urls.length ? <>
                <img className="growing-story-image" src={urls[index]} alt={`${day}にちめの しま`} />
                <p className="growing-story-day">{day}にちめ</p>
                <div className="growing-row"><button onClick={() => setIndex(0)}>もういちど</button><button onClick={onClose}>とじる</button></div>
            </> : <><p>しまを ひらくたびに、しゃしんが ふえていくよ</p><div className="growing-row"><button onClick={onClose}>とじる</button></div></>}
        </div>
    </div>;
}

export function VisitPicker({ profiles, onVisit, onClose }: { profiles: { id: string; name: string }[]; onVisit: (id: string) => void; onClose: () => void }) {
    return <section className="growing-tray" aria-label="きょうだいの しまへ">
        <header><strong>だれの しまに いく？</strong><button className="growing-close" onClick={onClose} aria-label="とじる">×</button></header>
        {!profiles.length && <p>この たんまつには、ほかの しまが まだ ないよ</p>}
        <div className="growing-actions">{profiles.map(p => <button key={p.id} className="growing-action" onClick={() => onVisit(p.id)}>{p.name}の しま</button>)}</div>
    </section>;
}

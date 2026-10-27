import { useEffect, useRef, useState } from 'react';
import { Cloud, Cog, Droplets, Flower2, House, Leaf, Sailboat, Shell, Star, Trees, Waves, X } from 'lucide-react';
import { listVoyageIslands } from '../../../domain/growingIsland/repository';
import { FIRST_ISLAND, ISLAND_STARTS, isTheme, type IslandStart } from '../../../domain/growingIsland/voyages';
import { finaleLit, ROUTE_LEVELS, starsLit, starSubjects, slotForTheme, THEME_INFO, THEMES, freeSlots, type ThemeId } from '../../../domain/growingIsland/journey';
import type { GrowingState } from '../../../domain/growingIsland';
import './voyageChart.css';

type Props = { profileId: string; state: GrowingState; busy: boolean; onClose: () => void;
    onSail: (id: string, create?: { name: string; start: IslandStart }) => Promise<boolean>; onFocus: (id: string) => void };
type Island = Awaited<ReturnType<typeof listVoyageIslands>>[number];
const icons: Record<IslandStart, typeof Flower2> = { garden: Flower2, grove: Trees, water: Waves,
    shiokaze: Shell, kodama: Trees, hikari: Droplets, watagumo: Cloud, karakuri: Cog, hoshi: Star };
const startName = (start: IslandStart) => isTheme(start) ? THEME_INFO[start].name : ISLAND_STARTS[start].name;

/**
 * Where each island always sits on the chart (island-journey.md §3.2), in % of the map: the home
 * island in the middle, each special island by its nature, not by the order it is chosen.
 */
const HOME: [number, number] = [50, 52];
const PLACE: Record<ThemeId, [number, number]> = {
    shiokaze: [50, 87], kodama: [18, 60], hikari: [82, 60], watagumo: [22, 28], karakuri: [78, 29], hoshi: [50, 10],
};
/** Islands made before the special islands (花・森・水辺) sit around home as small isles. */
const NEAR: [number, number][] = [[31, 70], [69, 70], [32, 40], [68, 40]];
const SUBJECT_NAME = { math: 'さんすう', vocab: 'えいたんご', kokugo: 'こくご' } as const;

/** What still has to happen before a special island can be chosen: the very next condition only. */
function waitingFor(state: GrowingState, theme: ThemeId) {
    const opened = state.journey?.routes.length ?? 0;
    if (theme === 'shiokaze' || !opened) return 'なかまを むかえると';
    if (freeSlots(state).includes(0)) return 'しおかぜの小島の あとで';
    const next = ROUTE_LEVELS[opened - 1];
    return next ? `Lv${next}の ⛵で` : 'つぎの ⛵で';
}

export function SeaMap({ state, islands, locked, onSail, onChoose }: { state: GrowingState; islands: Island[]; locked: boolean;
    onSail: (id: string) => void; onChoose: (theme: ThemeId) => void }) {
    const home = islands.find(island => island.id === FIRST_ISLAND) ?? islands.find(island => !island.start);
    const madeOf = (theme: ThemeId) => islands.find(island => island.start === theme);
    const older = islands.filter(island => island !== home && !(island.start && isTheme(island.start)));
    const shining = finaleLit(state);
    const nodes = THEMES.map(theme => {
        const island = madeOf(theme), made = island || state.journey?.chosen.some(choice => choice.theme === theme);
        return { theme, island, at: PLACE[theme], mode: made ? 'made' as const : slotForTheme(state, theme) !== undefined ? 'open' as const : 'fog' as const };
    });
    // The finish joins the islands made in a ring around home, closed once there are three.
    const made = nodes.filter(node => node.mode === 'made').sort((a, b) =>
        Math.atan2(a.at[1] - HOME[1], a.at[0] - HOME[0]) - Math.atan2(b.at[1] - HOME[1], b.at[0] - HOME[0]));
    if (made.length >= 3) made.push(made[0]);
    const visit = (island: Island, label: string, at: [number, number], Icon: typeof Flower2, extra?: string, small = false) =>
        <button key={island.id} type="button" className={`voyage-island${island.active ? ' is-current' : ''}${small ? ' is-small' : ''}`} data-island={extra}
            style={{ left: `${at[0]}%`, top: `${at[1]}%` }} disabled={locked || island.active} onClick={() => onSail(island.id)}
            aria-label={`${island.name}${island.active ? '・いまここ' : 'へ ふねでいく'}`}>
            <span className="voyage-land" aria-hidden="true"><Icon size={small ? 18 : 24} /></span>
            <strong>{label}</strong><small>{island.active ? '⚑ いまここ' : extra === 'home' ? `なかま ${island.villagers}にん` : 'ふねで いく'}</small>
        </button>;
    return <div className="voyage-map" data-finale={shining || undefined}>
        <svg className="voyage-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {nodes.filter(node => node.mode !== 'fog').map(node =>
                <line key={node.theme} x1={HOME[0]} y1={HOME[1]} x2={node.at[0]} y2={node.at[1]} data-mode={node.mode} />)}
            {shining && made.map((node, i) => made[i + 1] &&
                <line key={`ring-${node.theme}`} className="voyage-ring" x1={node.at[0]} y1={node.at[1]} x2={made[i + 1].at[0]} y2={made[i + 1].at[1]} />)}
        </svg>
        {home && visit(home, home.name, HOME, House, 'home')}
        {older.slice(0, NEAR.length).map((island, i) => visit(island, island.name, NEAR[i], island.start ? icons[island.start] : Leaf, 'older', true))}
        {nodes.map(({ theme, island, at, mode }) => {
            const info = THEME_INFO[theme], Icon = icons[theme];
            if (island) return visit(island, info.name, at, Icon, theme);
            return <button key={theme} type="button" className="voyage-island" data-island={theme} data-mode={mode} style={{ left: `${at[0]}%`, top: `${at[1]}%` }}
                disabled={locked || mode !== 'open'} onClick={() => onChoose(theme)}
                aria-label={`${info.name}${mode === 'open' ? 'を つくって いく' : `・${waitingFor(state, theme)}`}`}>
                <span className="voyage-land" aria-hidden="true"><Icon size={24} /></span>
                <strong>{mode === 'fog' ? '？' : info.name}</strong>
                <small>{mode === 'open' ? 'えらべるよ' : waitingFor(state, theme)}</small>
            </button>;
        })}
    </div>;
}

/**
 * 海図の ほし (island-journey.md §3, §3.3): a star lights for each learning Lv the child confirmed
 * in any subject, with a small mark for every subject that reached it; the ship stars open routes.
 */
export function Stars({ state }: { state: GrowingState }) {
    const lit = starsLit(state), opened = state.journey?.routes.length ?? 0, next = opened ? ROUTE_LEVELS[opened - 1] : undefined;
    return <section className="voyage-special" aria-label="海図の ほし">
        <h3>まなびの ほし</h3>
        <ol className="voyage-stars" aria-label={`ともった ほし ${lit}こ`}>{Array.from({ length: 20 }, (_, i) => {
            const level = i + 1, ship = (ROUTE_LEVELS as readonly number[]).includes(level), by = starSubjects(state, level);
            return <li key={level} data-lit={level <= lit || undefined} data-ship={ship || undefined} data-finale={level === 20 || undefined}
                aria-label={`Lv${level}${ship ? '・こうろ' : ''}${level === 20 ? '・しあげ' : ''}${by.length ? `・${by.map(s => SUBJECT_NAME[s]).join('と ')}` : ''}`}>
                <span aria-hidden="true">{ship ? '⛵' : '★'}</span>
                {by.length > 0 && <i aria-hidden="true">{by.map(subject => <b key={subject} data-subject={subject} />)}</i>}
            </li>;
        })}</ol>
        <p className="voyage-legend" aria-hidden="true">{(Object.keys(SUBJECT_NAME) as (keyof typeof SUBJECT_NAME)[]).map(subject =>
            <span key={subject}><b data-subject={subject} />{SUBJECT_NAME[subject]}</span>)}</p>
        <p className="voyage-note">まなびで ないようを たしかめると ほしが ともるよ。{!opened ? 'はじめての なかまが くると、さいしょの こうろが ひらくよ'
            : next ? `Lv${next}の ⛵で つぎの こうろが ひらくよ` : finaleLit(state) ? 'しあげの ほしが ともって、しまの しるしが ひかっているよ' : 'ぜんぶの こうろが ひらいたよ。Lv20の ほしで しあげ'}</p>
    </section>;
}

export default function VoyageChart({ profileId, state, busy, onClose, onSail, onFocus }: Props) {
    const [islands, setIslands] = useState<Island[]>([]);
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(true), [sailing, setSailing] = useState(false), [retry, setRetry] = useState(0);
    const request = useRef<string | undefined>(undefined), dialog = useRef<HTMLElement>(null);
    const locked = busy || sailing;
    useEffect(() => { dialog.current?.focus(); }, []);
    useEffect(() => {
        let live = true;
        void listVoyageIslands(profileId).then(result => { if (live) { setIslands(result); setError(undefined); } })
            .catch(() => { if (live) setError('海図を ひらけなかったよ。もういちど ためしてね。'); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [profileId, retry]);
    const sail = async (id: string, create?: { name: string; start: IslandStart }) => {
        if (locked) return;
        setSailing(true);
        try { if (await onSail(id, create)) onClose(); else setError('出発できなかったよ。もういちど ためしてね。'); }
        finally { setSailing(false); }
    };
    const landmarks = [
        { id: 'house', name: 'ぽこもこの家', Icon: House },
        ...(['sapling', 'flower', 'water-bowl'] as const).flatMap(kind => {
            const owner = state.landmarks.find(item => item.kind === kind && item.cell);
            return owner ? [{ id: owner.id, name: kind === 'sapling' ? '木のところ' : kind === 'flower' ? '花のところ' : '水のところ', Icon: kind === 'sapling' ? Trees : kind === 'flower' ? Flower2 : Waves }] : [];
        }),
    ];
    const home = islands.find(island => island.id === FIRST_ISLAND) ?? islands.find(island => !island.start);
    // Older ordinary islands beyond the four places around home are listed under the map.
    const extra = islands.filter(island => island !== home && !(island.start && isTheme(island.start))).slice(NEAR.length);
    const free = freeSlots(state).length;
    return <section className="growing-overlay voyage-chart" role="dialog" aria-modal="true" aria-labelledby="voyage-title" tabIndex={-1} ref={dialog}
        onKeyDown={event => {
            if (event.key === 'Escape') { event.stopPropagation(); if (!locked) onClose(); }
            if (event.key === 'Tab') {
                const buttons = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')];
                const first = buttons[0], last = buttons[buttons.length - 1];
                if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        }}>
        <div className="growing-overlay-body voyage-body">
            <header><div><small>じぶんの島を めぐろう</small><h2 id="voyage-title"><Sailboat aria-hidden="true" />海図と ふね</h2></div><button aria-label="海図を とじる" disabled={locked} onClick={onClose}><X /></button></header>
            {free > 0 && <p className="voyage-open" role="status">こうろが ひらいているよ。ひかっている しまを えらんでね</p>}
            {error && <p role="alert">{error} <button disabled={locked} onClick={() => { setLoading(true); setRetry(n => n + 1); }}>よみなおす</button></p>}
            {loading ? <p role="status">海図を ひらいているよ…</p> : <>
                <SeaMap state={state} islands={islands} locked={locked || Boolean(error)} onSail={id => void sail(id)} onChoose={theme => {
                    request.current = crypto.randomUUID(); void sail(request.current, { name: THEME_INFO[theme].name, start: theme });
                }} />
                {extra.length > 0 && <div className="voyage-more" aria-label="ほかの しま">{extra.map(island =>
                    <button key={island.id} type="button" className={`voyage-island${island.active ? ' is-current' : ''}`} disabled={locked || island.active}
                        onClick={() => void sail(island.id)} aria-label={`${island.name}${island.active ? '・いまここ' : 'へ ふねでいく'}`}>
                        <strong>{island.name}</strong><small>{island.start ? startName(island.start) : ''}</small>
                    </button>)}</div>}
                <p className="voyage-note">しまの ばしょは いつも おなじ。きょりは みためだけだよ</p>
            </>}
            {!loading && <Stars state={state} />}
            <nav className="voyage-landmarks" aria-label="いまの島の めじるし"><h3>いまの島で みる</h3>{landmarks.map(({ id, name: title, Icon }) =>
                <button key={id} disabled={locked} onClick={() => { onFocus(id); onClose(); }}><Icon size={18} aria-hidden="true" />{title}</button>)}</nav>
            <div role="status" aria-live="polite">{sailing && 'ふねで 出発しているよ…'}</div>
        </div>
    </section>;
}

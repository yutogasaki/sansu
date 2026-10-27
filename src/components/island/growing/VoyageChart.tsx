import { useEffect, useRef, useState } from 'react';
import { Cloud, Cog, Droplets, Flower2, House, Leaf, Sailboat, Shell, Star, Trees, Waves, X } from 'lucide-react';
import { listVoyageIslands } from '../../../domain/growingIsland/repository';
import { FIRST_ISLAND, ISLAND_STARTS, isTheme, type IslandStart } from '../../../domain/growingIsland/voyages';
import { finaleLit, HOME_PLACE, nextIsland, placeOf, shoalStage, starsLit, starSubjects, THEME_INFO, type Place, type ThemeId } from '../../../domain/growingIsland/journey';
import type { GrowingState } from '../../../domain/growingIsland';
import './voyageChart.css';

type Props = { profileId: string; state: GrowingState; busy: boolean; onClose: () => void;
    onSail: (id: string, create?: { name: string; start: IslandStart }) => Promise<boolean>; onFocus: (id: string) => void };
type Island = Awaited<ReturnType<typeof listVoyageIslands>>[number];
const icons: Record<IslandStart, typeof Flower2> = { garden: Flower2, grove: Trees, water: Waves,
    shiokaze: Shell, kodama: Trees, hikari: Droplets, watagumo: Cloud, karakuri: Cog, hoshi: Star };
const startName = (start: IslandStart) => isTheme(start) ? THEME_INFO[start].name : ISLAND_STARTS[start].name;

/** Islands made before the special islands (花・森・水辺) sit around home as small isles. */
const NEAR: Place[] = [[-19, 18], [19, 18], [-18, -12], [18, -12]];
const SUBJECT_NAME = { math: 'さんすう', vocab: 'えいたんご', kokugo: 'こくご' } as const;
/** Fit every place into the chart with a margin, so any number of islands fits (island-journey.md §3.6). */
function fitter(places: Place[]) {
    const xs = places.map(p => p[0]), ys = places.map(p => p[1]);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 76);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    return (p: Place): [number, number] => [Math.round((50 + (p[0] - cx) / span * 76) * 10) / 10, Math.round((50 + (p[1] - cy) / span * 76) * 10) / 10];
}

/**
 * The chart (island-journey.md §3.2, §3.6): the islands the child made, where they really lie,
 * and a shoal once it began to grow. It never names an island before the child arrives there.
 */
export function SeaMap({ state, islands, locked, onSail, onCross }: { state: GrowingState; islands: Island[]; locked: boolean;
    onSail: (id: string) => void; onCross: (theme: ThemeId) => void }) {
    const home = islands.find(island => island.id === FIRST_ISLAND) ?? islands.find(island => !island.start);
    const older = islands.filter(island => island !== home && !(island.start && isTheme(island.start))).slice(0, NEAR.length);
    const shining = finaleLit(state), stage = shoalStage(state), shoal = state.journey?.shoal?.at, crossTo = nextIsland(state);
    const made = (state.journey?.chosen ?? []).map(choice => ({ theme: choice.theme, at: placeOf(state, choice.theme),
        island: islands.find(island => island.id === choice.islandId) ?? islands.find(island => island.start === choice.theme) }));
    const fit = fitter([HOME_PLACE, ...made.map(m => m.at), ...older.map((_, i) => [HOME_PLACE[0] + NEAR[i][0], HOME_PLACE[1] + NEAR[i][1]] as Place), ...(stage && shoal ? [shoal] : [])]);
    const HOME = fit(HOME_PLACE);
    // The finish joins the islands made in a ring around home, closed once there are three.
    const ring = made.map(m => ({ ...m, xy: fit(m.at) })).sort((a, b) => Math.atan2(a.xy[1] - HOME[1], a.xy[0] - HOME[0]) - Math.atan2(b.xy[1] - HOME[1], b.xy[0] - HOME[0]));
    if (ring.length >= 3) ring.push(ring[0]);
    const visit = (island: Island, label: string, at: [number, number], Icon: typeof Flower2, extra?: string, small = false) =>
        <button key={island.id} type="button" className={`voyage-island${island.active ? ' is-current' : ''}${small ? ' is-small' : ''}`} data-island={extra}
            style={{ left: `${at[0]}%`, top: `${at[1]}%` }} disabled={locked || island.active} onClick={() => onSail(island.id)}
            aria-label={`${island.name}${island.active ? '・いまここ' : 'へ ふねでいく'}`}>
            <span className="voyage-land" aria-hidden="true"><Icon size={small ? 18 : 24} /></span>
            <strong>{label}</strong><small>{island.active ? '⚑ いまここ' : extra === 'home' ? `なかま ${island.villagers}にん` : 'ふねで いく'}</small>
        </button>;
    return <div className="voyage-map" data-finale={shining || undefined}>
        <svg className="voyage-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {made.map(m => { const xy = fit(m.at); return <line key={m.theme} x1={HOME[0]} y1={HOME[1]} x2={xy[0]} y2={xy[1]} data-mode="made" />; })}
            {shining && ring.map((node, i) => ring[i + 1] &&
                <line key={`ring-${node.theme}`} className="voyage-ring" x1={node.xy[0]} y1={node.xy[1]} x2={ring[i + 1].xy[0]} y2={ring[i + 1].xy[1]} />)}
        </svg>
        {home && visit(home, home.name, HOME, House, 'home')}
        {older.map((island, i) => visit(island, island.name, fit([HOME_PLACE[0] + NEAR[i][0], HOME_PLACE[1] + NEAR[i][1]]), island.start ? icons[island.start] : Leaf, 'older', true))}
        {made.map(({ theme, at, island }) => island && visit(island, THEME_INFO[theme].name, fit(at), icons[theme], theme))}
        {stage && shoal && (() => {
            const xy = fit(shoal), ready = stage === 3 && crossTo;
            return <button type="button" className="voyage-island" data-island="shoal" data-stage={stage} style={{ left: `${xy[0]}%`, top: `${xy[1]}%` }}
                disabled={locked || !ready} onClick={() => crossTo && onCross(crossTo)}
                aria-label={ready ? 'きりの むこうへ わたる' : 'うみの いろが ちがう ところ'}>
                <span className="voyage-land" aria-hidden="true"><Waves size={20} /></span>
                <strong>？</strong>{ready && <small>わたってみる</small>}
            </button>;
        })()}
    </div>;
}

/**
 * 海図の ほし (island-journey.md §3, §3.3): a star lights for each learning Lv the child confirmed
 * in any subject, with a small mark for every subject that reached it. No star promises an island (§3.6).
 */
export function Stars({ state }: { state: GrowingState }) {
    const lit = starsLit(state);
    return <section className="voyage-special" aria-label="海図の ほし">
        <h3>まなびの ほし</h3>
        <ol className="voyage-stars" aria-label={`ともった ほし ${lit}こ`}>{Array.from({ length: 20 }, (_, i) => {
            const level = i + 1, by = starSubjects(state, level);
            return <li key={level} data-lit={level <= lit || undefined} data-finale={level === 20 || undefined}
                aria-label={`Lv${level}${level === 20 ? '・しあげ' : ''}${by.length ? `・${by.map(s => SUBJECT_NAME[s]).join('と ')}` : ''}`}>
                <span aria-hidden="true">★</span>
                {by.length > 0 && <i aria-hidden="true">{by.map(subject => <b key={subject} data-subject={subject} />)}</i>}
            </li>;
        })}</ol>
        <p className="voyage-legend" aria-hidden="true">{(Object.keys(SUBJECT_NAME) as (keyof typeof SUBJECT_NAME)[]).map(subject =>
            <span key={subject}><b data-subject={subject} />{SUBJECT_NAME[subject]}</span>)}</p>
        <p className="voyage-note">まなびで ないようを たしかめると ほしが ともるよ。{finaleLit(state) ? 'しあげの ほしが ともって、しまの しるしが ひかっているよ' : ''}</p>
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
    const ready = shoalStage(state) === 3 && Boolean(nextIsland(state));
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
            {ready && <p className="voyage-open" role="status">おきの きりの むこうに、なにかが そだったみたい</p>}
            {error && <p role="alert">{error} <button disabled={locked} onClick={() => { setLoading(true); setRetry(n => n + 1); }}>よみなおす</button></p>}
            {loading ? <p role="status">海図を ひらいているよ…</p> : <>
                <SeaMap state={state} islands={islands} locked={locked || Boolean(error)} onSail={id => void sail(id)} onCross={theme => {
                    request.current = crypto.randomUUID(); void sail(request.current, { name: THEME_INFO[theme].name, start: theme });
                }} />
                {extra.length > 0 && <div className="voyage-more" aria-label="ほかの しま">{extra.map(island =>
                    <button key={island.id} type="button" className={`voyage-island${island.active ? ' is-current' : ''}`} disabled={locked || island.active}
                        onClick={() => void sail(island.id)} aria-label={`${island.name}${island.active ? '・いまここ' : 'へ ふねでいく'}`}>
                        <strong>{island.name}</strong><small>{island.start ? startName(island.start) : ''}</small>
                    </button>)}</div>}
            </>}
            {!loading && <Stars state={state} />}
            <nav className="voyage-landmarks" aria-label="いまの島の めじるし"><h3>いまの島で みる</h3>{landmarks.map(({ id, name: title, Icon }) =>
                <button key={id} disabled={locked} onClick={() => { onFocus(id); onClose(); }}><Icon size={18} aria-hidden="true" />{title}</button>)}</nav>
            <div role="status" aria-live="polite">{sailing && 'ふねで 出発しているよ…'}</div>
        </div>
    </section>;
}

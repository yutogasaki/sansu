import { useEffect, useRef, useState } from 'react';
import { Anchor, Cloud, Cog, Droplets, Flower2, House, Leaf, Sailboat, Shell, Star, Trees, Waves, X } from 'lucide-react';
import { listVoyageIslands } from '../../../domain/growingIsland/repository';
import { ISLAND_STARTS, isTheme, type IslandStart } from '../../../domain/growingIsland/voyages';
import { ROUTE_LEVELS, starsLit, slotForTheme, THEME_INFO, THEMES, freeSlots, type ThemeId } from '../../../domain/growingIsland/journey';
import { landBounds } from '../../../domain/growingIsland/space';
import type { GrowingState } from '../../../domain/growingIsland';
import './voyageChart.css';

type Props = { profileId: string; state: GrowingState; busy: boolean; onClose: () => void;
    onSail: (id: string, create?: { name: string; start: IslandStart }) => Promise<boolean>; onFocus: (id: string) => void };
const icons: Record<IslandStart, typeof Flower2> = { garden: Flower2, grove: Trees, water: Waves,
    shiokaze: Shell, kodama: Trees, hikari: Droplets, watagumo: Cloud, karakuri: Cog, hoshi: Star };
const startName = (start: IslandStart) => isTheme(start) ? THEME_INFO[start].name : ISLAND_STARTS[start].name;

/**
 * 海図の ほし and the special islands (island-journey.md): a star lights for each learning Lv the
 * child confirmed in any subject; the ship stars open route slots, and an open slot becomes a
 * special island the child chooses. Choosing is never forced.
 */
function SpecialIslands({ state, locked, onChoose }: { state: GrowingState; locked: boolean; onChoose: (theme: ThemeId) => void }) {
    const lit = starsLit(state), free = freeSlots(state), next = ROUTE_LEVELS.find(level => level > lit);
    return <section className="voyage-special" aria-label="とくべつな しま">
        <h3>とくべつな しまへの こうろ</h3>
        <ol className="voyage-stars" aria-label={`ともった ほし ${lit}こ`}>{Array.from({ length: 20 }, (_, i) => {
            const level = i + 1, ship = (ROUTE_LEVELS as readonly number[]).includes(level);
            return <li key={level} data-lit={level <= lit || undefined} data-ship={ship || undefined} aria-label={`Lv${level}${ship ? '・こうろ' : ''}${level <= lit ? '・ともった' : ''}`}>{ship ? '⛵' : '★'}</li>;
        })}</ol>
        <p className="voyage-note">まなびで ないようを たしかめると ほしが ともるよ。{next ? `Lv${next}の ⛵で つぎの こうろが ひらくよ` : 'ぜんぶの こうろが ひらいたよ'}</p>
        {free.length > 0 && <p className="voyage-open" role="status">ひらいている こうろ {free.length}つ。いきたい しまを えらんでね</p>}
        <div className="voyage-themes">{THEMES.map(theme => {
            const info = THEME_INFO[theme], made = state.journey?.chosen.some(choice => choice.theme === theme), slot = slotForTheme(state, theme), Icon = icons[theme];
            return <button key={theme} type="button" className="voyage-theme" disabled={locked || made || slot === undefined} data-made={made || undefined}
                onClick={() => onChoose(theme)} aria-label={`${info.name}${made ? '・つくったよ' : slot === undefined ? '・まだ こうろが ないよ' : 'を つくって いく'}`}>
                <Icon aria-hidden="true" /><strong>{info.name}</strong><small>{info.mood}</small>
                <small>{made ? 'つくったよ' : slot === undefined ? theme === 'shiokaze' ? 'なかまを むかえると' : 'つぎの ⛵で' : 'えらべるよ'}</small>
            </button>;
        })}</div>
    </section>;
}

export default function VoyageChart({ profileId, state, busy, onClose, onSail, onFocus }: Props) {
    const [islands, setIslands] = useState<Awaited<ReturnType<typeof listVoyageIslands>>>([]);
    const [error, setError] = useState<string>(), [creating, setCreating] = useState(false);
    const [start, setStart] = useState<keyof typeof ISLAND_STARTS>('garden'), [name, setName] = useState('');
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
            <p className="voyage-intro">どの島も すきなだけ ひろげられるよ</p>
            {error && <p role="alert">{error} <button disabled={locked} onClick={() => { setLoading(true); setRetry(n => n + 1); }}>よみなおす</button></p>}
            {loading ? <p role="status">海図を ひらいているよ…</p> : <div className="voyage-sea" aria-label="じぶんの島">
                {islands.map(island => {
                    const bounds = landBounds({ land: island.land }), width = bounds.maxX - bounds.minX + 1;
                    const Icon = island.start ? icons[island.start] : Leaf;
                    return <button key={island.id} className={`voyage-island${island.active ? ' is-current' : ''}`} disabled={locked || island.active}
                        onClick={() => void sail(island.id)} aria-label={`${island.name}${island.active ? '・いまここ' : 'へ ふねでいく'}`}>
                        <span className="voyage-land" style={{ aspectRatio: `${width}/${bounds.depth}` }}><Icon size={30} aria-hidden="true" /></span>
                        <strong>{island.name}</strong>{island.start && isTheme(island.start) && <small>{startName(island.start)}</small>}<small>{island.active ? '⚑ いまここ' : 'ふねで いく'}</small>
                        <small>なかま {island.villagers}にん</small>
                    </button>;
                })}
            </div>}
            <p className="voyage-note">海図の大きさと きょりは めやすだよ</p>
            {!loading && <SpecialIslands state={state} locked={locked || Boolean(error)} onChoose={theme => {
                request.current = crypto.randomUUID(); void sail(request.current, { name: THEME_INFO[theme].name, start: theme });
            }} />}
            {creating ? <form className="voyage-create" onSubmit={event => {
                event.preventDefault(); request.current ??= crypto.randomUUID();
                void sail(request.current, { name: name.trim() || ISLAND_STARTS[start].name, start });
            }}>
                <h3>どんな はじまりにする？</h3>
                <div className="voyage-starts">{(Object.keys(ISLAND_STARTS) as (keyof typeof ISLAND_STARTS)[]).map(id => {
                    const Icon = icons[id]; return <button type="button" key={id} disabled={locked} aria-pressed={start === id} onClick={() => setStart(id)}>
                        <Icon aria-hidden="true" /><strong>{ISLAND_STARTS[id].name}</strong><small>{ISLAND_STARTS[id].hint}</small></button>;
                })}</div>
                <label>島の なまえ<input value={name} maxLength={12} placeholder={ISLAND_STARTS[start].name} disabled={locked} onChange={event => setName(event.target.value)} /></label>
                <p>あとから ちがう そだて方も できるよ。しずくは みんなの島で いっしょ。</p>
                <div className="growing-row"><button type="button" disabled={locked} onClick={() => setCreating(false)}>やめる</button><button className="growing-primary" type="submit" disabled={locked || loading}>{sailing ? '出発しているよ…' : '新しい島を つくっていく（無料）'}</button></div>
            </form> : <button className="voyage-new" disabled={locked || loading || Boolean(error)} onClick={() => { request.current = undefined; setCreating(true); }}><Anchor aria-hidden="true" />新しい島を つくる</button>}
            <nav className="voyage-landmarks" aria-label="いまの島の めじるし"><h3>いまの島で みる</h3>{landmarks.map(({ id, name: title, Icon }) =>
                <button key={id} disabled={locked} onClick={() => { onFocus(id); onClose(); }}><Icon size={18} aria-hidden="true" />{title}</button>)}</nav>
            <div role="status" aria-live="polite">{sailing && 'ふねで 出発しているよ…'}</div>
        </div>
    </section>;
}

import { useState } from 'react';
import { DISCOVERIES, type DiscoveryGroup } from '../../../domain/growingIsland/discoveries';
import { FINALE_LEVEL, finaleLit, freeSlots, ROUTE_LEVELS, SPECIES, THEME_INFO, THEMES, type SpeciesId } from '../../../domain/growingIsland/journey';
import { mechanismProgress } from '../../../domain/growingIsland/mechanisms';
import { achievementCatalog, starterStep } from '../../../domain/growingIsland/guidance';
import { FLOWER_COLORS, type GrowingState } from '../../../domain/growingIsland';
import { FLOWER_NAME, FLOWER_PAINT } from './flowerGeometry';
import { STARTER_COPY } from './useGrowingGuide';

type Page = 'next' | 'routes' | 'islands' | 'book' | 'firsts' | 'learn';
const PAGES: { id: Page; name: string }[] = [
    { id: 'next', name: 'つぎの たのしみ' }, { id: 'routes', name: 'こうろ' }, { id: 'islands', name: 'しま' },
    { id: 'book', name: 'ずかん' }, { id: 'firsts', name: 'はじめて・くらし' }, { id: 'learn', name: 'まなび' },
];
const SUBJECTS = [['math', 'さんすう'], ['vocab', 'えいたんご'], ['kokugo', 'こくご']] as const;
const SLOT_NAME = ['しおかぜの小島への こうろ', '2つめの こうろ', '3つめの こうろ', '4つめの こうろ', '5つめの こうろ', '6つめの こうろ'];

/** The one nearest thing to look forward to (island-journey.md §5). */
function nextJoy(state: GrowingState): { title: string; hint: string; chart?: boolean } {
    const step = starterStep(state);
    if (step === 'S1' || step === 'S2' || step === 'S3') return { title: STARTER_COPY[step].title, hint: STARTER_COPY[step].hint };
    if (freeSlots(state).length) return { title: 'こうろが ひらいているよ', hint: '海図で、いきたい しまを えらぼう', chart: true };
    const progress = mechanismProgress(state);
    if (progress && !progress.done) return { title: `${THEME_INFO[progress.theme].name}の しかけ`, hint: progress.next };
    const opened = state.journey?.routes.length ?? 0, level = ROUTE_LEVELS[opened - 1];
    if (opened && level) return { title: `${SLOT_NAME[opened]}まで あと すこし`, hint: `どれかの きょうかで、Lv${level}の ないようを たしかめよう` };
    if (opened === SLOT_NAME.length && !finaleLit(state)) return { title: 'しあげの ほしまで あと すこし', hint: `どれかの きょうかで、Lv${FINALE_LEVEL}の ないようを たしかめると、しまの しるしが ひかるよ` };
    return { title: 'しまを そだてよう', hint: 'おいた ものは、すこしずつ そだっていくよ' };
}

function Entries({ state, groups, mark, onAdopt, busy }: { state: GrowingState; groups: DiscoveryGroup[]; mark: string; onAdopt?: (species: SpeciesId) => void; busy?: boolean }) {
    const found = new Set(state.discoveries ?? []), here = new Set(state.keepsakes.map(k => k.unitId));
    return <div className="growing-grid">{DISCOVERIES.filter(d => groups.includes(d.group)).map(d => {
        const known = found.has(d.id), species = d.id.startsWith('species:') ? d.id.slice(8) as SpeciesId : undefined;
        const bring = known && species && (SPECIES as readonly string[]).includes(species) && !here.has(d.id) && onAdopt;
        return <div key={d.id} className="growing-card growing-flower-card" data-known={known ? 'true' : undefined} data-discovery={d.id}>
            <span className="growing-flower-dot growing-wonder-dot" aria-hidden="true" style={{ background: known ? mark : '#e8e2d6' }}>{known ? '★' : '?'}</span>
            <strong>{known ? d.name : 'まだ'}</strong>
            <small>{known ? d.line : d.hint}</small>
            {bring && <button type="button" className="growing-action" disabled={busy} onClick={() => onAdopt(species!)}>この しまにも つれてくる</button>}
        </div>;
    })}</div>;
}

/**
 * しまの きろく (island-journey.md §5): the child's one book. It opens on the one nearest thing
 * to look forward to; the routes show what opens them and how far each subject has come.
 * Everything in it is something that really happened; nothing here is claimed or bought.
 */
export function WonderBook({ state, onClose, onAdopt, onChart, busy }: { state: GrowingState; onClose: () => void; onAdopt?: (species: SpeciesId) => void; onChart?: () => void; busy?: boolean }) {
    const [page, setPage] = useState<Page>('next');
    const found = new Set(state.discoveries ?? []), journey = state.journey, levels = journey?.levels ?? { math: 0, vocab: 0, kokugo: 0 };
    const joy = nextJoy(state), progress = mechanismProgress(state);
    const steps = (['S1', 'S2', 'S3'] as const).filter(id => state.guidance?.starter.steps[id] || state.guidance?.starter.legacy).length;
    return <section className="growing-tray growing-wonder-book" aria-label="しまの きろく">
        <header><strong>しまの きろく</strong><button className="growing-close" onClick={onClose} aria-label="とじる">×</button></header>
        <div className="growing-record-tabs" role="tablist" aria-label="ページ">{PAGES.map(item =>
            <button key={item.id} role="tab" aria-selected={page === item.id} onClick={() => setPage(item.id)}>{item.name}</button>)}</div>
        {page === 'next' && <div className="growing-record-next" role="tabpanel">
            <strong>{joy.title}</strong><p>{joy.hint}</p>
            {joy.chart && onChart && <button type="button" className="growing-primary" onClick={onChart}>海図を ひらく</button>}
        </div>}
        {page === 'routes' && <div className="growing-record-routes" role="tabpanel">{SLOT_NAME.map((name, slot) => {
            const route = journey?.routes.find(r => r.slot === slot), choice = journey?.chosen.find(c => c.slot === slot), level = ROUTE_LEVELS[slot - 1];
            const waiting = slot > 0 && !journey?.chosen.some(c => c.slot === slot - 1);
            return <article key={slot} className="growing-route-card" data-open={route ? true : undefined}>
                <strong>{name}</strong>
                {slot === 0 ? <p>おうちを おく・ひらく・なかまを むかえる（{route ? 3 : Math.min(3, steps)}/3）</p>
                    : <p>どれか ひとつ：{SUBJECTS.map(([id, label]) => `${label} Lv${levels[id]}`).join('・')} → Lv{level}</p>}
                {route ? <small>ひらいたよ{route.reason.includes(':') ? `（${SUBJECTS.find(([id]) => route.reason.startsWith(id))?.[1] ?? ''} Lv${route.reason.split(':')[1]}）` : ''}{choice ? `・${THEME_INFO[choice.theme].name}` : ''}</small>
                    : <small>{waiting ? 'まえの こうろで しまを えらぶと ひらくよ' : 'まだ'}</small>}
                {route && !choice && onChart && <button type="button" className="growing-action" onClick={onChart}>海図で えらぶ</button>}
            </article>;
        })}</div>}
        {page === 'islands' && <div className="growing-record-islands" role="tabpanel">
            {progress && <p className="growing-flower-note">いまの しま：{progress.done ? 'しかけが そろったよ' : `${progress.have}/${progress.need}・${progress.next}`}</p>}
            <div className="growing-grid">{THEMES.map(theme => {
                const made = journey?.chosen.some(c => c.theme === theme), done = found.has(`island:${theme}`);
                return <div key={theme} className="growing-card growing-flower-card" data-known={made ? 'true' : undefined}>
                    <span className="growing-flower-dot growing-wonder-dot" aria-hidden="true" style={{ background: done ? '#ffd23f' : made ? '#b8a3dc' : '#e8e2d6' }}>{done ? '★' : made ? '◎' : '?'}</span>
                    <strong>{made ? THEME_INFO[theme].name : 'まだ'}</strong>
                    <small>{done ? 'しかけが そろったよ' : made ? THEME_INFO[theme].hint : THEME_INFO[theme].mood}</small>
                </div>;
            })}</div>
            <Entries state={state} groups={['island']} mark="#ffd23f" />
        </div>}
        {page === 'book' && <div role="tabpanel">
            <h3>いきもの</h3><Entries state={state} groups={['voyage']} mark="#b8a3dc" onAdopt={onAdopt} busy={busy} />
            <h3>はな {(state.flowerBook ?? []).length}/{FLOWER_COLORS.length}</h3>
            <div className="growing-grid">{FLOWER_COLORS.map(color => {
                const known = state.flowerBook?.includes(color);
                return <div key={color} className="growing-card growing-flower-card" data-known={known ? 'true' : undefined}>
                    <span className="growing-flower-dot" aria-hidden="true" style={{ background: known ? FLOWER_PAINT[color] : '#e8e2d6' }}>{known ? '' : '?'}</span>
                    <strong>{known ? FLOWER_NAME[color] : 'まだ'}</strong></div>;
            })}</div>
            <h3>ふしぎ</h3><Entries state={state} groups={['ground', 'luck', 'sky']} mark="#7cc49a" />
        </div>}
        {page === 'firsts' && <div role="tabpanel">
            <div className="growing-grid">{achievementCatalog.map(item => {
                const known = Boolean(state.guidance?.achievements[item.id]);
                return <div key={item.id} className="growing-card growing-flower-card" data-known={known ? 'true' : undefined}>
                    <span className="growing-flower-dot growing-wonder-dot" aria-hidden="true" style={{ background: known ? '#f19a9a' : '#e8e2d6' }}>{known ? '★' : '?'}</span>
                    <strong>{known ? item.title : 'まだ'}</strong><small>{known ? 'できたよ' : item.hint}</small></div>;
            })}</div>
            <Entries state={state} groups={['build', 'life']} mark="#e0a25a" />
        </div>}
        {page === 'learn' && <div role="tabpanel">
            <p className="growing-flower-note">{SUBJECTS.map(([id, label]) => `${label} Lv${levels[id]}`).join('・')}（ないようを たしかめた レベル）</p>
            <Entries state={state} groups={['learn']} mark="#95c6e8" />
        </div>}
    </section>;
}

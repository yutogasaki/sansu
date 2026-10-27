import { useState } from 'react';
import { DISCOVERIES, type DiscoveryGroup } from '../../../domain/growingIsland/discoveries';
import { GIFT_NAME, shoalStage, SPECIES, THEME_INFO, type SpeciesId } from '../../../domain/growingIsland/journey';
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
/** What the sea off the newest island looks like (island-journey.md §3.6); never what it will become. */
const SHOAL_LINE = ['', 'おきの うみの いろが、すこし ちがうみたい', 'おきに すなの みちが みえてきたよ', 'おきの きりの むこうに、なにかが そだったよ'] as const;

/** The one nearest thing to look forward to (island-journey.md §5). */
function nextJoy(state: GrowingState): { title: string; hint: string; chart?: boolean } {
    const step = starterStep(state);
    if (step === 'S1' || step === 'S2' || step === 'S3') return { title: STARTER_COPY[step].title, hint: STARTER_COPY[step].hint };
    if (shoalStage(state) === 3) return { title: SHOAL_LINE[3], hint: 'わたってみよう', chart: true };
    const progress = mechanismProgress(state);
    if (progress && !progress.done) return { title: `${THEME_INFO[progress.theme].name}の しかけ`, hint: progress.next };
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
    return <section className="growing-tray growing-wonder-book" aria-label="しまの きろく">
        <header><strong>しまの きろく</strong><button className="growing-close" onClick={onClose} aria-label="とじる">×</button></header>
        <div className="growing-record-tabs" role="tablist" aria-label="ページ">{PAGES.map(item =>
            <button key={item.id} role="tab" aria-selected={page === item.id} onClick={() => setPage(item.id)}>{item.name}</button>)}</div>
        {page === 'next' && <div className="growing-record-next" role="tabpanel">
            <strong>{joy.title}</strong><p>{joy.hint}</p>
            {joy.chart && onChart && <button type="button" className="growing-primary" onClick={onChart}>海図を ひらく</button>}
        </div>}
        {page === 'routes' && <div className="growing-record-routes" role="tabpanel">
            {(journey?.chosen ?? []).map((choice, i) => <article key={choice.islandId} className="growing-route-card" data-open>
                <strong>{i + 1}つめの しま</strong><small>{THEME_INFO[choice.theme].name}</small>
            </article>)}
            {(() => { const stage = shoalStage(state); return stage ? <article className="growing-route-card" data-shoal={stage}><strong>おきの うみ</strong><small>{SHOAL_LINE[stage]}</small></article> : null; })()}
            {!journey?.chosen.length && !shoalStage(state) && <p className="growing-flower-note">しまを そだてていると、おきの うみが かわってくるかも</p>}
        </div>}
        {page === 'islands' && <div className="growing-record-islands" role="tabpanel">
            {progress && <p className="growing-flower-note">いまの しま：{progress.done ? 'しかけが そろったよ' : `${progress.have}/${progress.need}・${progress.next}`}</p>}
            {/* Only islands the child reached; the ones still to come stay unknown (§3.6). */}
            <div className="growing-grid">{(journey?.chosen ?? []).map(({ theme }) => {
                const done = found.has(`island:${theme}`);
                return <div key={theme} className="growing-card growing-flower-card" data-known="true">
                    <span className="growing-flower-dot growing-wonder-dot" aria-hidden="true" style={{ background: done ? '#ffd23f' : '#b8a3dc' }}>{done ? '★' : '◎'}</span>
                    <strong>{THEME_INFO[theme].name}</strong>
                    <small>{done ? `しかけが そろったよ。とくさんの「${GIFT_NAME[theme]}」が ほかの しまに とどいているよ` : THEME_INFO[theme].hint}</small>
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
